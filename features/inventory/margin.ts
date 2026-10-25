/** Gross margin as a whole percent of the price, or null when price or cost is unknown. */
export function marginPercent(price: number, cost: number): number | null {
  if (price <= 0 || cost <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
}
