import "server-only";
import { prisma } from "@/lib/db";
import { addDays, dayRange } from "@/lib/dates";
import type { ShopContext } from "@/lib/tenant";
import { drawerTotals } from "@/features/cash/queries";
import { countLowStock } from "@/features/inventory/queries";
import { salesByDay } from "@/features/reports/queries";
import { ticketAccessWhere, ticketCardSelect, deviceName } from "@/features/tickets/queries";
import { ticketBalance } from "@/features/tickets/money";
import { can } from "@/lib/permissions";

/**
 * Everything the dashboard shows, scoped to what the user may see.
 * Money tiles (takings, drawer) only for roles with "pos"; technicians get their own repairs.
 */
export async function dashboardData(ctx: ShopContext) {
  const shopId = ctx.shop.id;
  const tz = ctx.shop.timezone;
  const today = dayRange(tz);
  const todayOnly = dayRange(tz, today.to, today.to);
  const last7 = dayRange(tz, addDays(today.to, -6), today.to);
  const access = ticketAccessWhere(ctx.user);
  const showMoney = can(ctx.user.role, "pos");
  const now = new Date();

  const card = <T extends Parameters<typeof deviceName>[0] & Parameters<typeof ticketBalance>[0]>(t: T) => ({
    ...t,
    device: deviceName(t),
    balanceUsdCents: ticketBalance(t),
  });

  const [openCount, receivedToday, ready, overdue, mine, lowStockCount, lowStock, week, drawer] = await Promise.all([
    ctx.db.ticket.count({ where: { AND: [access, { status: { in: ["RECEIVED", "DIAGNOSING", "WAITING_PART", "REPAIRING"] } }] } }),
    ctx.db.ticket.count({ where: { AND: [access, { createdAt: { gte: todayOnly.start, lt: todayOnly.end } }] } }),
    ctx.db.ticket.findMany({
      where: { AND: [access, { status: "READY" }] },
      select: ticketCardSelect,
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
    ctx.db.ticket.findMany({
      where: {
        AND: [access, { status: { in: ["RECEIVED", "DIAGNOSING", "WAITING_PART", "REPAIRING"] } }, { promisedAt: { lt: now } }],
      },
      select: ticketCardSelect,
      orderBy: { promisedAt: "asc" },
      take: 10,
    }),
    ctx.user.role === "TECHNICIAN"
      ? ctx.db.ticket.findMany({
          where: { assignedToId: ctx.user.id, status: { in: ["RECEIVED", "DIAGNOSING", "WAITING_PART", "REPAIRING"] } },
          select: ticketCardSelect,
          orderBy: [{ promisedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
          take: 20,
        })
      : Promise.resolve([]),
    countLowStock(shopId),
    prisma.$queryRaw<{ id: string; name: string; qty: number; lowStockThreshold: number }[]>`
      SELECT id, name, qty, "lowStockThreshold" FROM "Product"
      WHERE "shopId" = ${shopId} AND active = true AND qty <= "lowStockThreshold"
      ORDER BY qty ASC, name ASC LIMIT 6`,
    showMoney ? salesByDay(shopId, last7) : Promise.resolve([]),
    showMoney
      ? prisma.cashSession
          .findFirst({ where: { shopId, closedAt: null }, select: { id: true, openedAt: true, openedBy: { select: { name: true } } } })
          .then(async (s) => (s ? { ...s, totals: await drawerTotals(shopId, s.id) } : null))
      : Promise.resolve(null),
  ]);

  const todayRow = week.find((d) => d.day === today.to);
  return {
    showMoney,
    today: today.to,
    openRepairs: openCount,
    receivedToday,
    readyCount: ready.length,
    ready: ready.slice(0, 8).map(card),
    overdue: overdue.map(card),
    myRepairs: (mine as typeof ready).map(card),
    lowStockCount,
    lowStock,
    takingsToday: todayRow?.takings ?? 0,
    salesToday: todayRow?.salesCount ?? 0,
    week,
    drawer,
  };
}
export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
