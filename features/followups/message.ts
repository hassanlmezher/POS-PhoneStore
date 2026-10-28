import "server-only";
import { getFormatter, getTranslations } from "next-intl/server";
import { warrantyUntil } from "@/features/tickets/money";
import { waLink } from "@/lib/whatsapp";

type Shop = { name: string; timezone: string };
type Ticket = {
  device: string;
  pickedUpAt: Date | null;
  warrantyDays: number;
  customer: { name: string; phone: string; locale: "EN" | "AR" };
};

/** "How is your phone working?" a few days after pickup, with the warranty end date when there is one. */
export async function checkWhatsApp(shop: Shop, ticket: Ticket): Promise<string> {
  const locale = ticket.customer.locale === "AR" ? "ar" : "en";
  const [t, format] = await Promise.all([getTranslations({ locale, namespace: "followups" }), getFormatter({ locale })]);
  const until = warrantyUntil(ticket);
  const warranty = until ? `\n${t("waWarranty", { date: format.dateTime(until, { dateStyle: "long", timeZone: shop.timezone }) })}` : "";
  return waLink(ticket.customer.phone, t("waCheck", { customer: ticket.customer.name, device: ticket.device, shop: shop.name, warranty }));
}
