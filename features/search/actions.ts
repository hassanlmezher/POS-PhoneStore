"use server";

import { customerSearchWhere } from "@/features/customers/queries";
import { deviceName, ticketAccessWhere, ticketSearchWhere } from "@/features/tickets/queries";
import { formatTicketNumber } from "@/lib/numbering";
import { requireActionShop } from "@/lib/tenant";

/** Global search: phone, ticket number, IMEI, customer name, product name/SKU/barcode. */
export async function globalSearch(q: string) {
  const ctx = await requireActionShop(undefined, { write: false });
  const term = q.trim();
  if (term.length < 2) return { customers: [], tickets: [], products: [] };

  const [customers, tickets, products] = await Promise.all([
    ctx.db.customer.findMany({
      where: customerSearchWhere(term),
      select: { id: true, name: true, phone: true },
      take: 5,
    }),
    ctx.db.ticket.findMany({
      where: { AND: [ticketAccessWhere(ctx.user), ticketSearchWhere(term)] },
      select: {
        number: true,
        status: true,
        brandText: true,
        modelText: true,
        deviceModel: { select: { name: true, brand: { select: { name: true } } } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    ctx.db.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
          { barcode: term },
        ],
      },
      select: { id: true, name: true, qty: true, priceUsdCents: true },
      take: 5,
    }),
  ]);

  return {
    customers,
    tickets: tickets.map((t) => ({
      number: t.number,
      label: formatTicketNumber(ctx.shop.ticketPrefix, t.number),
      status: t.status,
      device: deviceName(t),
      customerName: t.customer.name,
    })),
    products,
  };
}
export type GlobalSearchResult = Awaited<ReturnType<typeof globalSearch>>;
