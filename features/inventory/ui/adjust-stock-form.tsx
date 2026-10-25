"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjustStock } from "@/features/inventory/actions";
import { ADJUST_REASONS } from "@/features/inventory/schema";
import { cn } from "@/lib/utils";

type Reason = (typeof ADJUST_REASONS)[number];

// Sign each reason implies; ADJUSTMENT lets the user pick.
const SIGN: Record<Reason, 1 | -1 | null> = { RESTOCK: 1, RETURN: 1, DAMAGED: -1, ADJUSTMENT: null };
const ORDER: Reason[] = ["RESTOCK", "DAMAGED", "ADJUSTMENT", "RETURN"];

export function AdjustStockForm({ productId, qty }: { productId: string; qty: number }) {
  const t = useTranslations("product");
  const tr = useTranslations("movementReasons");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<Reason>("RESTOCK");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const n = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(n) && n > 0;
  const sign = SIGN[reason] ?? (direction === "add" ? 1 : -1);
  const delta = valid ? sign * n : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setError(amount.trim() ? "invalidQty" : "required");
    setError(null);
    startTransition(async () => {
      try {
        const res = await adjustStock(productId, { delta, reason, note });
        if (!res.ok) {
          setError(res.fieldErrors?.delta ?? res.fieldErrors?.note ?? "generic");
          return;
        }
        toast.success(t("adjusted", { qty: res.qty }));
        setAmount("");
        setNote("");
        router.refresh();
      } catch {
        toast.error(t("adjustFailed"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t("reason")} htmlFor="adj-reason">
        <div id="adj-reason" role="radiogroup" aria-label={t("reason")} className="grid grid-cols-2 gap-2">
          {ORDER.map((r) => {
            const s = SIGN[r];
            const activeR = r === reason;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={activeR}
                onClick={() => setReason(r)}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  activeR ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-accent",
                )}
              >
                {tr(r)}
                <span aria-hidden className={cn("text-xs tabular-nums", activeR ? "text-primary" : "text-muted-foreground")}>
                  {s === 1 ? "+" : s === -1 ? "−" : "±"}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t("quantity")} htmlFor="adj-qty" error={error}>
        <div className="flex gap-2">
          {SIGN[reason] === null && (
            <Segmented
              label={t("direction")}
              value={direction}
              onValueChange={setDirection}
              options={[
                { value: "add", label: <><Plus aria-hidden className="size-4" /><span className="sr-only">{t("add")}</span></> },
                { value: "remove", label: <><Minus aria-hidden className="size-4" /><span className="sr-only">{t("remove")}</span></> },
              ]}
            />
          )}
          <Input
            {...fieldAria("adj-qty", error)}
            type="number"
            inputMode="numeric"
            min={1}
            dir="ltr"
            className="min-w-0 flex-1 text-start tabular-nums"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </Field>

      <Field label={t("note")} htmlFor="adj-note" optional>
        <Input id="adj-note" autoComplete="off" placeholder={t("notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {valid && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground" aria-live="polite">
          {t("preview")}{" "}
          <bdi dir="ltr" className="font-semibold text-foreground tabular-nums">
            {qty} → {qty + delta}
          </bdi>
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t("saveAdjustment")}
      </Button>
    </form>
  );
}
