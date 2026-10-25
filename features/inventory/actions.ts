"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { moveStock } from "@/lib/stock";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { adjustmentInput, productInput, type AdjustmentInput, type ProductInput } from "./schema";

export type InventoryResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function invalid(issues: { path: PropertyKey[]; message: string }[]): InventoryResult<never> {
  return {
    ok: false,
    error: "invalid",
    fieldErrors: Object.fromEntries(issues.map((i) => [i.path.map(String).join("."), i.message])),
  };
}

function uniqueError(e: unknown): InventoryResult<never> | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = String((e.meta?.target as string[] | string | undefined) ?? "");
    const field = target.includes("barcode") ? "barcode" : "sku";
    return { ok: false, error: "invalid", fieldErrors: { [field]: "duplicate" } };
  }
  return null;
}

/** Compatible models must be global or this shop's own. */
async function validModelIds(shopId: string, ids: string[]) {
  if (!ids.length) return [];
  const models = await prisma.deviceModel.findMany({
    where: { id: { in: ids }, OR: [{ shopId: null }, { shopId }] },
    select: { id: true },
  });
  return models;
}

export async function createProduct(input: ProductInput): Promise<InventoryResult<{ id: string }>> {
  const ctx = await requireActionShop("inventory.adjust");
  const parsed = productInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { cost, price, compatibleModelIds, initialQty, ...v } = parsed.data;
  const shopId = ctx.shop.id;
  const models = v.type === "PART" ? await validModelIds(shopId, compatibleModelIds) : [];

  try {
    const id = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...v,
          shopId,
          costUsdCents: cost,
          priceUsdCents: price,
          qty: 0,
          compatibleModels: { connect: models },
        },
        select: { id: true },
      });
      if (initialQty > 0) {
        await moveStock(tx, { shopId, productId: product.id, delta: initialQty, reason: "INITIAL", userId: ctx.user.id });
      }
      return product.id;
    });
    refreshShop();
    return { ok: true, id };
  } catch (e) {
    const err = uniqueError(e);
    if (err) return err;
    throw e;
  }
}

/** Edits product details. Quantity only changes through adjustments, sales and tickets. */
export async function updateProduct(id: string, input: ProductInput): Promise<InventoryResult> {
  const ctx = await requireActionShop("inventory.adjust");
  const parsed = productInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { cost, price, compatibleModelIds, initialQty, ...v } = parsed.data;
  void initialQty;
  const models = v.type === "PART" ? await validModelIds(ctx.shop.id, compatibleModelIds) : [];

  try {
    await ctx.db.product.update({
      where: { id },
      data: { ...v, costUsdCents: cost, priceUsdCents: price, compatibleModels: { set: models } },
    });
    refreshShop();
    return { ok: true };
  } catch (e) {
    const err = uniqueError(e);
    if (err) return err;
    throw e;
  }
}

export async function adjustStock(productId: string, input: AdjustmentInput): Promise<InventoryResult<{ qty: number }>> {
  const ctx = await requireActionShop("inventory.adjust");
  const parsed = adjustmentInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const product = await ctx.db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { ok: false, error: "notFound" };

  const qty = await prisma.$transaction((tx) =>
    moveStock(tx, {
      shopId: ctx.shop.id,
      productId,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
      note: parsed.data.note ?? undefined,
      userId: ctx.user.id,
    }),
  );
  refreshShop();
  return { ok: true, qty };
}

/** Model picker for "compatible models" (global + this shop's). */
export async function searchDeviceModels(q: string) {
  const ctx = await requireActionShop(undefined, { write: false });
  const term = q.trim();
  const words = term.split(/\s+/).filter(Boolean);
  return prisma.deviceModel.findMany({
    where: {
      OR: [{ shopId: null }, { shopId: ctx.shop.id }],
      AND: words.map((w) => ({
        OR: [
          { name: { contains: w, mode: "insensitive" as const } },
          { brand: { name: { contains: w, mode: "insensitive" as const } } },
        ],
      })),
    },
    select: { id: true, name: true, brand: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: 15,
  });
}
