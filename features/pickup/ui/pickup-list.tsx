"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, Check, LoaderCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { chargeStorageFee, markPickupReminder } from "@/features/pickup/actions";
import { PICKUP_STAGES } from "@/features/pickup/rules";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Compact row data built on the server (wa.me link included, so the click opens WhatsApp at once). */
export type PickupRow = {
  id: string;
  number: number;
  label: string;
  device: string;
  customer: string;
  days: number;
  readySince: string;
  balanceUsdCents: number;
  remindersSent: number;
  remindedAt: string | null;
  /** Reminders that should have gone out by now (day 3, 14, 30). */
  dueStage: number;
  /** The reminder the WhatsApp button sends. */
  nextStage: number;
  waUrl: string | null;
  storageDueUsdCents: number;
  storageChargedUsdCents: number;
};

type Props = { rows: PickupRow[]; rate: number; rounding: number; canRemind: boolean; canCharge: boolean };

export function PickupList({ rows, rate, rounding, canRemind, canCharge }: Props) {
  const t = useTranslations("pickup");
  const dueCount = rows.filter((r) => r.dueStage > r.remindersSent).length;
  const [filter, setFilter] = useState<"all" | "due">("all");
  const shown = filter === "due" ? rows.filter((r) => r.dueStage > r.remindersSent) : rows;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label={t("filter")}
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: "all", label: t("filterAll", { count: rows.length }) },
          { value: "due", label: t("filterDue", { count: dueCount }) },
        ]}
        className="w-fit"
      />
      {shown.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">{t("noneDue")}</p>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {shown.map((r) => (
            <PickupItem key={r.id} row={r} rate={rate} rounding={rounding} canRemind={canRemind} canCharge={canCharge} />
          ))}
        </ul>
      )}
    </div>
  );
}

function daysTone(days: number) {
  if (days >= 30) return "bg-destructive-soft text-destructive";
  if (days >= 14) return "bg-warning-soft text-warning";
  if (days >= 3) return "bg-status-ready text-status-ready-foreground";
  return "bg-muted text-muted-foreground";
}

function PickupItem({ row: r, rate, rounding, canRemind, canCharge }: { row: PickupRow; rate: number; rounding: number; canRemind: boolean; canCharge: boolean }) {
  const t = useTranslations("pickup");
  const router = useRouter();
  const [charging, startCharge] = useTransition();
  const due = r.dueStage > r.remindersSent;
  const feeToAdd = r.storageDueUsdCents - r.storageChargedUsdCents;

  function remind() {
    // The link opens WhatsApp in a new tab; this only records which reminder went out.
    void markPickupReminder(r.id, r.nextStage).then((res) => {
      if (res.ok) router.refresh();
    });
  }

  function charge() {
    startCharge(async () => {
      const res = await chargeStorageFee(r.id);
      if (!res.ok) return void toast.error(t("chargeFailed"));
      toast.success(t("charged"));
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-lg leading-none", daysTone(r.days))}>
          <span className="text-lg font-semibold tabular-nums">{r.days}</span>
          <span className="mt-0.5 text-[10px]">{t("daysShort", { count: r.days })}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <Link href={`/tickets/${r.number}`} className="hover:underline">
              <Ltr>{r.label}</Ltr>
            </Link>
            <span className="text-xs font-normal text-muted-foreground">{t("readySince", { date: r.readySince })}</span>
          </p>
          <p dir="auto" className="truncate font-medium rtl:text-right">{r.device}</p>
          <p dir="auto" className="truncate text-sm text-muted-foreground rtl:text-right">{r.customer}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1" aria-label={t("remindersSent", { count: r.remindersSent })}>
              {PICKUP_STAGES.map((d, i) => (
                <span
                  key={d}
                  title={t("stage", { day: d })}
                  className={cn("size-2 rounded-full", i < r.remindersSent ? "bg-success" : i < r.dueStage ? "bg-warning" : "bg-border")}
                />
              ))}
              <span className="ms-1 text-muted-foreground">
                {r.remindersSent > 0 && r.remindedAt ? t("lastReminder", { count: r.remindersSent, date: r.remindedAt }) : t("noReminder")}
              </span>
            </span>
            {due && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">{t("reminderDue")}</span>}
            {r.storageChargedUsdCents > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Check className="size-3.5" aria-hidden />
                {t("feeAdded", { fee: formatMoney(r.storageChargedUsdCents, "USD") })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {r.balanceUsdCents > 0 && (
          <div className="me-auto text-sm sm:me-2">
            <span className="block text-xs text-muted-foreground">{t("toPay")}</span>
            <Money usdCents={r.balanceUsdCents} rate={rate} rounding={rounding} layout="inline" />
          </div>
        )}
        {canCharge && feeToAdd > 0 && (
          <Button variant="outline" size="sm" className="h-10" onClick={charge} disabled={charging}>
            {charging ? <LoaderCircle className="animate-spin" /> : <Archive />}
            {t(r.storageChargedUsdCents > 0 ? "updateFee" : "addFee", { fee: formatMoney(r.storageDueUsdCents, "USD") })}
          </Button>
        )}
        {canRemind && r.waUrl && (
          <Button asChild size="sm" variant={due ? "default" : "outline"} className={cn("h-10", due && "bg-success text-success-foreground hover:bg-success/90")}>
            <a href={r.waUrl} target="_blank" rel="noopener noreferrer" onClick={remind}>
              <MessageCircle />
              {r.remindersSent >= PICKUP_STAGES.length ? t("sendAgain") : t("sendReminder", { n: r.nextStage })}
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}
