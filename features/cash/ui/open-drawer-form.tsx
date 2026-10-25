"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { openDrawer } from "@/features/cash/actions";

export function OpenDrawerForm() {
  const t = useTranslations("cash");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await openDrawer({ openingUsd: usd, openingLbp: lbp });
        if (!res.ok) {
          if (res.fieldErrors) return setErrors(res.fieldErrors);
          toast.error(te.has(res.error) ? te(res.error as never) : te("generic"));
          if (res.error === "alreadyOpen") router.refresh();
          return;
        }
        toast.success(t("opened"));
        router.refresh();
      } catch {
        toast.error(te("generic"));
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("openingUsd")} htmlFor="open-usd" error={errors.openingUsd}>
          <MoneyInput {...fieldAria("open-usd", errors.openingUsd)} autoFocus currency="USD" value={usd} onValueChange={setUsd} placeholder="0.00" />
        </Field>
        <Field label={t("openingLbp")} htmlFor="open-lbp" error={errors.openingLbp}>
          <MoneyInput {...fieldAria("open-lbp", errors.openingLbp)} currency="LBP" value={lbp} onValueChange={setLbp} placeholder="0" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{t("openingHint")}</p>
      <Button type="submit" disabled={pending} className="sm:self-start">
        {pending ? <Loader2 className="animate-spin" /> : <LockOpen />}
        {t("openDrawer")}
      </Button>
    </form>
  );
}
