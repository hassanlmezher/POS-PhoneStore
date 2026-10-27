"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { adjustInput, adjustPrice, priceInput, type AdjustInput, type PriceInput } from "./rules";

export type PriceResult = { ok: true; count?: number } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const idInput = z.string().min(1).max(64);

function invalid(issues: { path: PropertyKey[]; message: string }[]): PriceResult {
  return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message])) };
}

/** Adds a price, or updates it when `id` is set. One price per model + service. */
export async function savePrice(input: PriceInput, id?: string): Promise<PriceResult> {
  const ctx = await requireActionShop("prices.edit");
  const parsed = priceInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (id !== undefined && !idInput.safeParse(id).success) return { ok: false, error: "invalid" };
  const data = parsed.data;
  const shopId = ctx.shop.id;
  if (data.deviceModelId) {
    const model = await prisma.deviceModel.findFirst({
      where: { id: data.deviceModelId, OR: [{ shopId: null }, { shopId }] },
      select: { id: true },
    });
    if (!model) return { ok: false, error: "invalid", fieldErrors: { deviceModelId: "invalid" } };
  }
  try {
    if (id) {
      const res = await prisma.repairPrice.updateMany({ where: { id, shopId }, data });
      if (res.count === 0) return { ok: false, error: "notFound" };
    } else {
      await prisma.repairPrice.create({ data: { ...data, shopId } });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "duplicate", fieldErrors: { service: "duplicate" } };
    }
    throw e;
  }
  refreshShop();
  return { ok: true };
}

export async function deletePrice(id: string): Promise<PriceResult> {
  const ctx = await requireActionShop("prices.edit");
  if (!idInput.safeParse(id).success) return { ok: false, error: "invalid" };
  const res = await prisma.repairPrice.deleteMany({ where: { id, shopId: ctx.shop.id } });
  if (res.count === 0) return { ok: false, error: "notFound" };
  refreshShop();
  return { ok: true };
}

/** "Change all prices": +/- a percentage, rounded, for every price or one service. */
export async function adjustPrices(input: AdjustInput): Promise<PriceResult> {
  const ctx = await requireActionShop("prices.edit");
  const parsed = adjustInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { percent, step, service } = parsed.data;
  const shopId = ctx.shop.id;
  const count = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; priceUsdCents: number }[]>`
      SELECT id, "priceUsdCents" FROM "RepairPrice"
      WHERE "shopId" = ${shopId} AND (${service}::text IS NULL OR lower(service) = lower(${service}::text))
      FOR UPDATE`;
    for (const r of rows) {
      await tx.repairPrice.update({ where: { id: r.id, shopId }, data: { priceUsdCents: adjustPrice(r.priceUsdCents, percent, step) } });
    }
    return rows.length;
  });
  refreshShop();
  return { ok: true, count };
}
