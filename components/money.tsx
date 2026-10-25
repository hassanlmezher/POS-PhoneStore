import { formatMoney, toLbp } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneyProps = {
  /** Amount in USD cents (integer). */
  usdCents: number;
  /** Shop exchange rate, LBP per 1 USD. */
  rate: number;
  /** LBP rounding step in pounds (e.g. 1000). */
  rounding?: number;
  /** `stacked`: LBP under USD (cards, totals). `inline`: side by side (tables, lines). */
  layout?: "stacked" | "inline";
  className?: string;
  usdClassName?: string;
  lbpClassName?: string;
};

/** Dual-currency amount: USD primary, LBP secondary. Always use this to show money. */
export function Money({ usdCents, rate, rounding, layout = "stacked", className, usdClassName, lbpClassName }: MoneyProps) {
  const usd = formatMoney(usdCents, "USD");
  const lbp = formatMoney(toLbp(usdCents, rate, rounding), "LBP");
  return (
    <span
      dir="ltr"
      className={cn(
        "inline-flex tabular-nums",
        layout === "stacked" ? "flex-col items-start rtl:items-end" : "flex-wrap items-baseline gap-x-2",
        className,
      )}
    >
      <span className={cn("font-semibold text-foreground", usdClassName)}>{usd}</span>
      <span className={cn("text-[0.8em] font-normal text-muted-foreground", lbpClassName)}>{lbp}</span>
    </span>
  );
}
