import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type StockState = "out" | "low" | "ok";

export function stockState(qty: number, threshold: number): StockState {
  if (qty <= 0) return "out";
  if (qty <= threshold) return "low";
  return "ok";
}

const tones: Record<StockState, string> = {
  out: "text-destructive",
  low: "text-warning",
  ok: "text-foreground",
};

/** Stock quantity, red when out (≤ 0), amber at or below the low-stock threshold. */
export function StockLevel({
  qty,
  threshold,
  showLabel = true,
  className,
}: {
  qty: number;
  threshold: number;
  /** Adds "Low" / "Out" next to the number. */
  showLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("stock");
  const state = stockState(qty, threshold);
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium tabular-nums", tones[state], className)}>
      <bdi dir="ltr">{qty}</bdi>
      {showLabel && state !== "ok" && (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium",
            state === "out" ? "bg-destructive-soft" : "bg-warning-soft",
          )}
        >
          {t(state)}
        </span>
      )}
    </span>
  );
}
