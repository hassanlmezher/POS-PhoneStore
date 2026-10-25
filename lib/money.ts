// Money is always an integer: USD in cents, LBP in whole pounds.
export type Currency = "USD" | "LBP";

/** USD cents → LBP at `rate` (LBP per 1 USD), rounded to `rounding` pounds. */
export function toLbp(usdCents: number, rate: number, rounding = 1): number {
  const lbp = (usdCents * rate) / 100;
  return Math.round(lbp / rounding) * rounding;
}

/** LBP → USD cents at `rate`. */
export function lbpToUsdCents(lbp: number, rate: number): number {
  return Math.round((lbp * 100) / rate);
}

/** Any amount → USD cents equivalent. */
export function toUsdCents(amount: number, currency: Currency, rate: number): number {
  return currency === "USD" ? amount : lbpToUsdCents(amount, rate);
}

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
const lbpFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Format an integer amount. Latin digits in both locales (shops use them on receipts). */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "USD") return usdFormat.format(amount / 100);
  return `${lbpFormat.format(amount)} LBP`;
}

/**
 * Parse user input ("12.5", "1,250,000") into an integer amount.
 * Returns null for invalid input.
 */
export function parseMoney(input: string, currency: Currency): number | null {
  const clean = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  if (currency === "LBP") return Math.round(Number(clean));
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
