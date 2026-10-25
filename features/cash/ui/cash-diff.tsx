import { useTranslations } from "next-intl";
import { formatMoney, type Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Signed amount formatted with an explicit + / − sign. */
export function signedMoney(amount: number, currency: Currency): string {
  if (amount === 0) return formatMoney(0, currency);
  return `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount), currency)}`;
}

/** Tone for a counted − expected difference: exact = success, over = warning, short = destructive. */
export function diffTone(diff: number) {
  return diff === 0 ? "success" : diff > 0 ? "warning" : "destructive";
}

const toneClass = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  destructive: "bg-destructive-soft text-destructive",
} as const;

/** Drawer difference pill: "Balanced" / "+$2.00 over" / "−50,000 LBP short". */
export function CashDiff({ diff, currency, className }: { diff: number; currency: Currency; className?: string }) {
  const t = useTranslations("cash");
  const tone = diffTone(diff);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone], className)}>
      {diff === 0 ? (
        t("balanced")
      ) : (
        <>
          <bdi dir="ltr" className="tabular-nums">
            {signedMoney(diff, currency)}
          </bdi>
          {diff > 0 ? t("over") : t("short")}
        </>
      )}
    </span>
  );
}
