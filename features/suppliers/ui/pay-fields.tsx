"use client";

import { useTranslations } from "next-intl";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { PAY_METHODS } from "@/features/suppliers/rules";
import { lbpToUsdCents, parseMoney, toLbp } from "@/lib/money";

export type PayState = { amount: string; currency: "USD" | "LBP"; method: (typeof PAY_METHODS)[number]; fromDrawer: boolean };

type Props = {
  idPrefix: string;
  value: PayState;
  onChange: (v: PayState) => void;
  error?: string;
  drawerOpen: boolean;
  rate: number;
  rounding: number;
  label: string;
  optional?: boolean;
};

/** Amount (USD/LBP) + method + "from the cash drawer", shared by "Pay supplier" and "paid now" on a purchase. */
export function PayFields({ idPrefix, value: v, onChange, error, drawerOpen, rate, rounding, label, optional }: Props) {
  const t = useTranslations("suppliers");
  const tm = useTranslations("paymentMethods");
  const set = <K extends keyof PayState>(k: K, val: PayState[K]) => onChange({ ...v, [k]: val });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label={label} htmlFor={`${idPrefix}-amount`} optional={optional} error={error}>
          <MoneyInput {...fieldAria(`${idPrefix}-amount`, error)} currency={v.currency} value={v.amount} onValueChange={(a) => set("amount", a)} rate={rate} rounding={rounding} />
        </Field>
        <Segmented
          label={t("currency")}
          value={v.currency}
          onValueChange={(c) => {
            // Keep the same value when switching currency (e.g. $20 → 1,790,000 LBP).
            const n = v.amount.trim() ? parseMoney(v.amount, v.currency) : null;
            const amount =
              n === null || c === v.currency ? v.amount : c === "LBP" ? String(toLbp(n, rate, rounding)) : (lbpToUsdCents(n, rate) / 100).toFixed(2);
            onChange({ ...v, currency: c, amount });
          }}
          options={[
            { value: "USD", label: "USD" },
            { value: "LBP", label: "LBP" },
          ]}
          className="mb-6"
        />
      </div>
      <Field label={t("method")} htmlFor={`${idPrefix}-method`}>
        <NativeSelect id={`${idPrefix}-method`} value={v.method} onChange={(e) => set("method", e.target.value as PayState["method"])}>
          {PAY_METHODS.map((m) => (
            <option key={m} value={m}>
              {tm(m)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {v.method === "CASH" && (
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <Switch checked={v.fromDrawer && drawerOpen} onCheckedChange={(c) => set("fromDrawer", c)} disabled={!drawerOpen} className="mt-0.5" />
          <span className="text-sm">
            <span className="block font-medium">{t("fromDrawer")}</span>
            <span className="text-muted-foreground">{drawerOpen ? t("fromDrawerHint") : t("fromDrawerClosed")}</span>
          </span>
        </label>
      )}
    </div>
  );
}
