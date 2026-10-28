"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Check, CircleCheck, MessageCircle, MoreHorizontal, PackageCheck, Pencil, Plus, Truck, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markPartOrderMessage, setPartOrderStatus } from "@/features/partorders/actions";
import type { PartOrderRow } from "@/features/partorders/queries";
import { OrderDialog, type OrderDraft } from "@/features/partorders/ui/order-dialog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  rows: PartOrderRow[];
  canEdit: boolean;
  suppliers: { name: string; phone: string | null }[];
  today: string;
  rate: number;
  rounding: number;
  /** On a repair page: the repair id (shows "Order a part"); on the Parts orders page: null (shows the repair on each row). */
  ticketId: string | null;
};

/** Parts orders with one-tap WhatsApp to the supplier and the customer, "Arrived", edit and cancel. */
export function OrderList({ rows, canEdit, suppliers, today, rate, rounding, ticketId }: Props) {
  const t = useTranslations("partOrders");
  const [dialog, setDialog] = useState<{ ticketId: string; draft: OrderDraft } | null>(null);
  const [key, setKey] = useState(0);
  const blank: OrderDraft = { part: "", qty: 1, supplierName: "", supplierPhone: "", expectedDay: "", cost: "", note: "" };
  const open = (tid: string, draft: OrderDraft) => {
    setKey((k) => k + 1);
    setDialog({ ticketId: tid, draft });
  };

  return (
    <div className="flex flex-col gap-3">
      {ticketId && canEdit && (
        <Button type="button" variant="outline" className="w-full" onClick={() => open(ticketId, blank)}>
          <Plus />
          {t("orderButton")}
        </Button>
      )}
      {rows.length > 0 && (
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border">
          {rows.map((r) => (
            <OrderItem
              key={r.id}
              r={r}
              showTicket={!ticketId}
              canEdit={canEdit}
              onEdit={() =>
                open(r.ticketId, {
                  id: r.id,
                  part: r.part,
                  qty: r.qty,
                  supplierName: r.supplierName,
                  supplierPhone: r.supplierPhone ?? "",
                  expectedDay: r.expectedDay,
                  cost: r.costUsdCents !== null ? (r.costUsdCents / 100).toFixed(2) : "",
                  note: r.note ?? "",
                })
              }
            />
          ))}
        </ul>
      )}
      {dialog && (
        <OrderDialog
          key={key}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          ticketId={dialog.ticketId}
          draft={dialog.draft}
          suppliers={suppliers}
          today={today}
          rate={rate}
          rounding={rounding}
        />
      )}
    </div>
  );
}

const WHEN_STYLE = {
  late: "bg-destructive-soft text-destructive",
  today: "bg-warning-soft text-warning",
  tomorrow: "bg-muted text-foreground",
  later: "bg-muted text-muted-foreground",
} as const;

function OrderItem({ r, showTicket, canEdit, onEdit }: { r: PartOrderRow; showTicket: boolean; canEdit: boolean; onEdit: () => void }) {
  const t = useTranslations("partOrders");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ordered = r.status === "ORDERED";
  const dayLabel = format.dateTime(new Date(`${r.expectedDay}T12:00:00`), { weekday: "short", day: "numeric", month: "short" });

  function setStatus(status: "ORDERED" | "ARRIVED" | "CANCELLED") {
    startTransition(async () => {
      const res = await setPartOrderStatus(r.id, status);
      if (!res.ok) return void toast.error(te("generic"));
      toast.success(t(status === "ARRIVED" ? "markedArrived" : status === "CANCELLED" ? "cancelled" : "reopened"));
      router.refresh();
    });
  }
  const mark = (to: "supplier" | "customer") => void markPartOrderMessage(r.id, to).then((res) => res.ok && router.refresh());

  return (
    <li className={cn("flex flex-col gap-3 p-3 sm:p-4", r.status === "CANCELLED" && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            <span dir="auto">{r.part}</span>
            {r.qty > 1 && <span className="ms-1 text-muted-foreground">× {r.qty}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            <span dir="auto">{r.supplierName}</span>
            {r.costUsdCents !== null && (
              <>
                {" · "}
                <Ltr>{formatMoney(r.costUsdCents, "USD")}</Ltr>
              </>
            )}
          </p>
          {showTicket && (
            <p className="text-sm">
              <Link href={`/tickets/${r.ticketNumber}`} className="font-semibold hover:underline">
                <Ltr>{r.ticketLabel}</Ltr>
              </Link>
              <span className="text-muted-foreground">
                {" · "}
                <span dir="auto">{r.device}</span> · <span dir="auto">{r.customer}</span>
              </span>
            </p>
          )}
          {r.note && (
            <p dir="auto" className="text-xs text-muted-foreground rtl:text-right">
              {r.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 rtl:items-start">
          {ordered ? (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", WHEN_STYLE[r.when])}>
              {r.when === "late" ? t("lateSince", { date: dayLabel }) : r.when === "today" ? t("dueToday") : r.when === "tomorrow" ? t("dueTomorrow") : t("dueOn", { date: dayLabel })}
            </span>
          ) : r.status === "ARRIVED" ? (
            <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
              <CircleCheck className="size-3.5" aria-hidden />
              {t("arrived")}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t("statusCancelled")}</span>
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("more")} disabled={pending}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ordered && (
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil />
                    {t("changeOrder")}
                  </DropdownMenuItem>
                )}
                {ordered ? (
                  <DropdownMenuItem onSelect={() => setStatus("CANCELLED")} className="text-destructive">
                    <X />
                    {t("cancelOrder")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setStatus("ORDERED")}>
                    <Undo2 />
                    {t("reopen")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {ordered && canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-10" onClick={() => setStatus("ARRIVED")} disabled={pending}>
            <PackageCheck />
            {t("markArrived")}
          </Button>
          {r.supplierUrl && (
            <Button asChild size="sm" variant="outline" className="h-10">
              <a href={r.supplierUrl} target="_blank" rel="noopener noreferrer" onClick={() => mark("supplier")}>
                {r.supplierSent ? <Check className="text-success" /> : <Truck />}
                {r.supplierSent ? t("supplierSent") : t("sendSupplier")}
              </a>
            </Button>
          )}
          {r.customerUrl && (
            <Button asChild size="sm" variant="outline" className="h-10">
              <a href={r.customerUrl} target="_blank" rel="noopener noreferrer" onClick={() => mark("customer")}>
                {r.customerTold ? <Check className="text-success" /> : <MessageCircle className="text-success" />}
                {r.customerTold ? t("customerTold") : t("tellCustomer")}
              </a>
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
