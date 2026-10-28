"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { localNoon } from "@/lib/dates";
import { lockRows } from "@/lib/locks";
import { normalizePhone } from "@/lib/phone";
import { refreshShop, requireActionShop, type ShopContext } from "@/lib/tenant";
import { ticketAccessWhere } from "@/features/tickets/queries";
import { BEFORE_WAITING, partOrderInput, type PartOrderInput } from "./rules";

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const idInput = z.string().min(1).max(64);

function invalid(issues: { path: PropertyKey[]; message: string }[]): { ok: false; error: string; fieldErrors: Record<string, string> } {
  return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message])) };
}

/** Parsed + normalized order fields, or field errors. */
function parse(ctx: ShopContext, input: PartOrderInput) {
  const parsed = partOrderInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const supplierPhone = v.supplierPhone ? normalizePhone(v.supplierPhone, ctx.shop.countryCode) : null;
  if (v.supplierPhone && !supplierPhone) return { ok: false as const, error: "invalid", fieldErrors: { supplierPhone: "invalidPhone" } };
  return {
    ok: true as const,
    data: {
      part: v.part,
      qty: v.qty,
      supplierName: v.supplierName,
      supplierPhone,
      costUsdCents: v.costUsdCents,
      note: v.note,
      expectedAt: localNoon(v.expectedDay, ctx.shop.timezone),
    },
  };
}

/** Orders a part for a repair; a repair not started or in progress moves to "Waiting for part". */
export async function createPartOrder(ticketId: string, input: PartOrderInput): Promise<Result> {
  const ctx = await requireActionShop("tickets.status");
  if (!idInput.safeParse(ticketId).success) return { ok: false, error: "invalid" };
  const p = parse(ctx, input);
  if (!p.ok) return p;
  const shopId = ctx.shop.id;
  const ticket = await ctx.db.ticket.findFirst({ where: { AND: [{ id: ticketId }, ticketAccessWhere(ctx.user)] }, select: { id: true } });
  if (!ticket) return { ok: false, error: "notFound" };
  await prisma.$transaction(async (tx) => {
    await lockRows(tx, "Ticket", shopId, [ticketId]);
    await tx.partOrder.create({ data: { ...p.data, shopId, ticketId, userId: ctx.user.id } });
    const { status } = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId, shopId }, select: { status: true } });
    if ((BEFORE_WAITING as readonly string[]).includes(status)) {
      await tx.ticket.update({ where: { id: ticketId, shopId }, data: { status: "WAITING_PART" } });
      await tx.ticketStatusLog.create({ data: { shopId, ticketId, from: status, to: "WAITING_PART", userId: ctx.user.id, note: "@partOrdered" } });
    }
  });
  refreshShop();
  return { ok: true };
}

async function orderFor(ctx: ShopContext, orderId: string) {
  if (!idInput.safeParse(orderId).success) return null;
  return ctx.db.partOrder.findFirst({
    where: { id: orderId, ticket: ticketAccessWhere(ctx.user) },
    select: { id: true, ticketId: true, status: true },
  });
}

export async function updatePartOrder(orderId: string, input: PartOrderInput): Promise<Result> {
  const ctx = await requireActionShop("tickets.status");
  const order = await orderFor(ctx, orderId);
  if (!order) return { ok: false, error: "notFound" };
  const p = parse(ctx, input);
  if (!p.ok) return p;
  await prisma.partOrder.update({ where: { id: order.id, shopId: ctx.shop.id }, data: p.data });
  refreshShop();
  return { ok: true };
}

/**
 * Arrived / cancelled / back to ordered. When the last ordered part of a repair waiting for parts
 * arrives, the repair moves back to "Repairing".
 */
export async function setPartOrderStatus(orderId: string, status: "ORDERED" | "ARRIVED" | "CANCELLED"): Promise<Result> {
  const ctx = await requireActionShop("tickets.status");
  if (!["ORDERED", "ARRIVED", "CANCELLED"].includes(status)) return { ok: false, error: "invalid" };
  const order = await orderFor(ctx, orderId);
  if (!order) return { ok: false, error: "notFound" };
  const shopId = ctx.shop.id;
  await prisma.$transaction(async (tx) => {
    await lockRows(tx, "Ticket", shopId, [order.ticketId]);
    await tx.partOrder.update({
      where: { id: order.id, shopId },
      data: { status, arrivedAt: status === "ARRIVED" ? new Date() : null },
    });
    if (status !== "ARRIVED") return;
    const [ticket, stillOrdered] = await Promise.all([
      tx.ticket.findUniqueOrThrow({ where: { id: order.ticketId, shopId }, select: { status: true } }),
      tx.partOrder.count({ where: { shopId, ticketId: order.ticketId, status: "ORDERED" } }),
    ]);
    if (ticket.status === "WAITING_PART" && stillOrdered === 0) {
      await tx.ticket.update({ where: { id: order.ticketId, shopId }, data: { status: "REPAIRING" } });
      await tx.ticketStatusLog.create({
        data: { shopId, ticketId: order.ticketId, from: "WAITING_PART", to: "REPAIRING", userId: ctx.user.id, note: "@partsArrived" },
      });
    }
  });
  refreshShop();
  return { ok: true };
}

/** Records that the supplier or the customer message was sent (the wa.me link opens in the browser). */
export async function markPartOrderMessage(orderId: string, to: "supplier" | "customer"): Promise<Result> {
  const ctx = await requireActionShop("tickets.status");
  const order = await orderFor(ctx, orderId);
  if (!order) return { ok: false, error: "notFound" };
  await prisma.partOrder.update({
    where: { id: order.id, shopId: ctx.shop.id },
    data: to === "supplier" ? { supplierSentAt: new Date() } : { customerToldAt: new Date() },
  });
  refreshShop();
  return { ok: true };
}
