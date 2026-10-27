import "server-only";
import { getFormatter, getTranslations } from "next-intl/server";
import { warrantyUntil } from "@/features/tickets/money";
import { waLink } from "@/lib/whatsapp";

type Shop = { name: string; googleReviewUrl: string | null; timezone: string };
type Ticket = {
  device: string;
  pickedUpAt: Date | null;
  warrantyDays: number;
  customer: { name: string; phone: string; locale: "EN" | "AR" };
};

const localeOf = (t: Ticket) => (t.customer.locale === "AR" ? "ar" : "en");

/** Thank-you + Google review link, in the customer's language. Null when the shop has no review link. */
export async function reviewWhatsApp(shop: Shop, ticket: Ticket): Promise<string | null> {
  if (!shop.googleReviewUrl) return null;
  const t = await getTranslations({ locale: localeOf(ticket), namespace: "followups" });
  return waLink(ticket.customer.phone, t("waReview", { customer: ticket.customer.name, device: ticket.device, shop: shop.name, link: shop.googleReviewUrl }));
}

/** "How is your phone working?" a few days after pickup, with the warranty end date when there is one. */
export async function checkWhatsApp(shop: Shop, ticket: Ticket): Promise<string> {
  const locale = localeOf(ticket);
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "followups" }), getFormatter({ locale })]);
  const until = warrantyUntil(ticket);
  const warranty = until ? `\n${t("waWarranty", { date: format.dateTime(until, { dateStyle: "long", timeZone: shop.timezone }) })}` : "";
  return waLink(ticket.customer.phone, t("waCheck", { customer: ticket.customer.name, device: ticket.device, shop: shop.name, warranty }));
}
