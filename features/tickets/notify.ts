import "server-only";
import type { TemplateKey } from "@/lib/generated/prisma/client";
import { ROOT_DOMAIN } from "@/lib/hosts";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import type { ShopContext } from "@/lib/tenant";
import { fillTemplate, waLink } from "@/lib/whatsapp";
import type { TicketDetail } from "./queries";

/** Public status page for a ticket (Phase 5). Phone is asked on the page, never put in the URL. */
export function trackUrl(slug: string, ticketLabel: string): string {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${slug}.${ROOT_DOMAIN}/track?t=${encodeURIComponent(ticketLabel)}`;
}

/** Status → the template that fits it best, so the main button sends the right message. */
export const SUGGESTED_TEMPLATE: Partial<Record<TicketDetail["status"], TemplateKey>> = {
  RECEIVED: "TICKET_RECEIVED",
  DIAGNOSING: "TICKET_RECEIVED",
  REPAIRING: "TICKET_RECEIVED",
  WAITING_PART: "TICKET_WAITING_PART",
  READY: "TICKET_READY",
  CANT_FIX: "TICKET_CANT_FIX",
  PICKED_UP: "BALANCE_REMINDER",
};

/** Suggested template, skipping the balance reminder when nothing is owed. */
export function suggestedTemplate(status: TicketDetail["status"], balanceUsdCents: number): TemplateKey | undefined {
  const key = SUGGESTED_TEMPLATE[status];
  return key === "BALANCE_REMINDER" && balanceUsdCents <= 0 ? undefined : key;
}

/** wa.me links for every template, in the customer's language. Built at render time. */
export async function ticketWhatsAppLinks(ctx: ShopContext, ticket: TicketDetail) {
  const templates = await ctx.db.messageTemplate.findMany({ where: { locale: ticket.customer.locale } });
  const label = formatTicketNumber(ctx.shop.ticketPrefix, ticket.number);
  const balance = Math.max(0, ticket.balanceUsdCents);
  const vars = {
    customer: ticket.customer.name,
    device: ticket.device,
    ticket: label,
    balance: `${formatMoney(balance, "USD")} (${formatMoney(toLbp(balance, ctx.shop.exchangeRate, ctx.shop.lbpRounding), "LBP")})`,
    shop: ctx.shop.name,
    trackUrl: trackUrl(ctx.shop.slug, label),
  };
  return templates.map((t) => ({
    key: t.key,
    text: fillTemplate(t.body, vars),
    url: waLink(ticket.customer.phone, fillTemplate(t.body, vars)),
  }));
}
