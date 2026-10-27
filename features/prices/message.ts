import { formatMoney, toLbp } from "@/lib/money";
import { fillTemplate } from "@/lib/whatsapp";

/** Built-in quote texts for one language (prices.quoteMessage.*), passed from the server for EN and AR. */
export type QuoteTexts = { body: string; line: string; total: string };

type QuoteVars = { shop: string; device: string | null; items: { service: string; usdCents: number }[]; rate: number; rounding: number };

/** WhatsApp quote: device, one line per repair with $ and LBP, and a total when there are several. */
export function quoteMessage(texts: QuoteTexts, v: QuoteVars): string {
  const money = (c: number) => ({ usd: formatMoney(c, "USD"), lbp: formatMoney(toLbp(c, v.rate, v.rounding), "LBP") });
  const lines = v.items.map((i) => fillTemplate(texts.line, { service: i.service, ...money(i.usdCents) }));
  if (v.items.length > 1) lines.push(fillTemplate(texts.total, money(v.items.reduce((s, i) => s + i.usdCents, 0))));
  const details = [v.device, ...lines].filter(Boolean).join("\n");
  return fillTemplate(texts.body, { shop: v.shop, details });
}
