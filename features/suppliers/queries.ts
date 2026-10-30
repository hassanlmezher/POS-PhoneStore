import "server-only";
import type { ShopContext } from "@/lib/tenant";
import { suggestQty } from "./rules";

/** Every supplier with what the shop owes them (purchases − payments, USD cents), most owed first. */
export async function listSuppliers(ctx: ShopContext) {
  const [suppliers, bought, paid, last] = await Promise.all([
    ctx.db.supplier.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
    ctx.db.purchase.groupBy({ by: ["supplierId"], _sum: { totalUsdCents: true } }),
    ctx.db.supplierPayment.groupBy({ by: ["supplierId"], _sum: { usdCentsEquivalent: true } }),
    ctx.db.purchase.groupBy({ by: ["supplierId"], _max: { purchasedAt: true } }),
  ]);
  const b = new Map(bought.map((r) => [r.supplierId, r._sum.totalUsdCents ?? 0]));
  const p = new Map(paid.map((r) => [r.supplierId, r._sum.usdCentsEquivalent ?? 0]));
  const l = new Map(last.map((r) => [r.supplierId, r._max.purchasedAt]));
  return suppliers
    .map((s) => ({ ...s, owedUsdCents: (b.get(s.id) ?? 0) - (p.get(s.id) ?? 0), lastPurchase: l.get(s.id) ?? null }))
    .sort((a, b2) => b2.owedUsdCents - a.owedUsdCents || a.name.localeCompare(b2.name));
}
export type SupplierRow = Awaited<ReturnType<typeof listSuppliers>>[number];

/** One supplier: purchases and payments in one history (newest first) with the balance after each. */
export async function supplierDetail(ctx: ShopContext, id: string) {
  const supplier = await ctx.db.supplier.findFirst({ where: { id }, select: { id: true, name: true, phone: true, note: true } });
  if (!supplier) return null;
  const [purchases, payments] = await Promise.all([
    ctx.db.purchase.findMany({
      where: { supplierId: id },
      select: {
        id: true,
        reference: true,
        note: true,
        totalUsdCents: true,
        purchasedAt: true,
        createdAt: true,
        items: { select: { qty: true, unitCostUsdCents: true, product: { select: { name: true } } } },
      },
      take: 500,
    }),
    ctx.db.supplierPayment.findMany({
      where: { supplierId: id },
      select: { id: true, method: true, currency: true, amount: true, usdCentsEquivalent: true, paidAt: true, createdAt: true, note: true, purchaseId: true, cashMovementId: true },
      take: 500,
    }),
  ]);
  type Entry =
    | { kind: "purchase"; at: Date; created: Date; id: string; usdCents: number; data: (typeof purchases)[number] }
    | { kind: "payment"; at: Date; created: Date; id: string; usdCents: number; data: (typeof payments)[number] };
  const entries: Entry[] = [
    ...purchases.map((p) => ({ kind: "purchase" as const, at: p.purchasedAt, created: p.createdAt, id: p.id, usdCents: p.totalUsdCents, data: p })),
    ...payments.map((p) => ({ kind: "payment" as const, at: p.paidAt, created: p.createdAt, id: p.id, usdCents: p.usdCentsEquivalent, data: p })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || a.created.getTime() - b.created.getTime() || (a.kind === "purchase" ? -1 : 1));
  let balance = 0;
  const history = entries.map((e) => {
    balance += e.kind === "purchase" ? e.usdCents : -e.usdCents;
    return { ...e, balanceAfter: balance };
  });
  return {
    supplier,
    owedUsdCents: balance,
    boughtUsdCents: purchases.reduce((s, p) => s + p.totalUsdCents, 0),
    paidUsdCents: payments.reduce((s, p) => s + p.usdCentsEquivalent, 0),
    history: history.reverse(),
  };
}

/**
 * "What to order": low-stock products, the ones last bought from this supplier first,
 * with a suggested quantity (back up to twice the alert level).
 */
export async function reorderList(ctx: ShopContext, supplierId: string) {
  const [low, fromHere] = await Promise.all([
    ctx.db.$queryRaw<{ id: string; name: string; qty: number; threshold: number }[]>`
      SELECT id, name, qty, "lowStockThreshold" AS threshold FROM "Product"
      WHERE "shopId" = ${ctx.shop.id} AND active AND qty <= "lowStockThreshold"
      ORDER BY qty ASC, name ASC LIMIT 200`,
    ctx.db.purchaseItem.findMany({ where: { purchase: { supplierId } }, select: { productId: true }, distinct: ["productId"] }),
  ]);
  const mine = new Set(fromHere.map((r) => r.productId));
  return low
    .map((p) => ({ id: p.id, name: p.name, qty: p.qty, suggested: suggestQty(p.qty, p.threshold), fromSupplier: mine.has(p.id) }))
    .sort((a, b) => Number(b.fromSupplier) - Number(a.fromSupplier));
}
export type ReorderRow = Awaited<ReturnType<typeof reorderList>>[number];
