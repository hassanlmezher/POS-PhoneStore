"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addSalePayment } from "@/features/pos/actions";
import { addTicketPayment } from "@/features/tickets/actions";
import { PAYMENT_METHODS } from "@/features/tickets/schema";
import { formatMoney, toLbp } from "@/lib/money";

type Props = {
  kind: "sale" | "ticket";
  id: string;
  /** What is paid, e.g. "Sale #12" or "R-0042". */
  label: string;
  balanceUsdCents: number;
  rate: number;
  rounding: number;
  size?: "sm" | "default";
  /** Amount filled in when the dialog opens (e.g. one installment); defaults to the full balance. */
  prefillUsdCents?: number;
  /** Button text instead of "Record payment". */
  buttonLabel?: string;
  /** Dialog text instead of "Still to pay … the full amount is filled in". */
  hint?: React.ReactNode;
};

/** "Record payment" for money still owed on a sale or a repair. Prefilled with the full amount. */
export function PayBalanceButton({ kind, id, label, balanceUsdCents, rate, rounding, size = "sm", prefillUsdCents, buttonLabel, hint }: Props) {
  const t = useTranslations("customers");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const tm = useTranslations("paymentMethods");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState<"USD" | "LBP">("USD");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inCurrency = (usd: number, c: "USD" | "LBP") => (c === "USD" ? (usd / 100).toFixed(2) : String(toLbp(usd, rate, rounding)));
  const full = (c: "USD" | "LBP") => inCurrency(balanceUsdCents, c);
  const first = Math.min(prefillUsdCents ?? balanceUsdCents, balanceUsdCents);

  function start() {
    setCurrency("USD");
    setAmount(inCurrency(first, "USD"));
    setMethod("CASH");
    setReference("");
    setErrors({});
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount.trim()) return setErrors({ amount: "required" });
    startTransition(async () => {
      try {
        const input = { amount, currency, method, reference };
        const res = kind === "sale" ? await addSalePayment(id, input) : await addTicketPayment(id, input);
        if (!res.ok) {
          if ("fieldErrors" in res && res.fieldErrors) return setErrors(res.fieldErrors);
          return void toast.error(te.has(res.error as never) ? te(res.error as never) : te("generic"));
        }
        toast.success(t("paymentSaved"));
        setOpen(false);
        router.refresh();
      } catch {
        toast.error(te("generic"));
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size={size} className={size === "sm" ? "h-10" : undefined} onClick={start}>
        <HandCoins />
        {buttonLabel ?? t("recordPayment")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("payTitle", { label })}</DialogTitle>
            <DialogDescription>
              {hint ?? t.rich("payHint", { amount: formatMoney(balanceUsdCents, "USD"), m: (c) => <bdi dir="ltr">{c}</bdi> })}
            </DialogDescription>
          </DialogHeader>
          <form id={`pay-${id}`} onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <Field label={t("amountPaid")} htmlFor={`pay-${id}-amount`} error={errors.amount}>
                <MoneyInput
                  {...fieldAria(`pay-${id}-amount`, errors.amount)}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  currency={currency}
                  value={amount}
                  onValueChange={setAmount}
                  rate={rate}
                  rounding={rounding}
                />
              </Field>
              <Segmented
                label={t("currency")}
                value={currency}
                onValueChange={(c) => {
                  setCurrency(c);
                  setAmount(inCurrency(first, c));
                }}
                options={[
                  { value: "USD", label: "USD" },
                  { value: "LBP", label: "LBP" },
                ]}
                className="mb-6"
              />
            </div>
            <Button type="button" variant="link" className="-mt-3 h-auto self-start p-0 text-xs" onClick={() => setAmount(full(currency))}>
              {t("payAll")}
            </Button>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("method")} htmlFor={`pay-${id}-method`}>
                <NativeSelect id={`pay-${id}-method`} value={method} onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {tm(m)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {method !== "CASH" && (
                <Field label={t("reference")} htmlFor={`pay-${id}-ref`} optional>
                  <Input id={`pay-${id}-ref`} value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
                </Field>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" form={`pay-${id}`} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t("savePayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
