import "server-only";
import { prisma } from "@/lib/db";
import { formatTicketNumber } from "@/lib/numbering";
import { getPlatformSettings } from "@/lib/platform";
import { fillTemplate } from "@/lib/whatsapp";
import { formatMoney, toLbp } from "@/lib/money";
import { ticketBalance } from "@/features/tickets/money";
import { deviceName } from "@/features/tickets/queries";

const cardSelect = {
  number: true,
  status: true,
  estimateUsdCents: true,
  totalUsdCents: true,
  promisedAt: true,
  patternEnc: true,
  brandText: true,
  modelText: true,
  deviceModel: { select: { name: true, brand: { select: { name: true } } } },
  customer: { select: { name: true, phone: true, locale: true } },
  items: { select: { kind: true, description: true, unitPriceUsdCents: true, qty: true }, orderBy: { createdAt: "asc" as const } },
  _count: { select: { items: true } },
  payments: { select: { usdCentsEquivalent: true } },
  saleItems: { where: { sale: { status: "COMPLETED" as const } }, select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true } },
};

/**
 * Live data from the showcase shop (PlatformSetting.showcaseShopSlug, a demo shop) for the landing
 * page's product preview. Returns null when no showcase shop is set, so nothing is invented.
 */
export async function getShowcaseData() {
  const platform = await getPlatformSettings();
  if (!platform.showcaseShopSlug) return null;
  const shop = await prisma.shop.findUnique({ where: { slug: platform.showcaseShopSlug } });
  if (!shop) return null;

  const [featured, ready, sale, readyTemplate] = await Promise.all([
    prisma.ticket.findFirst({
      where: { shopId: shop.id, status: { in: ["REPAIRING", "READY"] }, items: { some: {} } },
      select: cardSelect,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.ticket.findMany({
      where: { shopId: shop.id, status: "READY" },
      select: cardSelect,
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    prisma.sale.findFirst({
      where: { shopId: shop.id, status: "COMPLETED", items: { some: { kind: "PRODUCT" } } },
      include: { items: { select: { description: true, qty: true, unitPriceUsdCents: true, discountUsdCents: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.messageTemplate.findFirst({ where: { shopId: shop.id, key: "TICKET_READY" }, orderBy: { locale: "asc" } }),
  ]);

  const card = (t: NonNullable<typeof featured>) => {
    const { patternEnc, ...rest } = t;
    return {
      ...rest,
      label: formatTicketNumber(shop.ticketPrefix, t.number),
      device: deviceName(t),
      hasPattern: !!patternEnc,
      balanceUsdCents: Math.max(0, ticketBalance(t)),
    };
  };
  const featuredCard = featured ? card(featured) : null;
  const message =
    featuredCard && readyTemplate
      ? fillTemplate(readyTemplate.body, {
          customer: featuredCard.customer.name,
          device: featuredCard.device,
          ticket: featuredCard.label,
          balance: `${formatMoney(featuredCard.balanceUsdCents, "USD")} (${formatMoney(toLbp(featuredCard.balanceUsdCents, shop.exchangeRate, shop.lbpRounding), "LBP")})`,
          shop: shop.name,
          trackUrl: "",
        })
      : null;

  return {
    shop: {
      name: shop.name,
      exchangeRate: shop.exchangeRate,
      lbpRounding: shop.lbpRounding,
      countryCode: shop.countryCode,
      timezone: shop.timezone,
    },
    featured: featuredCard,
    ready: ready.map(card),
    sale: sale ? { number: sale.number, totalUsdCents: sale.totalUsdCents, items: sale.items } : null,
    readyMessage: message,
  };
}
export type ShowcaseData = NonNullable<Awaited<ReturnType<typeof getShowcaseData>>>;
