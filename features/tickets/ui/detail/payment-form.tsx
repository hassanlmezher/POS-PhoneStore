"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addTicketPayment } from "@/features/tickets/actions";
import { PAYMENT_METHODS } from "@/features/tickets/schema";

type Props = { ticketId: string; rate: number; rounding: number; balanceUsdCents: number };

export function PaymentForm({ ticketId, rate, rounding, balanceUsdCents }: Props) {
  const t = useTranslations("ticket");
  const tc = useTranslations("common");
  const tm = useTranslations("paymentMethods");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "LBP">("USD");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function start() {
    setAmount(balanceUsdCents > 0 ? (balanceUsdCents / 100).toFixed(2) : "");
    setCurrency("USD");
    setErrors({});
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount.trim()) return setErrors({ amount: "required" });
    startTransition(async () => {
      try {
        const res = await addTicketPayment(ticketId, { amount, currency, method, reference });
        if (!res.ok) {
          setErrors(res.fieldErrors ?? { amount: "invalid" });
          return;
        }
        toast.success(t("paymentRecorded"));
        setOpen(false);
        setReference("");
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  if (!open)
    return (
      <Button variant="outline" className="w-full" onClick={start}>
        <Plus />
        {t("recordPayment")}
      </Button>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3" noValidate>
      <Field label={t("amount")} htmlFor="pay-amount" error={errors.amount}>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <MoneyInput
              {...fieldAria("pay-amount", errors.amount)}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              value={amount}
              onValueChange={setAmount}
              currency={currency}
              rate={rate}
              rounding={rounding}
            />
          </div>
          <Segmented
            label={t("currency")}
            value={currency}
            onValueChange={(c) => {
              setCurrency(c);
              setAmount("");
            }}
            options={[
              { value: "USD", label: "USD" },
              { value: "LBP", label: "LBP" },
            ]}
          />
        </div>
      </Field>
      <Field label={t("method")} htmlFor="pay-method">
        <NativeSelect id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {tm(m)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {method !== "CASH" && (
        <Field label={t("reference")} htmlFor="pay-ref" optional>
          <Input id="pay-ref" dir="ltr" className="text-start" autoComplete="off" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {t("savePayment")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}
