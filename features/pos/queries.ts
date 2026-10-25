import "server-only";
import type { TenantDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { phoneSearchDigits } from "@/lib/phone";
import { saleBalance } from "./money";

export const SALES_PAGE_SIZE = 30;

export async function listSales(db: TenantDb, { q = "", page = 1 }: { q?: string; page?: number }) {
  const term = q.trim();
  const digits = phoneSearchDigits(term);
  const where: Prisma.SaleWhereInput = term
    ? {
        OR: [
          ...(/^\d+$/.test(term) ? [{ number: Number(term) }] : []),
          { customer: { name: { contains: term, mode: "insensitive" } } },
          ...(digits.length >= 3 ? [{ customer: { phone: { contains: digits } } }] : []),
        ],
      }
    : {};
  page = Math.max(1, page);
  const [rows, total] = await Promise.all([
    db.sale.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        totalUsdCents: true,
        changeAmount: true,
        changeCurrency: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        cashier: { select: { name: true } },
        payments: { select: { method: true, usdCentsEquivalent: true, rate: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SALES_PAGE_SIZE,
      take: SALES_PAGE_SIZE,
    }),
    db.sale.count({ where }),
  ]);
  return {
    rows: rows.map((s) => ({ ...s, balanceUsdCents: s.status === "VOIDED" ? 0 : Math.max(0, saleBalance(s)) })),
    total,
    page,
    pageSize: SALES_PAGE_SIZE,
  };
}

export async function getSaleByNumber(db: TenantDb, number: number) {
  const sale = await db.sale.findFirst({
    where: { number },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      cashier: { select: { name: true } },
      items: { include: { ticket: { select: { number: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!sale) return null;
  return { ...sale, balanceUsdCents: sale.status === "VOIDED" ? 0 : Math.max(0, saleBalance(sale)) };
}
export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSaleByNumber>>>;
