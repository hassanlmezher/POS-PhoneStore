import "server-only";
import { getFormatter, getTranslations } from "next-intl/server";
import { trackUrl } from "@/features/tickets/notify";
import { deviceName, ticketAccessWhere } from "@/features/tickets/queries";
import { addDays, dayKey } from "@/lib/dates";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatTicketNumber } from "@/lib/numbering";
import type { ShopContext } from "@/lib/tenant";
import { waLink } from "@/lib/whatsapp";

const select = {
  id: true,
  part: true,
  qty: true,
  supplierName: true,
  supplierPhone: true,
  costUsdCents: true,
  status: true,
  expectedAt: true,
  arrivedAt: true,
  supplierSentAt: true,
  customerToldAt: true,
  note: true,
  ticket: {
    select: {
      id: true,
      number: true,
      trackToken: true,
      brandText: true,
      modelText: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
      customer: { select: { name: true, phone: true, locale: true } },
    },
  },
} satisfies Prisma.PartOrderSelect;
type OrderRow = Prisma.PartOrderGetPayload<{ select: typeof select }>;

/** Compact row for the client lists, with the two wa.me links already written. */
export type PartOrderRow = Awaited<ReturnType<typeof toRows>>[number];

async function toRows(ctx: ShopContext, orders: OrderRow[]) {
  const { shop } = ctx;
  const tz = shop.timezone;
  const today = dayKey(new Date(), tz);
  const shopLocale = shop.defaultLocale === "AR" ? "ar" : "en";
  const tr = {
    en: { t: await getTranslations({ locale: "en", namespace: "partOrders" }), f: await getFormatter({ locale: "en" }) },
    ar: { t: await getTranslations({ locale: "ar", namespace: "partOrders" }), f: await getFormatter({ locale: "ar" }) },
  };
  const day = (d: Date, locale: "en" | "ar") => tr[locale].f.dateTime(d, { weekday: "long", day: "numeric", month: "long", timeZone: tz });

  return orders.map((o) => {
    const device = deviceName(o.ticket);
    const label = formatTicketNumber(shop.ticketPrefix, o.ticket.number);
    const expectedDay = dayKey(o.expectedAt, tz);
    const custLocale = o.ticket.customer.locale === "AR" ? "ar" : "en";
    const supplierText = tr[shopLocale].t("waSupplier", {
      supplier: o.supplierName,
      shop: shop.name,
      qty: o.qty,
      part: o.part,
      device,
      date: day(o.expectedAt, shopLocale),
    });
    const customerText = tr[custLocale].t("waCustomer", {
      customer: o.ticket.customer.name,
      shop: shop.name,
      device,
      ticket: label,
      date: day(o.expectedAt, custLocale),
      link: trackUrl(shop.slug, o.ticket.trackToken),
    });
    return {
      id: o.id,
      ticketId: o.ticket.id,
      ticketNumber: o.ticket.number,
      ticketLabel: label,
      device,
      customer: o.ticket.customer.name,
      part: o.part,
      qty: o.qty,
      supplierName: o.supplierName,
      supplierPhone: o.supplierPhone,
      costUsdCents: o.costUsdCents,
      note: o.note,
      status: o.status,
      expectedDay,
      /** today | tomorrow | late | later */
      when: (expectedDay < today ? "late" : expectedDay === today ? "today" : expectedDay === addDays(today, 1) ? "tomorrow" : "later") as
        | "late"
        | "today"
        | "tomorrow"
        | "later",
      arrivedAt: o.arrivedAt?.toISOString() ?? null,
      supplierSent: !!o.supplierSentAt,
      customerTold: !!o.customerToldAt,
      supplierUrl: o.supplierPhone ? waLink(o.supplierPhone, supplierText) : null,
      customerUrl: o.ticket.customer.phone ? waLink(o.ticket.customer.phone, customerText) : null,
    };
  });
}

/** Parts still coming (late first, then by expected day), or parts that arrived in the last 30 days. */
export async function listPartOrders(ctx: ShopContext, view: "waiting" | "arrived") {
  const where: Prisma.PartOrderWhereInput =
    view === "waiting"
      ? { status: "ORDERED", ticket: ticketAccessWhere(ctx.user) }
      : { status: "ARRIVED", arrivedAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, ticket: ticketAccessWhere(ctx.user) };
  const orders = await ctx.db.partOrder.findMany({
    where,
    select,
    orderBy: view === "waiting" ? [{ expectedAt: "asc" }, { createdAt: "asc" }] : { arrivedAt: "desc" },
    take: 300,
  });
  return toRows(ctx, orders);
}

/** All orders of one repair (any status), newest first. */
export async function ticketPartOrders(ctx: ShopContext, ticketId: string) {
  const orders = await ctx.db.partOrder.findMany({ where: { ticketId }, select, orderBy: { createdAt: "desc" } });
  return toRows(ctx, orders);
}

/** Parts still coming, and how many are late (for the Repairs page button). */
export async function partOrderCounts(ctx: ShopContext) {
  const todayStart = new Date(`${dayKey(new Date(), ctx.shop.timezone)}T00:00:00Z`);
  const base = { status: "ORDERED" as const, ticket: ticketAccessWhere(ctx.user) };
  const [waiting, late] = await Promise.all([
    ctx.db.partOrder.count({ where: base }),
    // Expected days are stored at local noon, so "before today 00:00 UTC" is any day before today.
    ctx.db.partOrder.count({ where: { ...base, expectedAt: { lt: todayStart } } }),
  ]);
  return { waiting, late };
}

/** Suppliers used before (name → last phone), to fill the order form quickly. */
export async function knownSuppliers(ctx: ShopContext) {
  const rows = await ctx.db.partOrder.findMany({
    select: { supplierName: true, supplierPhone: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const map = new Map<string, { name: string; phone: string | null }>();
  for (const r of rows) {
    const k = r.supplierName.toLowerCase();
    if (!map.has(k)) map.set(k, { name: r.supplierName, phone: r.supplierPhone });
  }
  return [...map.values()];
}
