"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateTicketDetails } from "@/features/tickets/actions";
import { ACCESSORIES } from "@/features/tickets/schema";
import { cn } from "@/lib/utils";

type Details = {
  imei: string | null;
  color: string | null;
  problem: string;
  conditionNotes: string | null;
  accessories: string[];
  estimateUsdCents: number | null;
  promisedAt: Date | null;
  warrantyDays: number;
};

function dateInput(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EditDetailsButton({ ticketId, details, rate, rounding }: { ticketId: string; details: Details; rate: number; rounding: number }) {
  const t = useTranslations("ticket");
  const ti = useTranslations("intake");
  const ta = useTranslations("accessories");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState(() => init(details));

  function init(d: Details) {
    return {
      imei: d.imei ?? "",
      color: d.color ?? "",
      problem: d.problem,
      conditionNotes: d.conditionNotes ?? "",
      accessories: d.accessories,
      estimate: d.estimateUsdCents !== null ? (d.estimateUsdCents / 100).toFixed(2) : "",
      promised: dateInput(d.promisedAt),
      warrantyDays: String(d.warrantyDays),
    };
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.problem.trim()) return setErrors({ problem: "required" });
    startTransition(async () => {
      try {
        const res = await updateTicketDetails(ticketId, {
          imei: form.imei,
          color: form.color,
          problem: form.problem,
          conditionNotes: form.conditionNotes,
          accessories: form.accessories as (typeof ACCESSORIES)[number][],
          estimate: form.estimate,
          promisedAt: form.promised ? new Date(`${form.promised}T18:00`).toISOString() : undefined,
          warrantyDays: form.warrantyDays || "0",
        });
        if (!res.ok) return setErrors(res.fieldErrors ?? {});
        toast.success(t("detailsSaved"));
        setOpen(false);
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setForm(init(details));
          setErrors({});
          setOpen(true);
        }}
      >
        <Pencil />
        {tc("edit")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("editDetails")}</DialogTitle>
            <DialogDescription>{t("editDetailsBody")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={ti("imei")} htmlFor="ed-imei" optional>
                <Input id="ed-imei" dir="ltr" className="text-start" value={form.imei} onChange={(e) => set("imei", e.target.value)} />
              </Field>
              <Field label={ti("color")} htmlFor="ed-color" optional>
                <Input id="ed-color" value={form.color} onChange={(e) => set("color", e.target.value)} />
              </Field>
            </div>
            <Field label={ti("problem")} htmlFor="ed-problem" error={errors.problem}>
              <Textarea {...fieldAria("ed-problem", errors.problem)} rows={3} value={form.problem} onChange={(e) => set("problem", e.target.value)} />
            </Field>
            <Field label={ti("condition")} htmlFor="ed-cond" optional>
              <Input id="ed-cond" value={form.conditionNotes} onChange={(e) => set("conditionNotes", e.target.value)} />
            </Field>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium" id="ed-acc">
                {ti("accessories")}
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ed-acc">
                {ACCESSORIES.map((a) => {
                  const on = form.accessories.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("accessories", on ? form.accessories.filter((x) => x !== a) : [...form.accessories, a])}
                      className={cn(
                        "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:h-9",
                        on ? "border-primary bg-primary-soft text-primary" : "bg-card text-muted-foreground",
                      )}
                    >
                      {on && <Check aria-hidden className="size-4" />}
                      {ta(a)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={ti("estimate")} htmlFor="ed-est" error={errors.estimate}>
                <MoneyInput {...fieldAria("ed-est", errors.estimate)} value={form.estimate} onValueChange={(v) => set("estimate", v)} rate={rate} rounding={rounding} />
              </Field>
              <Field label={ti("promised")} htmlFor="ed-promised" error={errors.promisedAt}>
                <Input {...fieldAria("ed-promised", errors.promisedAt)} type="date" value={form.promised} onChange={(e) => set("promised", e.target.value)} />
              </Field>
              <Field label={ti("warrantyDays")} htmlFor="ed-warranty" error={errors.warrantyDays}>
                <Input
                  {...fieldAria("ed-warranty", errors.warrantyDays)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  dir="ltr"
                  className="text-start"
                  value={form.warrantyDays}
                  onChange={(e) => set("warrantyDays", e.target.value)}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
