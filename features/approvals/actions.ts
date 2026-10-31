"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { lockRows } from "@/lib/locks";
import { parseMoney } from "@/lib/money";
import { getRequestSlug, getShopBySlug, refreshShop, requireActionShop } from "@/lib/tenant";
import { ticketCharge } from "@/features/tickets/money";
import { deviceName, ticketAccessWhere } from "@/features/tickets/queries";
import { approvalWhatsApp } from "./link";

export type ApprovalResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

const createInput = z.object({
  amount: z.string().trim().min(1, "required"),
  reason: z.string().trim().min(1, "required").max(300),
});

/**
 * Staff: ask the customer to approve a new price. Any earlier pending request on the ticket is
 * cancelled, so the customer can only answer the latest one. Returns the WhatsApp link to send.
 */
export async function createApproval(ticketId: string, input: z.input<typeof createInput>): Promise<ApprovalResult<{ url: string; link: string }>> {
  const ctx = await requireActionShop("tickets.status");
  const parsed = createInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const amount = parseMoney(parsed.data.amount, "USD");
  if (amount === null || amount <= 0) return { ok: false, error: "invalid", fieldErrors: { amount: "invalidAmount" } };
  const shopId = ctx.shop.id;

  const ticket = await ctx.db.ticket.findFirst({
    where: { AND: [{ id: ticketId }, ticketAccessWhere(ctx.user)] },
    select: {
      id: true,
      number: true,
      estimateUsdCents: true,
      totalUsdCents: true,
      brandText: true,
      modelText: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
      customer: { select: { name: true, phone: true, locale: true } },
      _count: { select: { items: true } },
    },
  });
  if (!ticket) return { ok: false, error: "notFound" };

  const token = randomBytes(18).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await lockRows(tx, "Ticket", shopId, [ticket.id]);
    await tx.priceApproval.updateMany({ where: { shopId, ticketId: ticket.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.priceApproval.create({
      data: {
        shopId,
        ticketId: ticket.id,
        token,
        amountUsdCents: amount,
        previousUsdCents: ticketCharge({ ...ticket, payments: [] }) || null,
        reason: parsed.data.reason,
        createdById: ctx.user.id,
      },
    });
  });
  refreshShop();
  const wa = await approvalWhatsApp(ctx.shop, ticket.customer, { number: ticket.number, device: deviceName(ticket) }, { token, amountUsdCents: amount, reason: parsed.data.reason });
  return { ok: true, ...wa };
}

/** Staff: withdraw a request the customer hasn't answered yet. */
export async function cancelApproval(approvalId: string): Promise<ApprovalResult> {
  const ctx = await requireActionShop("tickets.status");
  const done = await ctx.db.priceApproval.updateMany({ where: { id: approvalId, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (done.count === 0) return { ok: false, error: "notPending" };
  refreshShop();
  return { ok: true };
}

/**
 * Customer (public, no login): answer from the /approve/<token> page. The shop comes from the request
 * host, never from the client; the token must belong to it. Only the first answer counts.
 * On approve, the ticket's estimate becomes the new price and a ticket still being checked moves to Repairing.
 */
export async function respondApproval(token: string, decision: "APPROVE" | "DECLINE"): Promise<ApprovalResult<{ status: string }>> {
  if (typeof token !== "string" || token.length > 64 || (decision !== "APPROVE" && decision !== "DECLINE")) return { ok: false, error: "invalid" };
  const slug = await getRequestSlug();
  const shop = slug ? await getShopBySlug(slug) : null;
  if (!shop) return { ok: false, error: "notFound" };
  return answer(shop.id, { token }, decision, null);
}

/**
 * Staff: the customer answered in person or by phone. Same effect as the customer's own answer by link
 * (only a pending request; the first answer counts), and remembers who recorded it.
 */
export async function recordApprovalAnswer(approvalId: string, decision: "APPROVE" | "DECLINE"): Promise<ApprovalResult<{ status: string }>> {
  const ctx = await requireActionShop("tickets.status");
  if (typeof approvalId !== "string" || approvalId.length > 64 || (decision !== "APPROVE" && decision !== "DECLINE")) return { ok: false, error: "invalid" };
  const visible = await ctx.db.priceApproval.findFirst({ where: { id: approvalId, ticket: ticketAccessWhere(ctx.user) }, select: { id: true } });
  if (!visible) return { ok: false, error: "notFound" };
  const res = await answer(ctx.shop.id, { id: approvalId }, decision, ctx.user.id);
  refreshShop();
  return res;
}

/** Applies an answer to a pending request: on approve the estimate becomes the new price and an early-stage repair waits for the part. */
async function answer(shopId: string, which: { token: string } | { id: string }, decision: "APPROVE" | "DECLINE", staffId: string | null) {
  return prisma.$transaction(async (tx) => {
    const approval = await tx.priceApproval.findFirst({
      where: { ...which, shopId },
      select: { id: true, status: true, ticketId: true, amountUsdCents: true, createdById: true },
    });
    if (!approval) return { ok: false as const, error: "notFound" };
    await lockRows(tx, "Ticket", shopId, [approval.ticketId]);
    const status = decision === "APPROVE" ? "APPROVED" : "DECLINED";
    const answered = await tx.priceApproval.updateMany({
      where: { id: approval.id, status: "PENDING" },
      data: { status, respondedAt: new Date(), answeredById: staffId },
    });
    if (answered.count === 0) {
      const now = await tx.priceApproval.findUniqueOrThrow({ where: { id: approval.id }, select: { status: true } });
      return { ok: true as const, status: now.status };
    }
    if (status === "APPROVED") {
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: approval.ticketId, shopId }, select: { status: true } });
      // Approved extra work usually needs a new part, so the repair waits for it to be ordered.
      const moveOn = ticket.status === "RECEIVED" || ticket.status === "DIAGNOSING" || ticket.status === "REPAIRING";
      await tx.ticket.update({
        where: { id: approval.ticketId, shopId },
        data: { estimateUsdCents: approval.amountUsdCents, ...(moveOn && { status: "WAITING_PART" }) },
      });
      if (moveOn) {
        await tx.ticketStatusLog.create({
          data: { shopId, ticketId: approval.ticketId, from: ticket.status, to: "WAITING_PART", userId: staffId ?? approval.createdById, note: "@approvedByCustomer" },
        });
      }
    }
    return { ok: true as const, status };
  });
}
