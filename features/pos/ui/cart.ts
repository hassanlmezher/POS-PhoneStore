import { lbpToUsdCents, parseMoney, toLbp, type Currency } from "@/lib/money";
import type { PAYMENT_METHODS } from "@/features/tickets/schema";
import { changeDue, tenderedUsdCents } from "@/features/pos/money";

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ProductLine = {
  key: string;
  kind: "PRODUCT";
  productId: string;
  name: string;
  sku: string | null;
  unitPriceUsdCents: number;
  stock: number;
  qty: number;
  /** USD text, off the whole line. */
  discount: string;
};

export type TicketLine = {
  key: string;
  kind: "TICKET_BALANCE";
  ticketId: string;
  label: string;
  device: string;
  status: string;
  balanceUsdCents: number;
  /** USD text, defaults to the full balance. */
  amount: string;
  markPickedUp: boolean;
};

export type CartLine = ProductLine | TicketLine;

export type PaymentRow = { key: string; method: PaymentMethod; currency: Currency; amount: string; reference: string };

/** Empty → 0, invalid → null. */
export const usdOrZero = (s: string) => (s.trim() ? parseMoney(s, "USD") : 0);

export function lineTotal(l: CartLine): number | null {
  if (l.kind === "PRODUCT") {
    const d = usdOrZero(l.discount);
    return d === null ? null : l.unitPriceUsdCents * l.qty - d;
  }
  return l.amount.trim() ? parseMoney(l.amount, "USD") : null;
}

/** Live totals; mirrors the server's checkout math (features/pos/money.ts). */
export function cartTotals(lines: CartLine[], cartDiscount: string, payments: PaymentRow[], changeCurrency: Currency, rate: number, rounding: number) {
  const subtotal = lines.reduce((s, l) => s + Math.max(0, lineTotal(l) ?? 0), 0);
  const discount = Math.max(0, usdOrZero(cartDiscount) ?? 0);
  const total = Math.max(0, subtotal - discount);
  const valid = payments.flatMap((p) => {
    const amount = p.amount.trim() ? parseMoney(p.amount, p.currency) : null;
    return amount && amount > 0 ? [{ ...p, amount }] : [];
  });
  const tendered = tenderedUsdCents(valid, rate);
  const cash = tenderedUsdCents(
    valid.filter((p) => p.method === "CASH"),
    rate,
  );
  const change = changeDue(total, valid, changeCurrency, rate, rounding);
  return {
    subtotal,
    discount,
    total,
    tendered,
    // ±1 cent is LBP→cents rounding, not money owed (same rule as the server).
    remaining: total - tendered > 1 ? total - tendered : 0,
    change,
    over: Math.max(0, tendered - total),
    /** Change can only come out of cash. */
    overpaidNonCash: tendered - total > cash,
  };
}

/** LBP amount covering `usdCents`, rounded *up* to the shop's unit so it never falls short. */
export function lbpCovering(usdCents: number, rate: number, rounding: number): number {
  const exact = toLbp(usdCents, rate, 1);
  return Math.ceil(exact / rounding) * rounding;
}

export const centsToText = (c: number) => (c / 100).toFixed(2);

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Re-express a typed amount in another currency (LBP rounded up to the shop unit). */
export function convertAmount(text: string, from: Currency, to: Currency, rate: number, rounding: number): string {
  if (from === to) return text;
  const n = text.trim() ? parseMoney(text, from) : null;
  if (!n) return "";
  return to === "LBP" ? String(lbpCovering(n, rate, rounding)) : centsToText(lbpToUsdCents(n, rate));
}
