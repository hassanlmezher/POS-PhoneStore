"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Check, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { PayBalanceButton } from "@/features/customers/ui/pay-balance-button";
import { deletePlan, markReminded } from "@/features/installments/actions";
import type { PlanRow } from "@/features/installments/queries";
import type { PartState } from "@/features/installments/rules";
import { PlanButton } from "@/features/installments/ui/plan-dialog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = { plan: PlanRow; canPay: boolean; rate: number; rounding: number; today: string; payLabel: string };

const tone: Record<PartState, string> = {
  paid: "border-success/30 bg-success-soft text-success",
  late: "border-destructive/40 bg-destructive-soft text-destructive",
  today: "border-warning/40 bg-warning-soft text-warning",
  dueSoon: "border-warning/40 bg-warning-soft text-warning",
  partial: "border-border bg-card text-foreground",
  later: "border-border bg-card text-muted-foreground",
};

/** The parts of one plan (paid / late / due soon / later) with pay, remind, change and stop. */
export function PlanParts({ plan, canPay, rate, rounding, today, payLabel }: Props) {
  const t = useTranslations("installments");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const day = (key: string) => format.dateTime(new Date(`${key}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const next = plan.next;

  function stop() {
    startTransition(async () => {
      const res = await deletePlan(plan.id);
      if (!res.ok) return void toast.error(te("generic"));
      toast.success(t("stopped"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={plan.parts.length} aria-valuenow={plan.paidParts} aria-label={t("progress", { paid: plan.paidParts, count: plan.parts.length })}>
          <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${(plan.paidParts / plan.parts.length) * 100}%` }} />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{t("progress", { paid: plan.paidParts, count: plan.parts.length })}</span>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {plan.parts.map((p) => (
          <li key={p.id} className={cn("flex flex-col gap-0.5 rounded-lg border px-2.5 py-2", tone[p.state], next?.id === p.id && p.state !== "paid" && "ring-2 ring-primary/30")}>
            <span className="flex items-center justify-between gap-1 text-xs font-medium">
              <span>{t("partN", { n: p.number })}</span>
              <span className="inline-flex items-center gap-0.5">
                {p.state === "paid" && <Check aria-hidden className="size-3.5" />}
                {t(`states.${p.state}`)}
              </span>
            </span>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              <Ltr>{formatMoney(p.state === "paid" ? p.amountUsdCents : p.owedUsdCents, "USD")}</Ltr>
            </span>
            <span className="text-xs text-muted-foreground">{day(p.dueDay)}</span>
          </li>
        ))}
      </ol>

      {plan.note && (
        <p dir="auto" className="text-xs text-muted-foreground rtl:text-right">
          {plan.note}
        </p>
      )}

      {!plan.done && (
        <div className="flex flex-wrap items-center gap-2">
          {canPay && next && (
            <PayBalanceButton
              kind={plan.kind}
              id={plan.targetId}
              label={payLabel}
              balanceUsdCents={plan.owedUsdCents}
              prefillUsdCents={next.owedUsdCents}
              buttonLabel={t("payPart", { n: next.number })}
              hint={t.rich("payPartHint", { n: next.number, part: formatMoney(next.owedUsdCents, "USD"), left: formatMoney(plan.owedUsdCents, "USD"), m: (c) => <bdi dir="ltr">{c}</bdi> })}
              rate={rate}
              rounding={rounding}
            />
          )}
          {plan.reminder && next && (
            <Button asChild size="sm" variant={next.reminded ? "outline" : "default"} className={cn("h-10", !next.reminded && "bg-success text-success-foreground hover:bg-success/90")}>
              <a href={plan.reminder} target="_blank" rel="noopener noreferrer" onClick={() => void markReminded(next.id).then((r) => r.ok && router.refresh())}>
                <MessageCircle />
                {next.reminded ? t("remindAgain") : t("remind")}
              </a>
            </Button>
          )}
          {canPay && (
            <>
              <PlanButton kind={plan.kind} id={plan.targetId} label={payLabel} balanceUsdCents={plan.owedUsdCents} rate={rate} rounding={rounding} today={today} replacing variant="ghost" />
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" disabled={pending}>
                    <X />
                    {t("stop")}
                  </Button>
                }
                title={t("stopTitle")}
                body={t("stopBody")}
                confirmLabel={t("stop")}
                onConfirm={stop}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
