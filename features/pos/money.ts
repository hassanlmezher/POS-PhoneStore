// Checkout math (pure; used by the POS screen for live totals and by the server to verify).
import { toLbp, toUsdCents, type Currency } from "@/lib/money";

export type TenderedPayment = { currency: Currency; amount: number };

/** Sum of payments in USD cents at the given rate. */
export function tenderedUsdCents(payments: TenderedPayment[], rate: number): number {
  return payments.reduce((s, p) => s + toUsdCents(p.amount, p.currency, rate), 0);
}

/**
 * Change due when the customer overpays, in the chosen currency.
 * LBP change is computed in pounds (no detour through cents, which would lose up to ~1 cent
 * per conversion) and rounded down to the shop's rounding unit: never give back more than owed.
 */
export function changeDue(
  totalUsdCents: number,
  payments: TenderedPayment[],
  currency: Currency,
  rate: number,
  lbpRounding: number,
) {
  if (currency === "USD") return Math.max(0, tenderedUsdCents(payments, rate) - totalUsdCents);
  const tenderedLbp = payments.reduce((s, p) => s + (p.currency === "LBP" ? p.amount : toLbp(p.amount, rate)), 0);
  const overLbp = tenderedLbp - toLbp(totalUsdCents, rate);
  return overLbp > 0 ? Math.floor(overLbp / lbpRounding) * lbpRounding : 0;
}

/** What the sale still owes after payments and change. */
export function saleBalance(sale: {
  totalUsdCents: number;
  changeAmount: number;
  changeCurrency: Currency | null;
  payments: { usdCentsEquivalent: number; rate: number }[];
}): number {
  const paid = sale.payments.reduce((s, p) => s + p.usdCentsEquivalent, 0);
  const rate = sale.payments[0]?.rate ?? 1;
  const change = sale.changeCurrency ? toUsdCents(sale.changeAmount, sale.changeCurrency, rate) : 0;
  const balance = sale.totalUsdCents - (paid - change);
  return balance > 1 ? balance : 0; // ±1 cent is LBP→cents rounding, not a debt
}
