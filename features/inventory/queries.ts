import "server-only";
import { prisma, type TenantDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export function productSearchWhere(q: string): Prisma.ProductWhereInput {
  const term = q.trim();
  if (!term) return {};
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { barcode: term },
      { category: { contains: term, mode: "insensitive" } },
      { compatibleModels: { some: { name: { contains: term, mode: "insensitive" } } } },
    ],
  };
}

export const PRODUCTS_PAGE_SIZE = 30;

export type ProductFilters = {
  q?: string;
  type?: "ACCESSORY" | "PART";
  lowStock?: boolean;
  includeArchived?: boolean;
  page?: number;
};

/** Ids of products at or below their low-stock threshold (column-to-column compare needs SQL). */
async function lowStockIds(shopId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE "shopId" = ${shopId} AND active = true AND qty <= "lowStockThreshold"`;
  return rows.map((r) => r.id);
}

export async function listProducts(db: TenantDb, shopId: string, f: ProductFilters) {
  const page = Math.max(1, f.page ?? 1);
  const where: Prisma.ProductWhereInput = {
    AND: [
      productSearchWhere(f.q ?? ""),
      f.type ? { type: f.type } : {},
      f.includeArchived ? {} : { active: true },
      f.lowStock ? { id: { in: await lowStockIds(shopId) } } : {},
    ],
  };
  const [rows, total, lowStockCount] = await Promise.all([
    db.product.findMany({
      where,
      select: {
        id: true,
        type: true,
        name: true,
        sku: true,
        barcode: true,
        category: true,
        costUsdCents: true,
        priceUsdCents: true,
        qty: true,
        lowStockThreshold: true,
        active: true,
      },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * PRODUCTS_PAGE_SIZE,
      take: PRODUCTS_PAGE_SIZE,
    }),
    db.product.count({ where }),
    countLowStock(shopId),
  ]);
  return { rows, total, page, pageSize: PRODUCTS_PAGE_SIZE, lowStockCount };
}

export async function countLowStock(shopId: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "Product"
    WHERE "shopId" = ${shopId} AND active = true AND qty <= "lowStockThreshold"`;
  return Number(row?.n ?? 0);
}

export async function getProduct(db: TenantDb, id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      compatibleModels: { select: { id: true, name: true, brand: { select: { name: true } } } },
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: { select: { name: true } },
          sale: { select: { number: true } },
          ticketItem: { select: { ticket: { select: { number: true } } } },
        },
      },
    },
  });
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export async function listCategories(db: TenantDb): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category!).filter(Boolean);
}

/** Products for the label print page, in the order requested. */
export async function getProductsForLabels(db: TenantDb, ids: string[]) {
  const rows = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, sku: true, barcode: true, priceUsdCents: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r) => r !== undefined);
}
