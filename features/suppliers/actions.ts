"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { localNoon } from "@/lib/dates";
import { lockRows } from "@/lib/locks";
import { toUsdCents } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { moveStock } from "@/lib/stock";
import { refreshShop, requireActionShop, type ShopContext } from "@/lib/tenant";
import { averageCost, payInput, purchaseInput, supplierInput, type PayInput, type PurchaseInput, type SupplierInput } from "./rules";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string> };

const idInput = z.string().min(1).max(64);

function invalid(issues: { path: PropertyKey[]; message: string }[]): { ok: false; error: string; fieldErrors: Record<string, string> } {
  return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(issues.map((i) => [i.path.map(String).join("."), i.message])) };
}

export async function saveSupplier(input: SupplierInput, id?: string): Promise<Result<{ id: string }>> {
  const ctx = await requireActionShop("suppliers");
  const parsed = supplierInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const phone = v.phone ? normalizePhone(v.phone, ctx.shop.countryCode) : null;
  if (v.phone && !phone) return { ok: false, error: "invalid", fieldErrors: { phone: "invalidPhone" } };
  const shopId = ctx.shop.id;
  const clash = await ctx.db.supplier.findFirst({
    where: { name: { equals: v.name, mode: "insensitive" }, ...(id && { id: { not: id } }) },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "duplicate", fieldErrors: { name: "duplicate" } };
  if (id) {
    if (!idInput.safeParse(id).success) return { ok: false, error: "invalid" };
    const res = await prisma.supplier.updateMany({ where: { id, shopId }, data: { name: v.name, phone, note: v.note } });
    if (res.count === 0) return { ok: false, error: "notFound" };
    refreshShop();
    return { ok: true, id };
  }
  const s = await prisma.supplier.create({ data: { shopId, name: v.name, phone, note: v.note }, select: { id: true } });
  refreshShop();
  return { ok: true, id: s.id };
}

type Pay = z.output<typeof payInput>;

/**
 * Writes a supplier payment (and its drawer pay-out when paid in cash from the drawer).
 * Money back from the supplier is a negative payment and goes into the drawer instead.
 */
async function writePayment(tx: Prisma.TransactionClient, ctx: ShopContext, supplier: { id: string; name: string }, p: Pay, purchaseId: string | null) {
  const shopId = ctx.shop.id;
  let cashMovementId: string | null = null;
  const sign = p.refund ? -1 : 1;
  if (p.fromDrawer) {
    const session = await tx.cashSession.findFirst({ where: { shopId, closedAt: null }, select: { id: true } });
    if (!session) return false;
    await lockRows(tx, "CashSession", shopId, [session.id]);
    const t = await getTranslations("suppliers");
    const mv = await tx.cashMovement.create({
      data: { shopId, cashSessionId: session.id, type: p.refund ? "PAY_IN" : "PAY_OUT", currency: p.currency, amount: p.amount, reason: t(p.refund ? "drawerRefundReason" : "drawerReason", { name: supplier.name }).slice(0, 200), userId: ctx.user.id },
    });
    cashMovementId = mv.id;
  }
  await tx.supplierPayment.create({
    data: {
      shopId,
      supplierId: supplier.id,
      purchaseId,
      method: p.method,
      currency: p.currency,
      amount: sign * p.amount,
      rate: ctx.shop.exchangeRate,
      usdCentsEquivalent: sign * toUsdCents(p.amount, p.currency, ctx.shop.exchangeRate),
      paidAt: localNoon(p.day, ctx.shop.timezone),
      note: p.note,
      cashMovementId,
      userId: ctx.user.id,
    },
  });
  return true;
}

class NoDrawer extends Error {}
class DuplicateBarcode extends Error {
  constructor(public line: number) {
    super();
  }
}

/**
 * Records stock bought from a supplier: every line goes into stock (RESTOCK) and the product's cost
 * becomes the average of what was in stock and what was bought. An optional "paid now" part is a payment.
 */
export async function createPurchase(input: PurchaseInput): Promise<Result<{ id: string }>> {
  const ctx = await requireActionShop("suppliers");
  const parsed = purchaseInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const shopId = ctx.shop.id;
  const supplier = await ctx.db.supplier.findFirst({ where: { id: v.supplierId }, select: { id: true, name: true } });
  if (!supplier) return { ok: false, error: "notFound" };
  if (v.paid?.refund) return { ok: false, error: "invalid" };
  const productIds = [...new Set(v.items.flatMap((i) => (i.productId ? [i.productId] : [])))];
  const products = await ctx.db.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
  if (products.length !== productIds.length) return { ok: false, error: "invalid" };
  const t = await getTranslations("suppliers");

  try {
    const id = await prisma.$transaction(async (tx) => {
      const total = v.items.reduce((s, i) => s + i.qty * i.unitCostUsdCents, 0);
      // New products are created first (no stock, no cost); the restock below sets both.
      const ids: string[] = [];
      for (const [n, i] of v.items.entries()) {
        if (i.productId) {
          ids.push(i.productId);
          continue;
        }
        const np = i.newProduct!;
        if (np.barcode && (await tx.product.findFirst({ where: { shopId, barcode: np.barcode }, select: { id: true } }))) throw new DuplicateBarcode(n);
        const created = await tx.product.create({
          data: { shopId, type: np.type, name: np.name, category: np.category, barcode: np.barcode, priceUsdCents: np.priceUsdCents, costUsdCents: 0, qty: 0 },
          select: { id: true },
        });
        ids.push(created.id);
      }
      const purchase = await tx.purchase.create({
        data: {
          shopId,
          supplierId: supplier.id,
          reference: v.reference,
          note: v.note,
          totalUsdCents: total,
          purchasedAt: localNoon(v.day, ctx.shop.timezone),
          userId: ctx.user.id,
          items: { create: v.items.map((i, n) => ({ shopId, productId: ids[n], qty: i.qty, unitCostUsdCents: i.unitCostUsdCents })) },
        },
        select: { id: true },
      });
      for (const [n, item] of v.items.entries()) {
        const i = { ...item, productId: ids[n] };
        // Row lock on the product so two purchases at once both count in the average.
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${i.productId} AND "shopId" = ${shopId} FOR UPDATE`;
        const p = await tx.product.findUniqueOrThrow({ where: { id: i.productId, shopId }, select: { qty: true, costUsdCents: true } });
        await tx.product.update({ where: { id: i.productId, shopId }, data: { costUsdCents: averageCost(p.qty, p.costUsdCents, i.qty, i.unitCostUsdCents) } });
        await moveStock(tx, { shopId, productId: i.productId, delta: i.qty, reason: "RESTOCK", userId: ctx.user.id, note: t("stockNote", { name: supplier.name }) });
      }
      if (v.paid && !(await writePayment(tx, ctx, supplier, v.paid, purchase.id))) throw new NoDrawer();
      return purchase.id;
    });
    refreshShop();
    return { ok: true, id };
  } catch (e) {
    if (e instanceof NoDrawer) return { ok: false, error: "noOpenDrawer" };
    if (e instanceof DuplicateBarcode) return { ok: false, error: "invalid", fieldErrors: { [`items.${e.line}.newProduct.barcode`]: "duplicate" } };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "invalid", fieldErrors: { items: "duplicate" } };
    throw e;
  }
}

/** Removes a purchase: its items leave stock again and its "paid now" payments go too. Costs stay as they are. */
export async function deletePurchase(id: string): Promise<Result> {
  const ctx = await requireActionShop("suppliers");
  if (!idInput.safeParse(id).success) return { ok: false, error: "invalid" };
  const shopId = ctx.shop.id;
  const purchase = await ctx.db.purchase.findFirst({
    where: { id },
    select: { id: true, supplier: { select: { name: true } }, items: { select: { productId: true, qty: true } }, payments: { select: { id: true } } },
  });
  if (!purchase) return { ok: false, error: "notFound" };
  const t = await getTranslations("suppliers");
  await prisma.$transaction(async (tx) => {
    for (const p of purchase.payments) await removePayment(tx, shopId, p.id);
    for (const i of purchase.items) {
      await moveStock(tx, { shopId, productId: i.productId, delta: -i.qty, reason: "ADJUSTMENT", userId: ctx.user.id, note: t("deletedNote", { name: purchase.supplier.name }) });
    }
    await tx.purchase.delete({ where: { id: purchase.id, shopId } });
  });
  refreshShop();
  return { ok: true };
}

export async function paySupplier(supplierId: string, input: PayInput): Promise<Result> {
  const ctx = await requireActionShop("suppliers");
  const parsed = payInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!idInput.safeParse(supplierId).success) return { ok: false, error: "invalid" };
  const supplier = await ctx.db.supplier.findFirst({ where: { id: supplierId }, select: { id: true, name: true } });
  if (!supplier) return { ok: false, error: "notFound" };
  const ok = await prisma.$transaction((tx) => writePayment(tx, ctx, supplier, parsed.data, null));
  if (!ok) return { ok: false, error: "noOpenDrawer" };
  refreshShop();
  return { ok: true };
}

/** Deletes a payment; its drawer pay-out goes too while that drawer is still open. */
async function removePayment(tx: Prisma.TransactionClient, shopId: string, id: string) {
  const p = await tx.supplierPayment.findFirst({ where: { id, shopId }, select: { cashMovement: { select: { id: true, cashSessionId: true } } } });
  if (!p) return false;
  await tx.supplierPayment.delete({ where: { id, shopId } });
  if (p.cashMovement) {
    await lockRows(tx, "CashSession", shopId, [p.cashMovement.cashSessionId]);
    await tx.cashMovement.deleteMany({ where: { id: p.cashMovement.id, shopId, cashSession: { closedAt: null } } });
  }
  return true;
}

export async function deleteSupplierPayment(id: string): Promise<Result> {
  const ctx = await requireActionShop("suppliers");
  if (!idInput.safeParse(id).success) return { ok: false, error: "invalid" };
  const ok = await prisma.$transaction((tx) => removePayment(tx, ctx.shop.id, id));
  if (!ok) return { ok: false, error: "notFound" };
  refreshShop();
  return { ok: true };
}

/** Product search for the purchase form: name, SKU or barcode. */
export async function searchStock(q: string) {
  const ctx = await requireActionShop("suppliers", { write: false });
  const term = typeof q === "string" ? q.trim().slice(0, 60) : "";
  if (!term) return [];
  return ctx.db.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { sku: { equals: term, mode: "insensitive" } },
        { barcode: term },
      ],
    },
    select: { id: true, name: true, sku: true, qty: true, costUsdCents: true },
    orderBy: { name: "asc" },
    take: 8,
  });
}
