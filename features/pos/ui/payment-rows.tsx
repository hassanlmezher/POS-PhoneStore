"use client";

import { useTranslations } from "next-intl";
import { Banknote, Plus, X } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PAYMENT_METHODS } from "@/features/tickets/schema";
import { formatMoney, type Currency } from "@/lib/money";
import { centsToText, convertAmount, lbpCovering, newKey, type cartTotals, type PaymentMethod, type PaymentRow } from "./cart";

type Props = {
  payments: PaymentRow[];
  onChange: (p: PaymentRow[]) => void;
  totals: ReturnType<typeof cartTotals>;
  rate: number;
  rounding: number;
};

/** Split payments: quick "exact cash" buttons, then any number of method/currency rows. */
export function PaymentRows({ payments, onChange, totals, rate, rounding }: Props) {
  const t = useTranslations("pos");
  const tm = useTranslations("paymentMethods");
  const due = totals.remaining;

  const amountFor = (currency: Currency) => (currency === "USD" ? centsToText(due) : String(lbpCovering(due, rate, rounding)));

  function add(currency: Currency, method: PaymentMethod = "CASH", amount = amountFor(currency)) {
    onChange([...payments, { key: newKey(), method, currency, amount: due > 0 ? amount : "", reference: "" }]);
  }
  const update = (key: string, patch: Partial<PaymentRow>) => onChange(payments.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">{t("payment")}</p>
      {due > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-auto min-h-12 flex-col gap-0 py-1.5" onClick={() => add("USD")}>
            <span className="flex items-center gap-1.5 text-sm">
              <Banknote className="size-4" />
              {t("exactUsd")}
            </span>
            <bdi dir="ltr" className="text-xs font-normal text-muted-foreground tabular-nums">
              {formatMoney(due, "USD")}
            </bdi>
          </Button>
          <Button type="button" variant="outline" className="h-auto min-h-12 flex-col gap-0 py-1.5" onClick={() => add("LBP")}>
            <span className="flex items-center gap-1.5 text-sm">
              <Banknote className="size-4" />
              {t("exactLbp")}
            </span>
            <bdi dir="ltr" className="text-xs font-normal text-muted-foreground tabular-nums">
              {formatMoney(lbpCovering(due, rate, rounding), "LBP")}
            </bdi>
          </Button>
        </div>
      )}

      {payments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {payments.map((p, i) => {
            const id = `pay-${p.key}`;
            return (
              <li key={p.key} className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-2.5">
                <div className="flex items-center gap-2">
                  <label htmlFor={`${id}-m`} className="sr-only">
                    {t("method")}
                  </label>
                  <NativeSelect
                    id={`${id}-m`}
                    wrapperClassName="min-w-0 flex-1"
                    value={p.method}
                    onChange={(e) => update(p.key, { method: e.target.value as PaymentMethod })}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {tm(m)}
                      </option>
                    ))}
                  </NativeSelect>
                  <Segmented
                    label={t("currency")}
                    value={p.currency}
                    onValueChange={(c) =>
                      update(p.key, {
                        currency: c,
                        // Convert what was typed so switching currency keeps the same value.
                        amount: convertAmount(p.amount, p.currency, c, rate, rounding),
                      })
                    }
                    options={[
                      { value: "USD", label: "USD" },
                      { value: "LBP", label: "LBP" },
                    ]}
                  />
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground" onClick={() => onChange(payments.filter((x) => x.key !== p.key))} aria-label={t("removePayment", { n: i + 1 })}>
                    <X />
                  </Button>
                </div>
                <label htmlFor={id} className="sr-only">
                  {t("amount")}
                </label>
                <MoneyInput
                  id={id}
                  autoFocus={i === payments.length - 1}
                  onFocus={(e) => e.currentTarget.select()}
                  value={p.amount}
                  onValueChange={(v) => update(p.key, { amount: v })}
                  currency={p.currency}
                  rate={rate}
                  rounding={rounding}
                  className="h-11"
                />
                {p.method !== "CASH" && (
                  <>
                    <label htmlFor={`${id}-r`} className="sr-only">
                      {t("reference")}
                    </label>
                    <Input
                      id={`${id}-r`}
                      dir="ltr"
                      autoComplete="off"
                      className="text-start"
                      placeholder={t("referencePlaceholder")}
                      value={p.reference}
                      onChange={(e) => update(p.key, { reference: e.target.value })}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Button type="button" variant="ghost" className="justify-start text-primary" onClick={() => add("USD")}>
        <Plus />
        {payments.length ? t("addAnotherPayment") : t("addPayment")}
      </Button>

      {totals.overpaidNonCash && <p className="text-xs text-destructive">{t("errors.overpaidNonCash")}</p>}
      {payments.length > 0 && totals.remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("remainingHint")}
        </p>
      )}
    </div>
  );
}
