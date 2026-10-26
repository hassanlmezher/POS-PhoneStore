"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dayKey, startOfDay } from "@/lib/dates";
import { lockRows } from "@/lib/locks";
import { toUsdCents } from "@/lib/money";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { expenseInput, type ExpenseInput } from "./schema";

export type ExpenseResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const idInput = z.string().min(1).max(64);

/** Noon of the local day, so a time zone shift never moves it to the day before or after. */
const dayToInstant = (day: string, tz: string) => new Date(startOfDay(day, tz).getTime() + 12 * 3_600_000);

function invalid(issues: { path: PropertyKey[]; message: string }[]): ExpenseResult {
  return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message])) };
}

/** Creates an expense, or updates it when `id` is set. A new one can also be paid out of the open drawer. */
export async function saveExpense(input: ExpenseInput, id?: string): Promise<ExpenseResult> {
  const ctx = await requireActionShop("expenses");
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (id !== undefined && !idInput.safeParse(id).success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { shop } = ctx;
  if (v.day > dayKey(new Date(), shop.timezone)) return { ok: false, error: "invalid", fieldErrors: { day: "invalidDate" } };

  const tc = await getTranslations("expenses.categories");
  const reason = [tc(v.category), v.note].filter(Boolean).join(" · ").slice(0, 200);
  const data = {
    category: v.category,
    note: v.note,
    currency: v.currency,
    amount: v.amount,
    usdCentsEquivalent: toUsdCents(v.amount, v.currency, shop.exchangeRate),
    spentAt: dayToInstant(v.day, shop.timezone),
  };

  const res = await prisma.$transaction(async (tx): Promise<ExpenseResult> => {
    if (!id) {
      let cashMovementId: string | null = null;
      if (v.fromDrawer) {
        const session = await tx.cashSession.findFirst({ where: { shopId: shop.id, closedAt: null }, select: { id: true } });
        if (!session) return { ok: false, error: "noOpenDrawer" };
        await lockRows(tx, "CashSession", shop.id, [session.id]);
        const mv = await tx.cashMovement.create({
          data: { shopId: shop.id, cashSessionId: session.id, type: "PAY_OUT", currency: v.currency, amount: v.amount, reason, userId: ctx.user.id },
        });
        cashMovementId = mv.id;
      }
      await tx.expense.create({ data: { ...data, shopId: shop.id, userId: ctx.user.id, cashMovementId } });
      return { ok: true };
    }

    const existing = await tx.expense.findFirst({
      where: { id, shopId: shop.id },
      select: { currency: true, amount: true, usdCentsEquivalent: true, cashMovement: { select: { id: true, cashSessionId: true } } },
    });
    if (!existing) return { ok: false, error: "notFound" };
    // Same amount: keep the rate it was recorded at.
    if (existing.currency === v.currency && existing.amount === v.amount) data.usdCentsEquivalent = existing.usdCentsEquivalent;
    await tx.expense.update({ where: { id, shopId: shop.id }, data });
    // A drawer that is still open follows the edit; a closed drawer's count stays as it was.
    const mv = existing.cashMovement;
    if (mv) {
      await lockRows(tx, "CashSession", shop.id, [mv.cashSessionId]);
      await tx.cashMovement.updateMany({
        where: { id: mv.id, shopId: shop.id, cashSession: { closedAt: null } },
        data: { currency: v.currency, amount: v.amount, reason },
      });
    }
    return { ok: true };
  });
  if (res.ok) refreshShop();
  return res;
}

/** Deletes an expense; its drawer pay-out goes too while that drawer is still open. */
export async function deleteExpense(id: string): Promise<ExpenseResult> {
  const ctx = await requireActionShop("expenses");
  if (!idInput.safeParse(id).success) return { ok: false, error: "invalid" };
  const shopId = ctx.shop.id;
  const res = await prisma.$transaction(async (tx): Promise<ExpenseResult> => {
    const existing = await tx.expense.findFirst({ where: { id, shopId }, select: { cashMovement: { select: { id: true, cashSessionId: true } } } });
    if (!existing) return { ok: false, error: "notFound" };
    await tx.expense.delete({ where: { id, shopId } });
    const mv = existing.cashMovement;
    if (mv) {
      await lockRows(tx, "CashSession", shopId, [mv.cashSessionId]);
      await tx.cashMovement.deleteMany({ where: { id: mv.id, shopId, cashSession: { closedAt: null } } });
    }
    return { ok: true };
  });
  if (res.ok) refreshShop();
  return res;
}
