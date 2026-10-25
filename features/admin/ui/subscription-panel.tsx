"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarPlus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Field, fieldAria } from "@/components/field";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { recordSubscriptionPayment, updateSubscription } from "@/features/admin/actions";
import { formatMoney } from "@/lib/money";

const STATUSES = ["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED"] as const;
type Status = (typeof STATUSES)[number];

type Props = {
  shopId: string;
  sub: { planId: string | null; subscriptionStatus: Status; trialEndsAt: Date | null; paidUntil: Date | null };
  plans: { id: string; name: string; priceUsdCents: number; active: boolean }[];
  payments: { id: string; amountUsdCents: number; method: string; periodStart: Date; periodEnd: Date; note: string | null; createdAt: Date }[];
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
function addMonths(isoDay: string, months: number) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  // Clamp month overflow (Jan 31 + 1 month → Feb 28/29).
  if (date.getUTCDate() !== d) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

export function SubscriptionPanel({ shopId, sub, plans, payments }: Props) {
  const t = useTranslations("admin.sub");
  const ts = useTranslations("admin.subStatus");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState({ planId: sub.planId ?? "", subscriptionStatus: sub.subscriptionStatus, trialEndsAt: iso(sub.trialEndsAt), paidUntil: iso(sub.paidUntil) });
  const [subErrors, setSubErrors] = useState<Record<string, string>>({});

  const start = today();
  const [p, setP] = useState({ amount: "", method: "", periodStart: start, periodEnd: addMonths(start, 1), note: "" });
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const amountRef = useRef<HTMLInputElement>(null);

  const plan = plans.find((x) => x.id === s.planId);
  const suspending = s.subscriptionStatus === "SUSPENDED" && sub.subscriptionStatus !== "SUSPENDED";

  function saveSub() {
    startTransition(async () => {
      const res = await updateSubscription(shopId, s);
      if (!res.ok) {
        setSubErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(te("generic"));
        return;
      }
      setSubErrors({});
      toast.success(t("saved"));
      router.refresh();
    });
  }

  /** +1 month / +1 year: prefill a payment that continues from the current paid period. */
  function prefill(months: number) {
    const from = s.paidUntil && s.paidUntil > today() ? s.paidUntil : today();
    const price = plan ? (plan.priceUsdCents * months) / 100 : null;
    setP((x) => ({ ...x, periodStart: from, periodEnd: addMonths(from, months), amount: price !== null ? String(price) : x.amount }));
    setPayErrors({});
    requestAnimationFrame(() => {
      amountRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      amountRef.current?.focus();
    });
  }

  function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!p.amount.trim()) local.amount = "required";
    if (!p.method.trim()) local.method = "required";
    if (!p.periodStart) local.periodStart = "required";
    if (!p.periodEnd || p.periodEnd <= p.periodStart) local.periodEnd = "invalidDate";
    setPayErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const res = await recordSubscriptionPayment(shopId, p);
      if (!res.ok) {
        setPayErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(te("generic"));
        return;
      }
      toast.success(t("paymentRecorded"));
      setS((x) => ({ ...x, subscriptionStatus: "ACTIVE", paidUntil: x.paidUntil > p.periodEnd ? x.paidUntil : p.periodEnd }));
      const next = p.periodEnd;
      setP({ amount: "", method: p.method, periodStart: next, periodEnd: addMonths(next, 1), note: "" });
      router.refresh();
    });
  }

  const date = (d: Date) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const saveButton = (
    <Button type="button" disabled={pending} onClick={suspending ? undefined : saveSub} variant={suspending ? "destructive" : "default"}>
      {pending ? tc("saving") : suspending ? t("suspend") : tc("save")}
    </Button>
  );

  return (
    <>
      <SectionCard
        title={t("title")}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => prefill(1)}>
              <CalendarPlus />
              {t("plusMonth")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => prefill(12)}>
              <CalendarPlus />
              {t("plusYear")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("plan")} htmlFor="sub-plan" error={subErrors.planId}>
              <NativeSelect {...fieldAria("sub-plan", subErrors.planId)} value={s.planId} onChange={(e) => setS({ ...s, planId: e.target.value })}>
                <option value="">{t("noPlan")}</option>
                {plans.map((x) => (
                  <option key={x.id} value={x.id} disabled={!x.active && x.id !== sub.planId}>
                    {x.name} · {formatMoney(x.priceUsdCents, "USD")}
                    {!x.active ? ` (${t("inactivePlan")})` : ""}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("status")} htmlFor="sub-status" error={subErrors.subscriptionStatus}>
              <NativeSelect
                {...fieldAria("sub-status", subErrors.subscriptionStatus)}
                value={s.subscriptionStatus}
                onChange={(e) => setS({ ...s, subscriptionStatus: e.target.value as Status })}
              >
                {STATUSES.map((x) => (
                  <option key={x} value={x}>
                    {ts(x)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("trialEnds")} htmlFor="sub-trial" error={subErrors.trialEndsAt} optional>
              <Input {...fieldAria("sub-trial", subErrors.trialEndsAt)} type="date" dir="ltr" className="text-start" value={s.trialEndsAt} onChange={(e) => setS({ ...s, trialEndsAt: e.target.value })} />
            </Field>
            <Field label={t("paidUntil")} htmlFor="sub-paid" error={subErrors.paidUntil} optional>
              <Input {...fieldAria("sub-paid", subErrors.paidUntil)} type="date" dir="ltr" className="text-start" value={s.paidUntil} onChange={(e) => setS({ ...s, paidUntil: e.target.value })} />
            </Field>
          </div>
          {suspending && (
            <p role="status" className="rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
              {t("suspendHint")}
            </p>
          )}
          <div className="flex justify-end">
            {suspending ? (
              <ConfirmDialog trigger={saveButton} title={t("suspendTitle")} body={t("suspendBody")} confirmLabel={t("suspend")} onConfirm={saveSub} />
            ) : (
              saveButton
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("paymentTitle")} description={t("paymentDescription")}>
        <form onSubmit={recordPayment} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("amount")} htmlFor="pay-amount" error={payErrors.amount}>
              <div className="relative">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" dir="ltr">
                  $
                </span>
                <Input
                  {...fieldAria("pay-amount", payErrors.amount)}
                  ref={amountRef}
                  inputMode="decimal"
                  dir="ltr"
                  className="ps-7 text-start tabular-nums"
                  placeholder="0.00"
                  value={p.amount}
                  onChange={(e) => setP({ ...p, amount: e.target.value })}
                />
              </div>
            </Field>
            <Field label={t("method")} htmlFor="pay-method" error={payErrors.method} hint={t("methodHint")}>
              <Input {...fieldAria("pay-method", payErrors.method)} list="pay-methods" maxLength={40} value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })} />
              <datalist id="pay-methods">
                {(["cash", "whish", "omt", "transfer"] as const).map((m) => (
                  <option key={m} value={t(`methods.${m}`)} />
                ))}
              </datalist>
            </Field>
            <Field label={t("periodStart")} htmlFor="pay-start" error={payErrors.periodStart}>
              <Input {...fieldAria("pay-start", payErrors.periodStart)} type="date" dir="ltr" className="text-start" value={p.periodStart} onChange={(e) => setP({ ...p, periodStart: e.target.value })} />
            </Field>
            <Field label={t("periodEnd")} htmlFor="pay-end" error={payErrors.periodEnd}>
              <Input {...fieldAria("pay-end", payErrors.periodEnd)} type="date" dir="ltr" className="text-start" value={p.periodEnd} onChange={(e) => setP({ ...p, periodEnd: e.target.value })} />
            </Field>
          </div>
          <Field label={t("note")} htmlFor="pay-note" optional error={payErrors.note}>
            <Textarea {...fieldAria("pay-note", payErrors.note)} rows={2} maxLength={300} value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              <Receipt />
              {pending ? tc("saving") : t("record")}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title={t("historyTitle")} padded={false}>
        {payments.length === 0 ? (
          <EmptyState icon={Receipt} title={t("historyEmpty")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("recordedAt")}</TableHead>
                <TableHead className="text-end">{t("amount")}</TableHead>
                <TableHead className="hidden 2xl:table-cell">{t("method")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("period")}</TableHead>
                <TableHead className="hidden 2xl:table-cell">{t("note")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="py-2.5 whitespace-nowrap">
                    {date(x.createdAt)}
                    {/* Narrow screens: method and period under the date (their columns are hidden). */}
                    <span className="block text-xs text-muted-foreground xl:hidden">
                      {date(x.periodStart)} – {date(x.periodEnd)}
                    </span>
                    <span className="block text-xs text-muted-foreground 2xl:hidden">{x.method}</span>
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    <bdi dir="ltr" className="tabular-nums">
                      {formatMoney(x.amountUsdCents, "USD")}
                    </bdi>
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell">{x.method}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                    {date(x.periodStart)} – {date(x.periodEnd)}
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate text-muted-foreground 2xl:table-cell">{x.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}
