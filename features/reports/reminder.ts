import "server-only";
import { trackUrl } from "@/features/tickets/notify";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { fillTemplate, waLink } from "@/lib/whatsapp";
import type { outstandingBalances } from "./queries";

type BalanceRow = Awaited<ReturnType<typeof outstandingBalances>>["rows"][number];
type ShopInfo = { name: string; slug: string; ticketPrefix: string; exchangeRate: number; lbpRounding: number };

/** WhatsApp balance reminder for one customer: what they owe now, else what's due at pickup. */
export function balanceReminderLink(shop: ShopInfo, r: BalanceRow, templates: { locale: string; body: string }[]): string | null {
  const body = templates.find((x) => x.locale === r.locale)?.body ?? templates[0]?.body;
  if (!body) return null;
  const amount = r.owedUsdCents > 0 ? r.owedUsdCents : r.dueOnPickupUsdCents;
  const refs = [
    ...r.tickets.filter((x) => (r.owedUsdCents > 0 ? x.status === "PICKED_UP" : true)).map((x) => formatTicketNumber(shop.ticketPrefix, x.number)),
    ...(r.owedUsdCents > 0 ? r.sales.map((s) => `#${s.number}`) : []),
  ];
  const first = r.tickets[0] ? formatTicketNumber(shop.ticketPrefix, r.tickets[0].number) : "";
  return waLink(
    r.phone,
    fillTemplate(body, {
      customer: r.name,
      ticket: refs.join(", "),
      device: "",
      balance: `${formatMoney(amount, "USD")} (${formatMoney(toLbp(amount, shop.exchangeRate, shop.lbpRounding), "LBP")})`,
      shop: shop.name,
      trackUrl: first ? trackUrl(shop.slug, first) : "",
    }),
  );
}
