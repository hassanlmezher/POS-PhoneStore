"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPartOrder, updatePartOrder } from "@/features/partorders/actions";
import { cn } from "@/lib/utils";

export type OrderDraft = {
  id?: string;
  part: string;
  qty: number;
  supplierName: string;
  supplierPhone: string;
  expectedDay: string;
  cost: string;
  note: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  draft: OrderDraft;
  suppliers: { name: string; phone: string | null }[];
  /** Today in the shop's time zone ("YYYY-MM-DD"). */
  today: string;
  rate: number;
  rounding: number;
};

const plusDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Order a part (or edit an order): part, supplier, expected day; the WhatsApp to the supplier is written for you. */
export function OrderDialog({ open, onOpenChange, ticketId, draft, suppliers, today, rate, rounding }: Props) {
  const t = useTranslations("partOrders");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const listId = useId();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof OrderDraft>(k: K, value: OrderDraft[K]) => setV((cur) => ({ ...cur, [k]: value }));
  const quick = [
    { label: t("tomorrow"), day: plusDays(today, 1) },
    { label: t("inDays", { count: 2 }), day: plusDays(today, 2) },
    { label: t("inDays", { count: 3 }), day: plusDays(today, 3) },
    { label: t("inWeek"), day: plusDays(today, 7) },
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!v.part.trim()) local.part = "required";
    if (!v.supplierName.trim()) local.supplierName = "required";
    if (!v.expectedDay) local.expectedDay = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const input = { part: v.part, qty: v.qty, supplierName: v.supplierName, supplierPhone: v.supplierPhone, expectedDay: v.expectedDay, cost: v.cost, note: v.note };
      const res = draft.id ? await updatePartOrder(draft.id, input) : await createPartOrder(ticketId, input);
      if (!res.ok) {
        if (res.fieldErrors) return setErrors(res.fieldErrors);
        return void toast.error(te.has(res.error as never) ? te(res.error as never) : te("generic"));
      }
      toast.success(draft.id ? t("updated") : t("ordered"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft.id ? t("editTitle") : t("orderTitle")}</DialogTitle>
          <DialogDescription>{t("orderHint")}</DialogDescription>
        </DialogHeader>
        <form id="part-order-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <Field label={t("part")} htmlFor="po-part" error={errors.part}>
              <Input {...fieldAria("po-part", errors.part)} autoFocus maxLength={120} placeholder={t("partPlaceholder")} value={v.part} onChange={(e) => set("part", e.target.value)} />
            </Field>
            <Field label={t("qty")} htmlFor="po-qty" error={errors.qty}>
              <Input
                {...fieldAria("po-qty", errors.qty)}
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={v.qty}
                onChange={(e) => set("qty", Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("supplier")} htmlFor="po-supplier" error={errors.supplierName}>
              <Input
                {...fieldAria("po-supplier", errors.supplierName)}
                list={listId}
                autoComplete="off"
                maxLength={80}
                value={v.supplierName}
                onChange={(e) => {
                  const name = e.target.value;
                  const known = suppliers.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
                  setV((cur) => ({ ...cur, supplierName: name, supplierPhone: known?.phone && !cur.supplierPhone ? known.phone : cur.supplierPhone }));
                }}
              />
              <datalist id={listId}>
                {suppliers.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
            </Field>
            <Field label={t("supplierPhone")} htmlFor="po-phone" optional error={errors.supplierPhone}>
              <Input
                {...fieldAria("po-phone", errors.supplierPhone)}
                type="tel"
                inputMode="tel"
                dir="ltr"
                className="text-start"
                value={v.supplierPhone}
                onChange={(e) => set("supplierPhone", e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("expected")} htmlFor="po-day" error={errors.expectedDay}>
            <Input {...fieldAria("po-day", errors.expectedDay)} type="date" min={today} value={v.expectedDay} onChange={(e) => set("expectedDay", e.target.value)} />
          </Field>
          <div className="-mt-2 flex flex-wrap gap-2" role="group" aria-label={t("expected")}>
            {quick.map((q) => (
              <button
                key={q.day}
                type="button"
                onClick={() => set("expectedDay", q.day)}
                aria-pressed={v.expectedDay === q.day}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  v.expectedDay === q.day ? "border-primary bg-primary/10 text-foreground" : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("cost")} htmlFor="po-cost" optional error={errors.cost}>
              <MoneyInput {...fieldAria("po-cost", errors.cost)} value={v.cost} onValueChange={(c) => set("cost", c)} rate={rate} rounding={rounding} placeholder="0.00" />
            </Field>
            <Field label={t("note")} htmlFor="po-note" optional>
              <Input id="po-note" maxLength={300} value={v.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="part-order-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {draft.id ? tc("save") : t("orderButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
