"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { closeDrawer } from "@/features/cash/actions";
import { formatMoney, parseMoney } from "@/lib/money";
import { CashDiff } from "./cash-diff";

/** Count the drawer, see the live difference per currency, confirm, then land on the session summary. */
export function CloseDrawerForm({ expectedUsdCents, expectedLbp }: { expectedUsdCents: number; expectedLbp: number }) {
  const t = useTranslations("cash");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const countedUsd = usd.trim() ? parseMoney(usd, "USD") : 0;
  const countedLbp = lbp.trim() ? parseMoney(lbp, "LBP") : 0;
  const valid = countedUsd !== null && countedLbp !== null;
  const touched = usd.trim() !== "" || lbp.trim() !== "";

  function confirm() {
    startTransition(async () => {
      try {
        const res = await closeDrawer({ countedUsd: usd, countedLbp: lbp, note });
        if (!res.ok) {
          if (res.fieldErrors) return setErrors(res.fieldErrors);
          toast.error(te.has(res.error) ? te(res.error as never) : te("generic"));
          return;
        }
        toast.success(t("closed"));
        router.push(`/cash/${res.sessionId}?closed=1`);
      } catch {
        toast.error(te("generic"));
      }
    });
  }

  const row = (label: string, expected: string, diff: number | null, currency: "USD" | "LBP") => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        {label} · {t("expectedShort")} <bdi dir="ltr" className="tabular-nums">{expected}</bdi>
      </span>
      {diff === null ? <span className="text-subtle-foreground">—</span> : <CashDiff diff={diff} currency={currency} />}
    </div>
  );

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-4">
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t("countHint")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label={t("countedUsd")} htmlFor="close-usd" error={errors.countedUsd}>
          <MoneyInput {...fieldAria("close-usd", errors.countedUsd)} currency="USD" value={usd} onValueChange={setUsd} placeholder="0.00" />
        </Field>
        <Field label={t("countedLbp")} htmlFor="close-lbp" error={errors.countedLbp}>
          <MoneyInput {...fieldAria("close-lbp", errors.countedLbp)} currency="LBP" value={lbp} onValueChange={setLbp} placeholder="0" />
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-3" aria-live="polite">
        {row("USD", formatMoney(expectedUsdCents, "USD"), touched && countedUsd !== null ? countedUsd - expectedUsdCents : null, "USD")}
        {row("LBP", formatMoney(expectedLbp, "LBP"), touched && countedLbp !== null ? countedLbp - expectedLbp : null, "LBP")}
      </div>

      <Field label={t("note")} htmlFor="close-note" optional>
        <Textarea id="close-note" value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
      </Field>

      <ConfirmDialog
        trigger={
          <Button type="button" variant="destructive" disabled={pending || !valid || !touched}>
            {pending ? <Loader2 className="animate-spin" /> : <Lock />}
            {t("closeDrawer")}
          </Button>
        }
        title={t("closeConfirmTitle")}
        body={t("closeConfirmBody")}
        confirmLabel={t("closeDrawer")}
        onConfirm={confirm}
        confirmDisabled={pending}
      >
        {valid && (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            {row("USD", formatMoney(expectedUsdCents, "USD"), (countedUsd ?? 0) - expectedUsdCents, "USD")}
            {row("LBP", formatMoney(expectedLbp, "LBP"), (countedLbp ?? 0) - expectedLbp, "LBP")}
          </div>
        )}
      </ConfirmDialog>
    </form>
  );
}
