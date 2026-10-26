import "server-only";
import { getTranslations } from "next-intl/server";
import { trackUrl } from "@/features/tickets/notify";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { waLink } from "@/lib/whatsapp";

type Shop = {
  slug: string;
  name: string;
  ticketPrefix: string;
  exchangeRate: number;
  lbpRounding: number;
  storageFreeDays: number;
  storageFeeUsdCents: number;
};
type Ticket = {
  number: number;
  device: string;
  days: number;
  balanceUsdCents: number;
  trackToken: string;
  customer: { name: string; phone: string; locale: "EN" | "AR" };
};

/** wa.me link for pickup reminder `stage` (1 = day 3, 2 = day 14, 3 = day 30), in the customer's language. */
export async function pickupWhatsApp(shop: Shop, ticket: Ticket, stage: number): Promise<string> {
  const locale = ticket.customer.locale === "AR" ? "ar" : "en";
  const t = await getTranslations({ locale, namespace: "pickup" });
  const both = (usd: number) => `${formatMoney(usd, "USD")} (${formatMoney(toLbp(usd, shop.exchangeRate, shop.lbpRounding), "LBP")})`;
  const balance = ticket.balanceUsdCents > 0 ? `\n${t("waBalance", { balance: both(ticket.balanceUsdCents) })}` : "";
  const fee =
    stage > 1 && shop.storageFeeUsdCents > 0
      ? `\n${t("waFee", { free: shop.storageFreeDays, fee: formatMoney(shop.storageFeeUsdCents, "USD") })}`
      : "";
  const text = t(`wa${Math.min(3, Math.max(1, stage))}` as "wa1" | "wa2" | "wa3", {
    customer: ticket.customer.name,
    device: ticket.device,
    ticket: formatTicketNumber(shop.ticketPrefix, ticket.number),
    shop: shop.name,
    days: ticket.days,
    extra: balance + fee,
    link: trackUrl(shop.slug, ticket.trackToken),
  });
  return waLink(ticket.customer.phone, text);
}
