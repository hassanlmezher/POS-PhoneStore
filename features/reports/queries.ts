import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { daysIn, type DayRange } from "@/lib/dates";

// All report SQL filters on "shopId" explicitly (raw queries bypass tenantDb).
// Money is USD cents. Voided sales are excluded everywhere.

const localDay = (col: Prisma.Sql, tz: string) =>
  Prisma.sql`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD')`;

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** Change handed back on a sale, in USD cents (LBP converted at that sale's payment rate). */
const saleChangeUsd = Prisma.sql`
  CASE
    WHEN s."changeCurrency" = 'USD' THEN s."changeAmount"
    WHEN s."changeCurrency" = 'LBP' THEN ROUND(s."changeAmount" * 100.0 /
      NULLIF((SELECT p.rate FROM "Payment" p WHERE p."saleId" = s.id LIMIT 1), 0))
    ELSE 0
  END`;

export type DayRow = {
  day: string;
  salesCount: number;
  /** Accessories/parts sold over the counter, after discounts. */
  productRevenue: number;
  productCost: number;
  /** Money received for repairs (deposits + balances paid at the POS). */
  repairTakings: number;
  /** All money received minus change given (cash basis). */
  takings: number;
};

export async function salesByDay(shopId: string, range: DayRange): Promise<DayRow[]> {
  const [products, payments, ticketLines] = await Promise.all([
    prisma.$queryRaw<{ day: string; sales: bigint; revenue: bigint; cost: bigint }[]>`
      WITH s AS (
        SELECT s.id, s."createdAt", s."discountUsdCents" AS discount,
          COALESCE(SUM(i.qty * i."unitPriceUsdCents" - i."discountUsdCents") FILTER (WHERE i.kind = 'PRODUCT'), 0) AS net,
          COALESCE(SUM(i.qty * i."unitCostUsdCents") FILTER (WHERE i.kind = 'PRODUCT'), 0) AS cost
        FROM "Sale" s JOIN "SaleItem" i ON i."saleId" = s.id
        WHERE s."shopId" = ${shopId} AND s.status = 'COMPLETED'
          AND s."createdAt" >= ${range.start} AND s."createdAt" < ${range.end}
        GROUP BY s.id
      )
      SELECT ${localDay(Prisma.sql`s."createdAt"`, range.tz)} AS day,
        COUNT(*) FILTER (WHERE net > 0) AS sales,
        SUM(GREATEST(net - discount, 0)) AS revenue,
        SUM(cost) AS cost
      FROM s GROUP BY 1`,
    // Deposits on tickets (no sale) + each sale's net received (payments − change). A ±1 cent
    // gap between a sale's net and its total is LBP→cents rounding, so the total is used.
    prisma.$queryRaw<{ day: string; received: bigint; deposits: bigint }[]>`
      SELECT ${localDay(Prisma.sql`p."createdAt"`, range.tz)} AS day,
        SUM(p."usdCentsEquivalent") AS received,
        SUM(p."usdCentsEquivalent") AS deposits
      FROM "Payment" p
      WHERE p."shopId" = ${shopId} AND p."saleId" IS NULL
        AND p."createdAt" >= ${range.start} AND p."createdAt" < ${range.end}
      GROUP BY 1
      UNION ALL
      SELECT x.day, SUM(CASE WHEN ABS(x.net - x.total) <= 1 THEN x.total ELSE x.net END), 0
      FROM (
        SELECT ${localDay(Prisma.sql`s."createdAt"`, range.tz)} AS day, s."totalUsdCents" AS total,
          (SELECT COALESCE(SUM(p."usdCentsEquivalent"), 0) FROM "Payment" p WHERE p."saleId" = s.id) - ${saleChangeUsd} AS net
        FROM "Sale" s
        WHERE s."shopId" = ${shopId} AND s.status = 'COMPLETED'
          AND s."createdAt" >= ${range.start} AND s."createdAt" < ${range.end}
      ) x
      GROUP BY 1`,
    prisma.$queryRaw<{ day: string; amount: bigint }[]>`
      SELECT ${localDay(Prisma.sql`s."createdAt"`, range.tz)} AS day,
        SUM(i.qty * i."unitPriceUsdCents" - i."discountUsdCents") AS amount
      FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId"
      WHERE s."shopId" = ${shopId} AND s.status = 'COMPLETED' AND i.kind = 'TICKET_BALANCE'
        AND s."createdAt" >= ${range.start} AND s."createdAt" < ${range.end}
      GROUP BY 1`,
  ]);

  const rows = new Map<string, DayRow>(
    daysIn(range).map((day) => [day, { day, salesCount: 0, productRevenue: 0, productCost: 0, repairTakings: 0, takings: 0 }]),
  );
  for (const r of products) {
    const row = rows.get(r.day);
    if (row) Object.assign(row, { salesCount: n(r.sales), productRevenue: n(r.revenue), productCost: n(r.cost) });
  }
  for (const r of payments) {
    const row = rows.get(r.day);
    if (row) {
      row.takings += n(r.received);
      row.repairTakings += n(r.deposits);
    }
  }
  for (const r of ticketLines) {
    const row = rows.get(r.day);
    if (row) row.repairTakings += n(r.amount);
  }
  return [...rows.values()];
}

/** Tickets received in the range, by current status. */
export async function repairsByStatus(shopId: string, range: DayRange) {
  const rows = await prisma.ticket.groupBy({
    by: ["status"],
    where: { shopId, createdAt: { gte: range.start, lt: range.end } },
    _count: true,
  });
  return rows.map((r) => ({ status: r.status, count: r._count }));
}

/**
 * Repairs completed (picked up) in the range, per assigned technician.
 * Charge follows the ticket rule: items if any, else the estimate.
 */
export async function revenueByTechnician(shopId: string, range: DayRange) {
  const rows = await prisma.$queryRaw<
    { techId: string | null; name: string | null; repairs: bigint; charge: bigint; partsCost: bigint; labor: bigint }[]
  >`
    WITH t AS (
      SELECT t.id, t."assignedToId",
        CASE WHEN EXISTS (SELECT 1 FROM "TicketItem" x WHERE x."ticketId" = t.id)
          THEN t."totalUsdCents" ELSE COALESCE(t."estimateUsdCents", 0) END AS charge,
        (SELECT COALESCE(SUM(x.qty * x."unitCostUsdCents"), 0) FROM "TicketItem" x WHERE x."ticketId" = t.id AND x.kind = 'PART') AS parts_cost,
        (SELECT COALESCE(SUM(x.qty * x."unitPriceUsdCents"), 0) FROM "TicketItem" x WHERE x."ticketId" = t.id AND x.kind = 'LABOR') AS labor
      FROM "Ticket" t
      WHERE t."shopId" = ${shopId} AND t.status = 'PICKED_UP'
        AND t."pickedUpAt" >= ${range.start} AND t."pickedUpAt" < ${range.end}
    )
    SELECT t."assignedToId" AS "techId", u.name, COUNT(*) AS repairs,
      SUM(t.charge) AS charge, SUM(t.parts_cost) AS "partsCost", SUM(t.labor) AS labor
    FROM t LEFT JOIN "user" u ON u.id = t."assignedToId"
    GROUP BY t."assignedToId", u.name
    ORDER BY SUM(t.charge) DESC`;
  return rows.map((r) => ({
    techId: r.techId,
    name: r.name,
    repairs: n(r.repairs),
    chargeUsdCents: n(r.charge),
    partsCostUsdCents: n(r.partsCost),
    laborUsdCents: n(r.labor),
    profitUsdCents: n(r.charge) - n(r.partsCost),
  }));
}

export async function bestSellers(shopId: string, range: DayRange, limit = 20) {
  const rows = await prisma.$queryRaw<
    { productId: string; name: string; sku: string | null; qty: bigint; revenue: bigint; cost: bigint }[]
  >`
    SELECT i."productId", pr.name, pr.sku,
      SUM(i.qty) AS qty,
      SUM(i.qty * i."unitPriceUsdCents" - i."discountUsdCents") AS revenue,
      SUM(i.qty * i."unitCostUsdCents") AS cost
    FROM "SaleItem" i
      JOIN "Sale" s ON s.id = i."saleId"
      JOIN "Product" pr ON pr.id = i."productId"
    WHERE s."shopId" = ${shopId} AND s.status = 'COMPLETED' AND i.kind = 'PRODUCT'
      AND s."createdAt" >= ${range.start} AND s."createdAt" < ${range.end}
    GROUP BY i."productId", pr.name, pr.sku
    ORDER BY SUM(i.qty) DESC, SUM(i.qty * i."unitPriceUsdCents") DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    sku: r.sku,
    qty: n(r.qty),
    revenueUsdCents: n(r.revenue),
    costUsdCents: n(r.cost),
    profitUsdCents: n(r.revenue) - n(r.cost),
  }));
}

/** Profit = (product revenue − cost) + (repair charges − part costs for repairs picked up). */
export async function profitSummary(shopId: string, range: DayRange) {
  const [days, techs] = await Promise.all([salesByDay(shopId, range), revenueByTechnician(shopId, range)]);
  const productRevenue = days.reduce((s, d) => s + d.productRevenue, 0);
  const productCost = days.reduce((s, d) => s + d.productCost, 0);
  const repairRevenue = techs.reduce((s, t) => s + t.chargeUsdCents, 0);
  const repairCost = techs.reduce((s, t) => s + t.partsCostUsdCents, 0);
  return {
    productRevenue,
    productCost,
    productProfit: productRevenue - productCost,
    repairRevenue,
    repairCost,
    repairProfit: repairRevenue - repairCost,
    totalRevenue: productRevenue + repairRevenue,
    totalProfit: productRevenue - productCost + repairRevenue - repairCost,
    takings: days.reduce((s, d) => s + d.takings, 0),
    days,
    techs,
  };
}

/** Everything still owed, per customer: picked-up repairs and unpaid sales. Open repairs are "due on pickup". */
export async function outstandingBalances(shopId: string) {
  const [tickets, sales] = await Promise.all([
    prisma.$queryRaw<
      { id: string; number: number; status: string; customerId: string; name: string; phone: string; locale: "EN" | "AR"; balance: bigint; updatedAt: Date }[]
    >`
      WITH t AS (
        SELECT t.id, t.number, t.status, t."customerId", t."updatedAt",
          CASE WHEN EXISTS (SELECT 1 FROM "TicketItem" x WHERE x."ticketId" = t.id)
            THEN t."totalUsdCents" ELSE COALESCE(t."estimateUsdCents", 0) END
          - (SELECT COALESCE(SUM(p."usdCentsEquivalent"), 0) FROM "Payment" p WHERE p."ticketId" = t.id)
          - (SELECT COALESCE(SUM(i.qty * i."unitPriceUsdCents" - i."discountUsdCents"), 0)
               FROM "SaleItem" i JOIN "Sale" s ON s.id = i."saleId"
               WHERE i."ticketId" = t.id AND s.status = 'COMPLETED') AS balance
        FROM "Ticket" t
        WHERE t."shopId" = ${shopId} AND t.status NOT IN ('CANCELLED')
      )
      SELECT t.id, t.number, t.status, t."customerId", c.name, c.phone, c.locale::text AS locale, t.balance, t."updatedAt"
      FROM t JOIN "Customer" c ON c.id = t."customerId"
      WHERE t.balance > 1
      ORDER BY t."updatedAt" ASC`,
    prisma.$queryRaw<
      { id: string; number: number; customerId: string; name: string; phone: string; locale: "EN" | "AR"; balance: bigint; createdAt: Date }[]
    >`
      WITH s AS (
        SELECT s.id, s.number, s."customerId", s."createdAt",
          s."totalUsdCents"
          - ((SELECT COALESCE(SUM(p."usdCentsEquivalent"), 0) FROM "Payment" p WHERE p."saleId" = s.id) - ${saleChangeUsd}) AS balance
        FROM "Sale" s
        WHERE s."shopId" = ${shopId} AND s.status = 'COMPLETED' AND s."customerId" IS NOT NULL
      )
      SELECT s.id, s.number, s."customerId", c.name, c.phone, c.locale::text AS locale, s.balance, s."createdAt"
      FROM s JOIN "Customer" c ON c.id = s."customerId"
      WHERE s.balance > 1
      ORDER BY s."createdAt" ASC`,
  ]);

  type Row = {
    customerId: string;
    name: string;
    phone: string;
    locale: "EN" | "AR";
    owedUsdCents: number;
    dueOnPickupUsdCents: number;
    tickets: { id: string; number: number; status: string; balanceUsdCents: number }[];
    sales: { id: string; number: number; balanceUsdCents: number }[];
  };
  const byCustomer = new Map<string, Row>();
  const get = (id: string, name: string, phone: string, locale: "EN" | "AR") => {
    let row = byCustomer.get(id);
    if (!row) {
      row = { customerId: id, name, phone, locale, owedUsdCents: 0, dueOnPickupUsdCents: 0, tickets: [], sales: [] };
      byCustomer.set(id, row);
    }
    return row;
  };
  for (const t of tickets) {
    const row = get(t.customerId, t.name, t.phone, t.locale);
    const b = n(t.balance);
    row.tickets.push({ id: t.id, number: t.number, status: t.status, balanceUsdCents: b });
    if (t.status === "PICKED_UP") row.owedUsdCents += b;
    else row.dueOnPickupUsdCents += b;
  }
  for (const s of sales) {
    const row = get(s.customerId, s.name, s.phone, s.locale);
    const b = n(s.balance);
    row.sales.push({ id: s.id, number: s.number, balanceUsdCents: b });
    row.owedUsdCents += b;
  }
  const rows = [...byCustomer.values()].sort((a, b) => b.owedUsdCents - a.owedUsdCents || b.dueOnPickupUsdCents - a.dueOnPickupUsdCents);
  return {
    rows,
    totalOwedUsdCents: rows.reduce((s, r) => s + r.owedUsdCents, 0),
    totalDueOnPickupUsdCents: rows.reduce((s, r) => s + r.dueOnPickupUsdCents, 0),
  };
}
