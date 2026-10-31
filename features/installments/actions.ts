"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { dayKey, localNoon } from "@/lib/dates";
import { lockRows } from "@/lib/locks";
import { can } from "@/lib/permissions";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { ticketAccessWhere } from "@/features/tickets/queries";
import { owedOn } from "./owed";
import { planInput, scheduleDays, splitAmount, type PlanInput } from "./rules";

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };
const idInput = z.string().min(1).max(64);

/**
 * Splits what is still owed on a sale or a repair into parts. A plan that already exists
 * on it is replaced (the new plan starts from what is owed now).
 */
export async function savePlan(input: PlanInput): Promise<Result> {
  const ctx = await requireActionShop();
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.map(String).join("."), i.message])) };
  const v = parsed.data;
  if (!can(ctx.user.role, v.kind === "sale" ? "pos" : "tickets.create")) return { ok: false, error: "forbidden" };
  const shopId = ctx.shop.id;
  const tz = ctx.shop.timezone;
  if (v.firstDay < dayKey(new Date(), tz)) return { ok: false, error: "invalid", fieldErrors: { firstDay: "pastDate" } };

  return prisma.$transaction(async (tx) => {
    await lockRows(tx, v.kind === "sale" ? "Sale" : "Ticket", shopId, [v.id]);
    const owed = await owedOn(tx, shopId, v.kind, v.id, v.kind === "ticket" ? ticketAccessWhere(ctx.user) : undefined);
    if (!owed) return { ok: false as const, error: "notFound" };
    if (!owed.customerId) return { ok: false as const, error: "needsCustomer" };
    if (owed.balanceUsdCents < 100 * v.parts) return { ok: false as const, error: "invalid", fieldErrors: { parts: "tooSmall" } };
    const link = v.kind === "sale" ? { saleId: v.id } : { ticketId: v.id };
    await tx.installmentPlan.deleteMany({ where: { shopId, ...link } });
    const days = scheduleDays(v.firstDay, v.parts, v.every);
    const amounts = splitAmount(owed.balanceUsdCents, v.parts);
    await tx.installmentPlan.create({
      data: {
        shopId,
        customerId: owed.customerId,
        ...link,
        totalUsdCents: owed.balanceUsdCents,
        paidBeforeUsdCents: owed.paidUsdCents,
        note: v.note,
        userId: ctx.user.id,
        parts: { create: days.map((d, i) => ({ shopId, number: i + 1, dueAt: localNoon(d, tz), amountUsdCents: amounts[i] })) },
      },
    });
    refreshShop();
    return { ok: true as const };
  });
}

/** Stops paying in parts: the remaining balance is owed as one amount again. */
export async function deletePlan(planId: string): Promise<Result> {
  const ctx = await requireActionShop();
  if (!idInput.safeParse(planId).success) return { ok: false, error: "invalid" };
  const plan = await ctx.db.installmentPlan.findFirst({ where: { id: planId }, select: { id: true, saleId: true } });
  if (!plan) return { ok: false, error: "notFound" };
  if (!can(ctx.user.role, plan.saleId ? "pos" : "tickets.create")) return { ok: false, error: "forbidden" };
  await prisma.installmentPlan.deleteMany({ where: { id: plan.id, shopId: ctx.shop.id } });
  refreshShop();
  return { ok: true };
}

/** Remembers that the WhatsApp reminder for a part was opened. */
export async function markReminded(partId: string): Promise<Result> {
  const ctx = await requireActionShop();
  if (!idInput.safeParse(partId).success) return { ok: false, error: "invalid" };
  const res = await prisma.installment.updateMany({ where: { id: partId, shopId: ctx.shop.id }, data: { remindedAt: new Date() } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  refreshShop();
  return { ok: true };
}
