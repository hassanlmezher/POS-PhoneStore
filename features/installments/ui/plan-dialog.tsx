"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarClock, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Money } from "@/components/money";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { savePlan } from "@/features/installments/actions";
import { EVERY, MAX_PARTS, MIN_PARTS, scheduleDays, splitAmount, type Every } from "@/features/installments/rules";
import { formatMoney } from "@/lib/money";

type Props = {
  kind: "sale" | "ticket";
  id: string;
  /** e.g. "Sale #12" or "R-0042". */
  label: string;
  balanceUsdCents: number;
  rate: number;
  rounding: number;
  /** Shop's today, "YYYY-MM-DD". */
  today: string;
  /** A plan already exists: the button reads "Change plan". */
  replacing?: boolean;
  variant?: "outline" | "ghost";
};

const plusMonth = (key: string) => scheduleDays(key, 2, "MONTH")[1];

/** "Pay in parts": split what is still owed into 2–12 parts, weekly, every 2 weeks or monthly. */
export function PlanButton({ kind, id, label, balanceUsdCents, rate, rounding, today, replacing, variant = "outline" }: Props) {
  const t = useTranslations("installments");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [parts, setParts] = useState(3);
  const [every, setEvery] = useState<Every>("MONTH");
  const [firstDay, setFirstDay] = useState(() => plusMonth(today));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(firstDay);
  const days = valid ? scheduleDays(firstDay, parts, every) : [];
  const amounts = splitAmount(balanceUsdCents, parts);
  const day = (key: string) => format.dateTime(new Date(`${key}T12:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  function start() {
    setParts(3);
    setEvery("MONTH");
    setFirstDay(plusMonth(today));
    setNote("");
    setErrors({});
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return setErrors({ firstDay: "required" });
    startTransition(async () => {
      const res = await savePlan({ kind, id, parts, every, firstDay, note });
      if (!res.ok) {
        if (res.fieldErrors) return setErrors(res.fieldErrors);
        return void toast.error(te.has(res.error as never) ? te(res.error as never) : te("generic"));
      }
      toast.success(t("saved"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant={variant} size="sm" className="h-10" onClick={start}>
        <CalendarClock />
        {replacing ? t("change") : t("payInParts")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle", { label })}</DialogTitle>
            <DialogDescription>
              {t.rich(replacing ? "dialogHintReplace" : "dialogHint", { amount: formatMoney(balanceUsdCents, "USD"), m: (c) => <bdi dir="ltr">{c}</bdi> })}
            </DialogDescription>
          </DialogHeader>
          <form id={`plan-${id}`} onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("parts")} htmlFor={`plan-${id}-parts`} error={errors.parts}>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label={t("fewer")} disabled={parts <= MIN_PARTS} onClick={() => setParts((n) => Math.max(MIN_PARTS, n - 1))}>
                    <Minus />
                  </Button>
                  <Input
                    {...fieldAria(`plan-${id}-parts`, errors.parts)}
                    type="number"
                    inputMode="numeric"
                    min={MIN_PARTS}
                    max={MAX_PARTS}
                    className="w-16 text-center"
                    value={parts}
                    onChange={(e) => setParts(Math.min(MAX_PARTS, Math.max(MIN_PARTS, Number(e.target.value) || MIN_PARTS)))}
                  />
                  <Button type="button" variant="outline" size="icon" aria-label={t("more")} disabled={parts >= MAX_PARTS} onClick={() => setParts((n) => Math.min(MAX_PARTS, n + 1))}>
                    <Plus />
                  </Button>
                </div>
              </Field>
              <Field label={t("firstDay")} htmlFor={`plan-${id}-first`} error={errors.firstDay}>
                <Input {...fieldAria(`plan-${id}-first`, errors.firstDay)} type="date" min={today} value={firstDay} onChange={(e) => setFirstDay(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("every")}</span>
              <Segmented label={t("every")} value={every} onValueChange={setEvery} options={EVERY.map((v) => ({ value: v, label: t(`everyOptions.${v}`) }))} className="w-full" />
            </div>

            {days.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <p className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">{t("preview")}</p>
                <ol className="max-h-56 divide-y overflow-y-auto">
                  {days.map((d, i) => (
                    <li key={d + i} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{day(d)}</span>
                      <Money usdCents={amounts[i]} rate={rate} rounding={rounding} className="items-end text-sm whitespace-nowrap rtl:items-start" usdClassName="font-semibold" lbpClassName="text-xs" />
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <Field label={t("note")} htmlFor={`plan-${id}-note`} optional>
              <Input id={`plan-${id}-note`} maxLength={300} placeholder={t("notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </form>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" form={`plan-${id}`} disabled={pending || !valid}>
              {pending && <Loader2 className="animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
