"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCashMovement } from "@/features/cash/actions";
import { formatMoney, parseMoney } from "@/lib/money";

type Type = "PAY_IN" | "PAY_OUT";
type Cur = "USD" | "LBP";
type Pick = { id: string; label: string };

/** Pay in / pay out of the open drawer. `reasons` are the shop's quick picks (Settings → Quick picks). */
export function MovementForm({ reasons }: { reasons: Record<Type, Pick[]> }) {
  const t = useTranslations("cash");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<Type>("PAY_OUT");
  const [currency, setCurrency] = useState<Cur>("USD");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const amountRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    const n = amount.trim() ? parseMoney(amount, currency) : null;
    if (!amount.trim()) local.amount = "required";
    else if (n === null || n <= 0) local.amount = "invalidAmount";
    if (!reason.trim()) local.reason = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      try {
        const res = await addCashMovement({ type, currency, amount, reason });
        if (!res.ok) {
          if (res.fieldErrors) return setErrors(res.fieldErrors);
          toast.error(te.has(res.error) ? te(res.error as never) : te("generic"));
          return;
        }
        toast.success(t(type === "PAY_IN" ? "payInAdded" : "payOutAdded", { amount: formatMoney(n ?? 0, currency) }));
        setAmount("");
        setReason("");
        amountRef.current?.focus();
        router.refresh();
      } catch {
        toast.error(te("generic"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Segmented
          label={t("movementType")}
          value={type}
          onValueChange={setType}
          options={[
            { value: "PAY_OUT", label: t("payOut") },
            { value: "PAY_IN", label: t("payIn") },
          ]}
          className="flex-1"
        />
        <Segmented
          label={t("currency")}
          value={currency}
          onValueChange={setCurrency}
          options={[
            { value: "USD", label: "USD" },
            { value: "LBP", label: "LBP" },
          ]}
        />
      </div>
      <Field label={t("amount")} htmlFor="mv-amount" error={errors.amount}>
        <MoneyInput ref={amountRef} {...fieldAria("mv-amount", errors.amount)} currency={currency} value={amount} onValueChange={setAmount} />
      </Field>
      <Field label={t("reason")} htmlFor="mv-reason" error={errors.reason}>
        <Input {...fieldAria("mv-reason", errors.reason)} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} />
      </Field>
      {reasons[type].length > 0 && (
      <div className="-mt-2 flex flex-wrap gap-2" aria-label={t("quickReasons")} role="group">
        {reasons[type].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReason(r.label)}
            className="min-h-11 rounded-full border bg-card px-4 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {r.label}
          </button>
        ))}
      </div>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t(type === "PAY_IN" ? "recordPayIn" : "recordPayOut")}
      </Button>
    </form>
  );
}
