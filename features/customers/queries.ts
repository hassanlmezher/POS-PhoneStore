import "server-only";
import type { TenantDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { phoneSearchDigits } from "@/lib/phone";
import { ticketBalance } from "@/features/tickets/money";
import { saleBalance } from "@/features/pos/money";

export const customerListSelect = {
  id: true,
  name: true,
  phone: true,
  locale: true,
  createdAt: true,
  _count: { select: { tickets: true } },
} satisfies Prisma.CustomerSelect;

/** Phone digits (any format) or name. Phone is the main lookup everywhere. */
export function customerSearchWhere(q: string): Prisma.CustomerWhereInput {
  const term = q.trim();
  if (!term) return {};
  const digits = phoneSearchDigits(term);
  const or: Prisma.CustomerWhereInput[] = [{ name: { contains: term, mode: "insensitive" } }];
  if (digits.length >= 3) {
    or.push({ phone: { contains: digits } }, { phoneAlt: { contains: digits } });
  }
  return { OR: or };
}

export async function searchCustomers(db: TenantDb, q: string, take = 8) {
  return db.customer.findMany({
    where: customerSearchWhere(q),
    select: { id: true, name: true, phone: true, locale: true },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export const CUSTOMERS_PAGE_SIZE = 25;

/**
 * Customers page list. With `owing` (customer id → USD cents owed), only those customers,
 * most owed first.
 */
export async function listCustomers(db: TenantDb, { q = "", page = 1, owing }: { q?: string; page?: number; owing?: Map<string, number> }) {
  if (owing) {
    const all = await db.customer.findMany({ where: { AND: [customerSearchWhere(q), { id: { in: [...owing.keys()] } }] }, select: customerListSelect });
    all.sort((a, b) => (owing.get(b.id) ?? 0) - (owing.get(a.id) ?? 0));
    return { rows: all.slice((page - 1) * CUSTOMERS_PAGE_SIZE, page * CUSTOMERS_PAGE_SIZE), total: all.length, pageSize: CUSTOMERS_PAGE_SIZE };
  }
  const where = customerSearchWhere(q);
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      select: customerListSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * CUSTOMERS_PAGE_SIZE,
      take: CUSTOMERS_PAGE_SIZE,
    }),
    db.customer.count({ where }),
  ]);
  return { rows, total, pageSize: CUSTOMERS_PAGE_SIZE };
}

/** Profile with repair history and balances. */
export async function getCustomer(db: TenantDb, id: string) {
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      tickets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          brandText: true,
          modelText: true,
          deviceModel: { select: { name: true, brand: { select: { name: true } } } },
          problem: true,
          createdAt: true,
          pickedUpAt: true,
          warrantyDays: true,
          estimateUsdCents: true,
          totalUsdCents: true,
          _count: { select: { items: true } },
          payments: { select: { usdCentsEquivalent: true } },
          saleItems: { where: { sale: { status: "COMPLETED" } }, select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true } },
        },
      },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          totalUsdCents: true,
          status: true,
          createdAt: true,
          changeAmount: true,
          changeCurrency: true,
          payments: { select: { usdCentsEquivalent: true, rate: true } },
          _count: { select: { items: true } },
        },
      },
    },
  });
  if (!customer) return null;

  const tickets = customer.tickets.map((t) => ({ ...t, balanceUsdCents: ticketBalance(t) }));
  const sales = customer.sales.map((s) => ({
    ...s,
    balanceUsdCents: s.status === "VOIDED" ? 0 : Math.max(0, saleBalance(s)),
  }));
  // Owed = balances on phones already handed over + unpaid sales. Open tickets are "due on pickup".
  const owedUsdCents =
    tickets.filter((t) => t.status === "PICKED_UP").reduce((s, t) => s + Math.max(0, t.balanceUsdCents), 0) +
    sales.reduce((s, x) => s + x.balanceUsdCents, 0);
  const dueOnPickupUsdCents = tickets
    .filter((t) => !["PICKED_UP", "CANCELLED"].includes(t.status))
    .reduce((s, t) => s + Math.max(0, t.balanceUsdCents), 0);

  return { ...customer, tickets, sales, owedUsdCents, dueOnPickupUsdCents };
}
