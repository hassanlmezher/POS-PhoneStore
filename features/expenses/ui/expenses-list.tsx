"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CopyPlus, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useShortcuts } from "@/components/app-shell/use-shortcuts";
import { deleteExpense } from "@/features/expenses/actions";
import type { ExpenseCategory } from "@/features/expenses/schema";
import { CATEGORY_ICONS } from "@/features/expenses/ui/category-icon";
import { ExpenseDialog, type ExpenseDraft } from "@/features/expenses/ui/expense-dialog";
import { formatMoney, toLbp } from "@/lib/money";

export type ExpenseRow = {
  id: string;
  category: ExpenseCategory;
  note: string | null;
  currency: "USD" | "LBP";
  amount: number;
  /** Amount typed back into the form ("12.50" / "500000"). */
  amountText: string;
  usdCents: number;
  day: string;
  dayLabel: string;
  by: string;
  fromDrawer: boolean;
};

type Props = { rows: ExpenseRow[]; today: string; drawerOpen: boolean; rate: number; rounding: number };

/** Expenses for the chosen dates, with Add / Edit / Add again / Delete. */
export function ExpensesList({ rows, today, drawerOpen, rate, rounding }: Props) {
  const t = useTranslations("expenses");
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  // Bumped on every open so the dialog starts from the new draft.
  const [key, setKey] = useState(0);
  const blank: ExpenseDraft = { category: "RENT", currency: "USD", amount: "", day: today, note: "" };
  const open = (d: ExpenseDraft) => {
    setKey((k) => k + 1);
    setDraft(d);
  };
  useShortcuts({ n: () => open(blank) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t("listTitle", { count: rows.length })}</h2>
        <Button onClick={() => open(blank)}>
          <Plus />
          {t("addButton")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={Wallet} title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {rows.map((r) => (
            <Item
              key={r.id}
              row={r}
              rate={rate}
              rounding={rounding}
              onEdit={() => open({ id: r.id, category: r.category, currency: r.currency, amount: r.amountText, day: r.day, note: r.note ?? "" })}
              onAgain={() => open({ category: r.category, currency: r.currency, amount: r.amountText, day: today, note: r.note ?? "" })}
            />
          ))}
        </ul>
      )}

      {draft && (
        <ExpenseDialog
          key={key}
          open
          onOpenChange={(o) => !o && setDraft(null)}
          draft={draft}
          today={today}
          drawerOpen={drawerOpen}
          rate={rate}
          rounding={rounding}
        />
      )}
    </div>
  );
}

function Item({ row: r, rate, rounding, onEdit, onAgain }: { row: ExpenseRow; rate: number; rounding: number; onEdit: () => void; onAgain: () => void }) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = CATEGORY_ICONS[r.category];

  function remove() {
    startTransition(async () => {
      const res = await deleteExpense(r.id);
      if (!res.ok) return void toast.error(te("generic"));
      toast.success(t("deleted"));
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t(`categories.${r.category}`)}</p>
          {r.note && (
            <p dir="auto" className="truncate text-sm text-muted-foreground rtl:text-right">
              {r.note}
            </p>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{r.dayLabel}</span>
            <span aria-hidden>·</span>
            <span>{t("by", { name: r.by })}</span>
            {r.fromDrawer && <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{t("paidFromDrawer")}</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <div className="me-auto text-sm sm:me-2 sm:text-end">
          <span dir="ltr" className="block font-semibold tabular-nums">
            {formatMoney(r.amount, r.currency)}
          </span>
          <span dir="ltr" className="block text-xs text-muted-foreground tabular-nums">
            ≈ {r.currency === "LBP" ? formatMoney(r.usdCents, "USD") : formatMoney(toLbp(r.usdCents, rate, rounding), "LBP")}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onAgain} aria-label={t("addAgain")} title={t("addAgain")}>
          <CopyPlus />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={tc("edit")} title={tc("edit")}>
          <Pencil />
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon" disabled={pending} aria-label={t("delete")} title={t("delete")} className="text-destructive hover:text-destructive">
              <Trash2 />
            </Button>
          }
          title={t("deleteTitle")}
          body={r.fromDrawer ? t("deleteBodyDrawer") : t("deleteBody")}
          confirmLabel={t("delete")}
          onConfirm={remove}
        />
      </div>
    </li>
  );
}
