"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseMoney } from "@/lib/money";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { drawerTotals } from "./queries";

export type CashResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Counted/opening amounts: empty = 0. */
const amount = (currency: "USD" | "LBP") =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return 0;
      const n = parseMoney(v, currency);
      if (n === null) ctx.addIssue({ code: "custom", message: "invalidAmount" });
      return n ?? 0;
    });

const openInput = z.object({ openingUsd: amount("USD"), openingLbp: amount("LBP") });
const closeInput = z.object({ countedUsd: amount("USD"), countedLbp: amount("LBP"), note: z.string().trim().max(500).optional() });
const movementInput = z
  .object({
    type: z.enum(["PAY_IN", "PAY_OUT"]),
    currency: z.enum(["USD", "LBP"]),
    amount: z.string().trim().min(1, "required"),
    reason: z.string().trim().min(1, "required").max(200),
  })
  .transform((v, ctx) => {
    const n = parseMoney(v.amount, v.currency);
    if (n === null || n <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "invalidAmount" });
      return z.NEVER;
    }
    return { ...v, amount: n };
  });

function invalid(issues: { path: PropertyKey[]; message: string }[]): CashResult<never> {
  return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message])) };
}

export async function openDrawer(input: z.input<typeof openInput>): Promise<CashResult> {
  const ctx = await requireActionShop("cash");
  const parsed = openInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const shopId = ctx.shop.id;
  const opened = await prisma.$transaction(async (tx) => {
    // Lock the shop row so two cashiers can't open two drawers at the same moment.
    await tx.$queryRaw`SELECT id FROM "Shop" WHERE id = ${shopId} FOR UPDATE`;
    const existing = await tx.cashSession.findFirst({ where: { shopId, closedAt: null }, select: { id: true } });
    if (existing) return false;
    await tx.cashSession.create({
      data: { shopId, openedById: ctx.user.id, openingUsdCents: parsed.data.openingUsd, openingLbp: parsed.data.openingLbp },
    });
    return true;
  });
  if (!opened) return { ok: false, error: "alreadyOpen" };
  refreshShop();
  return { ok: true };
}

export async function addCashMovement(input: z.input<typeof movementInput>): Promise<CashResult> {
  const ctx = await requireActionShop("cash");
  const parsed = movementInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const session = await ctx.db.cashSession.findFirst({ where: { closedAt: null }, select: { id: true } });
  if (!session) return { ok: false, error: "noOpenDrawer" };
  await ctx.db.cashMovement.create({
    data: { ...parsed.data, shopId: ctx.shop.id, cashSessionId: session.id, userId: ctx.user.id },
  });
  refreshShop();
  return { ok: true };
}

/** Closes the drawer, snapshotting expected amounts so later edits can't change history. */
export async function closeDrawer(
  input: z.input<typeof closeInput>,
): Promise<CashResult<{ sessionId: string; diffUsdCents: number; diffLbp: number }>> {
  const ctx = await requireActionShop("cash");
  const parsed = closeInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const session = await ctx.db.cashSession.findFirst({ where: { closedAt: null }, select: { id: true } });
  if (!session) return { ok: false, error: "noOpenDrawer" };
  const totals = await drawerTotals(ctx.shop.id, session.id);
  if (!totals) return { ok: false, error: "noOpenDrawer" };

  await ctx.db.cashSession.update({
    where: { id: session.id },
    data: {
      closedAt: new Date(),
      closedById: ctx.user.id,
      countedUsdCents: parsed.data.countedUsd,
      countedLbp: parsed.data.countedLbp,
      expectedUsdCents: totals.expectedUsdCents,
      expectedLbp: totals.expectedLbp,
      note: parsed.data.note || null,
    },
  });
  refreshShop();
  return {
    ok: true,
    sessionId: session.id,
    diffUsdCents: parsed.data.countedUsd - totals.expectedUsdCents,
    diffLbp: parsed.data.countedLbp - totals.expectedLbp,
  };
}
