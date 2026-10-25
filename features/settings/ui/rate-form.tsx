"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setExchangeRate } from "@/features/settings/actions";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** "Today's rate" form: used on the settings page and in the top-bar rate popover. */
export function RateForm({
  rate,
  onDone,
  autoFocus,
  compact,
}: {
  rate: number;
  onDone?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("settings.rate");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(String(rate));
  const [error, setError] = useState<string | null>(null);
  const parsed = Number(value.replace(/[,\s]/g, ""));
  const changed = Number.isInteger(parsed) && parsed !== rate;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(parsed) || parsed <= 0) return setError("invalid");
    startTransition(async () => {
      const res = await setExchangeRate(parsed);
      if (!res.ok) return setError(res.fieldErrors?.rate ?? "generic");
      setError(null);
      toast.success(t("updated", { rate: fmt.format(parsed) }));
      onDone?.();
      router.refresh();
    });
  }

  const id = compact ? "rate-popover" : "rate-input";
  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-3", !compact && "sm:flex-row sm:items-start")}>
      <Field
        label={t("newRate")}
        htmlFor={id}
        error={error}
        hint={changed && parsed > 0 ? <>{t("preview")} <Ltr>$1 = {fmt.format(parsed)} LBP</Ltr></> : t("hint")}
        className="min-w-0 flex-1"
      >
        <div className="relative">
          <Input
            {...fieldAria(id, error)}
            autoFocus={autoFocus}
            inputMode="numeric"
            dir="ltr"
            className="pe-20 text-start text-base font-medium tabular-nums"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d,]/g, ""))}
            onFocus={(e) => e.target.select()}
          />
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" dir="ltr">
            {tc("perUsd")}
          </span>
        </div>
      </Field>
      <Button type="submit" disabled={pending || !changed} className={cn(!compact && "sm:mt-7")}>
        {pending ? tc("saving") : t("update")}
      </Button>
    </form>
  );
}
