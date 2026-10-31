"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { HandCoins, PackagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { deletePurchase, deleteSupplierPayment } from "@/features/suppliers/actions";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type HistoryRow =
  | {
      kind: "purchase";
      id: string;
      at: string;
      usdCents: number;
      balanceAfter: number;
      reference: string | null;
      note: string | null;
      items: { name: string; qty: number; unitCostUsdCents: number }[];
    }
  | {
      kind: "payment";
      id: string;
      at: string;
      usdCents: number;
      balanceAfter: number;
      note: string | null;
      method: string;
      currency: "USD" | "LBP";
      amount: number;
      withPurchase: boolean;
      fromDrawer: boolean;
    };

/** Purchases and payments, newest first, with what was owed after each. */
export function SupplierHistory({ rows, canEdit, rate, rounding }: { rows: HistoryRow[]; canEdit: boolean; rate: number; rounding: number }) {
  const t = useTranslations("suppliers");
  if (rows.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">{t("noHistory")}</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <Row key={`${r.kind}-${r.id}`} r={r} canEdit={canEdit} rate={rate} rounding={rounding} />
      ))}
    </ul>
  );
}

function Row({ r, canEdit, rate, rounding }: { r: HistoryRow; canEdit: boolean; rate: number; rounding: number }) {
  const t = useTranslations("suppliers");
  const tm = useTranslations("paymentMethods");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const purchase = r.kind === "purchase";
  // Money back from the supplier is stored as a negative payment.
  const back = !purchase && r.usdCents < 0;
  const Icon = purchase ? PackagePlus : HandCoins;

  function remove() {
    startTransition(async () => {
      const res = purchase ? await deletePurchase(r.id) : await deleteSupplierPayment(r.id);
      if (!res.ok) return void toast.error(te("generic"));
      toast.success(t(purchase ? "purchaseDeleted" : "paymentDeleted"));
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", purchase ? "bg-muted text-muted-foreground" : "bg-success-soft text-success")}>
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {purchase ? t("purchase") : back ? t("moneyBack") : t("payment")}
            {purchase && r.reference && (
              <span className="ms-2 text-xs font-normal text-muted-foreground">
                #<Ltr>{r.reference}</Ltr>
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {format.dateTime(new Date(r.at), { dateStyle: "medium" })}
            {!purchase && ` · ${tm(r.method)}`}
            {!purchase && r.withPurchase && ` · ${t("paidWithPurchase")}`}
            {!purchase && r.fromDrawer && ` · ${t(back ? "intoDrawerShort" : "fromDrawerShort")}`}
          </p>
          {purchase && (
            <ul className="mt-1 text-sm text-muted-foreground">
              {r.items.map((i, k) => (
                <li key={k} className="flex gap-2">
                  <span dir="auto" className="min-w-0 truncate rtl:text-right">
                    {i.qty} × {i.name}
                  </span>
                  <Ltr className="shrink-0 text-xs">@ {formatMoney(i.unitCostUsdCents, "USD")}</Ltr>
                </li>
              ))}
            </ul>
          )}
          {r.note && (
            <p dir="auto" className="text-xs text-muted-foreground rtl:text-right">
              {r.note}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1 rtl:sm:items-start">
        <span className={cn("text-sm font-semibold tabular-nums", purchase ? "" : "text-success")} dir="ltr">
          {purchase || back ? "+" : "−"}
          {!purchase && r.currency === "LBP" ? formatMoney(Math.abs(r.amount), "LBP") : formatMoney(Math.abs(r.usdCents), "USD")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("owedAfter")} <Money usdCents={r.balanceAfter} rate={rate} rounding={rounding} layout="inline" className="text-xs" lbpClassName="hidden" />
        </span>
        {canEdit && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={t("delete")} className="text-destructive hover:text-destructive">
                <Trash2 />
              </Button>
            }
            title={t(purchase ? "deletePurchaseTitle" : "deletePaymentTitle")}
            body={t(purchase ? "deletePurchaseBody" : "deletePaymentBody")}
            confirmLabel={t("delete")}
            onConfirm={remove}
          />
        )}
      </div>
    </li>
  );
}
