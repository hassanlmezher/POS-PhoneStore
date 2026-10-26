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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveExpense } from "@/features/expenses/actions";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/features/expenses/schema";
import { CATEGORY_ICONS } from "@/features/expenses/ui/category-icon";
import { cn } from "@/lib/utils";

type Cur = "USD" | "LBP";

export type ExpenseDraft = { id?: string; category: ExpenseCategory; currency: Cur; amount: string; day: string; note: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit when `draft.id` is set; otherwise a new expense (prefilled for "Add again"). */
  draft: ExpenseDraft;
  today: string;
  drawerOpen: boolean;
  rate: number;
  rounding: number;
};

export function ExpenseDialog({ open, onOpenChange, draft, today, drawerOpen, rate, rounding }: Props) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<ExpenseCategory>(draft.category);
  const [currency, setCurrency] = useState<Cur>(draft.currency);
  const [amount, setAmount] = useState(draft.amount);
  const [day, setDay] = useState(draft.day);
  const [note, setNote] = useState(draft.note);
  const [fromDrawer, setFromDrawer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const amountRef = useRef<HTMLInputElement>(null);
  const editing = !!draft.id;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!amount.trim()) local.amount = "required";
    if (!day) local.day = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      try {
        const res = await saveExpense({ category, currency, amount, day, note, fromDrawer: !editing && fromDrawer }, draft.id);
        if (!res.ok) {
          if (res.fieldErrors) return setErrors(res.fieldErrors);
          toast.error(te.has(res.error) ? te(res.error as never) : te("generic"));
          return;
        }
        toast.success(editing ? t("updated") : t("added"));
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error(te("generic"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          amountRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogHint")}</DialogDescription>
        </DialogHeader>
        <form id="expense-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("category")}</legend>
            <div role="radiogroup" aria-label={t("category")} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPENSE_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICONS[c];
                const on = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-start text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                      on ? "border-primary bg-primary/10 font-medium text-foreground" : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="min-w-0 leading-tight">{t(`categories.${c}`)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-[1fr_auto] gap-3 sm:gap-4">
            <Field label={t("amount")} htmlFor="exp-amount" error={errors.amount}>
              <MoneyInput
                ref={amountRef}
                {...fieldAria("exp-amount", errors.amount)}
                currency={currency}
                value={amount}
                onValueChange={setAmount}
                rate={rate}
                rounding={rounding}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("currency")}</span>
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("date")} htmlFor="exp-day" error={errors.day}>
              <Input {...fieldAria("exp-day", errors.day)} type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field label={t("note")} htmlFor="exp-note" optional>
              <Input id="exp-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} />
            </Field>
          </div>

          {!editing && (
            <label className={cn("flex items-start gap-3 rounded-lg border p-3", !drawerOpen && "opacity-60")}>
              <Switch checked={fromDrawer} onCheckedChange={setFromDrawer} disabled={!drawerOpen} className="mt-0.5" />
              <span className="text-sm">
                <span className="block font-medium">{t("fromDrawer")}</span>
                <span className="text-muted-foreground">{drawerOpen ? t("fromDrawerHint") : t("fromDrawerClosed")}</span>
              </span>
            </label>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="expense-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {editing ? tc("save") : t("addButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
