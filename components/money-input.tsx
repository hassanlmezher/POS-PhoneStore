"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { formatMoney, parseMoney, toLbp, lbpToUsdCents, type Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

type MoneyInputProps = Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  value: string;
  onValueChange: (v: string) => void;
  currency?: Currency;
  /** Shop exchange rate; when set, shows the other currency live under the input. */
  rate?: number;
  rounding?: number;
};

/** Money text input (decimal keypad) with a live conversion hint. Value stays a string; parse on the server. */
export function MoneyInput({ value, onValueChange, currency = "USD", rate, rounding, className, ...props }: MoneyInputProps) {
  const t = useTranslations("common");
  const parsed = value ? parseMoney(value, currency) : null;
  let hint: string | null = null;
  if (rate && parsed !== null) {
    hint = currency === "USD" ? formatMoney(toLbp(parsed, rate, rounding), "LBP") : formatMoney(lbpToUsdCents(parsed, rate), "USD");
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {currency === "USD" ? "$" : "LBP"}
        </span>
        <Input
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={cn("text-start tabular-nums", currency === "USD" ? "ps-7" : "ps-12", className)}
          {...props}
        />
      </div>
      {rate !== undefined && (
        <p className="min-h-4 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {hint && (
            <>
              ≈ <bdi dir="ltr">{hint}</bdi>
            </>
          )}
          {!hint && value && parsed === null && <span className="text-destructive">{t("invalidAmountHint")}</span>}
        </p>
      )}
    </div>
  );
}
