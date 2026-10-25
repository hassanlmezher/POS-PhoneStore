import "server-only";
import { prisma } from "@/lib/db";

export type DrawerTotals = {
  openingUsdCents: number;
  openingLbp: number;
  cashInUsdCents: number;
  cashInLbp: number;
  changeOutUsdCents: number;
  changeOutLbp: number;
  payInUsdCents: number;
  payInLbp: number;
  payOutUsdCents: number;
  payOutLbp: number;
  expectedUsdCents: number;
  expectedLbp: number;
  /** Non-cash takings during the session, by method, in USD cents (for information). */
  otherMethods: { method: string; usdCents: number; count: number }[];
  salesCount: number;
};

/**
 * Expected cash per currency = opening + cash payments − change given + pay-ins − pay-outs.
 * Payments of voided sales are excluded; ticket deposits (no sale) count.
 */
export async function drawerTotals(shopId: string, sessionId: string): Promise<DrawerTotals | null> {
  const session = await prisma.cashSession.findFirst({ where: { id: sessionId, shopId } });
  if (!session) return null;

  const notVoided = { OR: [{ saleId: null }, { sale: { status: "COMPLETED" as const } }] };
  const [cashIn, other, change, moves, salesCount] = await Promise.all([
    prisma.payment.groupBy({
      by: ["currency"],
      where: { shopId, cashSessionId: sessionId, method: "CASH", ...notVoided },
      _sum: { amount: true },
    }),
    // Non-cash payments made while this drawer was open.
    prisma.payment.groupBy({
      by: ["method"],
      where: {
        shopId,
        method: { not: "CASH" },
        createdAt: { gte: session.openedAt, ...(session.closedAt && { lte: session.closedAt }) },
        ...notVoided,
      },
      _sum: { usdCentsEquivalent: true },
      _count: true,
    }),
    prisma.sale.groupBy({
      by: ["changeCurrency"],
      where: { shopId, cashSessionId: sessionId, status: "COMPLETED", changeAmount: { gt: 0 } },
      _sum: { changeAmount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["type", "currency"],
      where: { shopId, cashSessionId: sessionId },
      _sum: { amount: true },
    }),
    prisma.sale.count({ where: { shopId, cashSessionId: sessionId, status: "COMPLETED" } }),
  ]);

  const sumBy = <T extends { _sum: { amount?: number | null; changeAmount?: number | null } }>(
    rows: T[],
    pick: (r: T) => boolean,
  ) => rows.filter(pick).reduce((s, r) => s + (r._sum.amount ?? r._sum.changeAmount ?? 0), 0);

  const t = {
    openingUsdCents: session.openingUsdCents,
    openingLbp: session.openingLbp,
    cashInUsdCents: sumBy(cashIn, (r) => r.currency === "USD"),
    cashInLbp: sumBy(cashIn, (r) => r.currency === "LBP"),
    changeOutUsdCents: sumBy(change, (r) => r.changeCurrency === "USD"),
    changeOutLbp: sumBy(change, (r) => r.changeCurrency === "LBP"),
    payInUsdCents: sumBy(moves, (r) => r.type === "PAY_IN" && r.currency === "USD"),
    payInLbp: sumBy(moves, (r) => r.type === "PAY_IN" && r.currency === "LBP"),
    payOutUsdCents: sumBy(moves, (r) => r.type === "PAY_OUT" && r.currency === "USD"),
    payOutLbp: sumBy(moves, (r) => r.type === "PAY_OUT" && r.currency === "LBP"),
  };
  return {
    ...t,
    expectedUsdCents: t.openingUsdCents + t.cashInUsdCents - t.changeOutUsdCents + t.payInUsdCents - t.payOutUsdCents,
    expectedLbp: t.openingLbp + t.cashInLbp - t.changeOutLbp + t.payInLbp - t.payOutLbp,
    otherMethods: other.map((o) => ({ method: o.method, usdCents: o._sum.usdCentsEquivalent ?? 0, count: o._count })),
    salesCount,
  };
}

export async function getOpenSession(shopId: string) {
  return prisma.cashSession.findFirst({
    where: { shopId, closedAt: null },
    include: {
      openedBy: { select: { name: true } },
      movements: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  });
}

export const SESSIONS_PAGE_SIZE = 20;

/** Closed sessions with their difference (counted − expected) per currency. */
export async function listClosedSessions(shopId: string, page = 1) {
  page = Math.max(1, page);
  const where = { shopId, closedAt: { not: null } };
  const [rows, total] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } },
      orderBy: { openedAt: "desc" },
      skip: (page - 1) * SESSIONS_PAGE_SIZE,
      take: SESSIONS_PAGE_SIZE,
    }),
    prisma.cashSession.count({ where }),
  ]);
  return {
    rows: rows.map((s) => ({
      ...s,
      diffUsdCents: (s.countedUsdCents ?? 0) - (s.expectedUsdCents ?? 0),
      diffLbp: (s.countedLbp ?? 0) - (s.expectedLbp ?? 0),
    })),
    total,
    page,
    pageSize: SESSIONS_PAGE_SIZE,
  };
}

export async function getSession(shopId: string, id: string) {
  return prisma.cashSession.findFirst({
    where: { id, shopId },
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      movements: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
    },
  });
}
