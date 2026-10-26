import "server-only";
import { getTranslations } from "next-intl/server";
import { shopOrigin } from "@/lib/hosts";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { waLink } from "@/lib/whatsapp";

type Shop = { slug: string; name: string; ticketPrefix: string; exchangeRate: number; lbpRounding: number };
type Customer = { name: string; phone: string; locale: "EN" | "AR" };

/** Public page where the customer approves or declines. Opens in the customer's language. */
export function approvalUrl(slug: string, token: string, locale: "EN" | "AR"): string {
  return `${shopOrigin(slug)}/approve/${token}?lang=${locale.toLowerCase()}`;
}

/** wa.me link with the approval message in the customer's language. */
export async function approvalWhatsApp(
  shop: Shop,
  customer: Customer,
  ticket: { number: number; device: string },
  approval: { token: string; amountUsdCents: number; reason: string },
): Promise<{ url: string; link: string }> {
  const locale = customer.locale === "AR" ? "ar" : "en";
  const t = await getTranslations({ locale, namespace: "approval" });
  const link = approvalUrl(shop.slug, approval.token, customer.locale);
  const price = `${formatMoney(approval.amountUsdCents, "USD")} (${formatMoney(toLbp(approval.amountUsdCents, shop.exchangeRate, shop.lbpRounding), "LBP")})`;
  const text = t("waMessage", {
    customer: customer.name,
    device: ticket.device,
    ticket: formatTicketNumber(shop.ticketPrefix, ticket.number),
    reason: approval.reason,
    price,
    shop: shop.name,
    link,
  });
  return { url: waLink(customer.phone, text), link };
}
