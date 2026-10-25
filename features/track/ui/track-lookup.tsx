"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Ban, Check, CircleAlert, Clock, LoaderCircle, PackageSearch, Search, ShieldCheck, Wrench } from "lucide-react";
import { Field } from "@/components/field";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { StatusBadge, type TicketStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupTicket, type TrackResult } from "@/features/track/actions";
import { cn } from "@/lib/utils";

const STEPS = ["RECEIVED", "DIAGNOSING", "REPAIRING", "READY", "PICKED_UP"] as const;

/** Where each status sits on the 5-step progress bar (index of the current step). */
const STEP_OF: Record<TicketStatus, number> = {
  RECEIVED: 0,
  DIAGNOSING: 1,
  WAITING_PART: 2,
  REPAIRING: 2,
  READY: 3,
  PICKED_UP: 4,
  CANCELLED: -1,
  CANT_FIX: -1,
};

type Props = { defaultTicket: string; rate: number; rounding: number; ticketPrefix: string; countryCode: string };

export function TrackLookup({ defaultTicket, rate, rounding, ticketPrefix, countryCode }: Props) {
  const t = useTranslations("track");
  const [state, action, pending] = useActionState<TrackResult | undefined, FormData>(lookupTicket, undefined);
  const resultRef = useRef<HTMLDivElement>(null);
  // Controlled so the fields survive React's form reset after each lookup (easy retry).
  const [ticket, setTicket] = useState(defaultTicket);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (state?.ok) resultRef.current?.focus();
  }, [state]);

  const error = state && !state.ok ? state : null;

  return (
    <>
      <form action={action} className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card sm:p-6" noValidate>
        <Field label={t("ticket")} htmlFor="trk-ticket" hint={t("ticketHint")}>
          <Input
            id="trk-ticket"
            name="ticket"
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            autoFocus={!defaultTicket}
            required
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder={ticketPrefix ? `${ticketPrefix}…` : undefined}
            className="h-12 text-start font-mono text-base uppercase"
            aria-describedby="trk-ticket-msg"
          />
        </Field>
        <Field label={t("phone")} htmlFor="trk-phone" hint={t("phoneHint")}>
          <Input
            id="trk-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus={!!defaultTicket}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            dir="ltr"
            placeholder={`+${countryCode}`}
            className="h-12 text-start text-base"
            aria-describedby="trk-phone-msg"
          />
        </Field>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-destructive-soft px-3 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              {error.error === "rateLimited"
                ? t("errors.rateLimited", { minutes: Math.max(1, Math.ceil((error.retryAfterSec ?? 60) / 60)) })
                : t(`errors.${error.error}`)}
            </p>
          </div>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? <LoaderCircle className="animate-spin" /> : <Search />}
          {pending ? t("checking") : t("check")}
        </Button>
      </form>

      {pending && !state?.ok && <ResultSkeleton />}
      {state?.ok && (
        <div ref={resultRef} tabIndex={-1} className="outline-none" aria-live="polite">
          <ResultCard ticket={state.ticket} rate={rate} rounding={rounding} />
        </div>
      )}
    </>
  );
}

function ResultSkeleton() {
  return (
    <div aria-hidden className="flex animate-pulse flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <div className="h-5 w-24 rounded bg-muted" />
      <div className="h-7 w-48 rounded bg-muted" />
      <div className="h-2 w-full rounded bg-muted" />
      <div className="h-16 w-full rounded bg-muted" />
    </div>
  );
}

type Ticket = Extract<TrackResult, { ok: true }>["ticket"];

function ResultCard({ ticket, rate, rounding }: { ticket: Ticket; rate: number; rounding: number }) {
  const t = useTranslations("track");
  const ts = useTranslations("status");
  const format = useFormatter();
  const status = ticket.status as TicketStatus;
  const date = (d: Date) => format.dateTime(new Date(d), { dateStyle: "medium" });
  const dateTime = (d: Date) => format.dateTime(new Date(d), { dateStyle: "medium", timeStyle: "short" });
  const ended = status === "CANCELLED" || status === "CANT_FIX";
  const warrantyActive = ticket.warrantyUntil && new Date(ticket.warrantyUntil) > new Date();

  const facts: [string, React.ReactNode][] = [
    [t("device"), ticket.device],
    [t("received"), date(ticket.receivedAt)],
    ...(ticket.promisedAt && !ticket.pickedUpAt && !ended ? [[t("promised"), date(ticket.promisedAt)] as [string, React.ReactNode]] : []),
    ...(ticket.pickedUpAt ? [[t("pickedUp"), date(ticket.pickedUpAt)] as [string, React.ReactNode]] : []),
  ];

  return (
    <article aria-labelledby="trk-result-title" className="overflow-hidden rounded-xl border bg-card shadow-card">
      <header className="flex flex-col gap-3 border-b p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("ticketLabel")} <Ltr className="font-medium text-foreground">{ticket.label}</Ltr>
          </p>
          <StatusBadge status={status} />
        </div>
        <h2 id="trk-result-title" className="text-xl font-semibold tracking-tight text-balance">
          {t(`headline.${status}`)}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(`explain.${status}`)}</p>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {ended ? (
          <div className={cn("flex items-start gap-3 rounded-lg p-3 text-sm", status === "CANCELLED" ? "bg-status-cancelled text-status-cancelled-foreground" : "bg-status-cant-fix text-status-cant-fix-foreground")}>
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{t(status === "CANCELLED" ? "endedCancelled" : "endedCantFix")}</p>
          </div>
        ) : (
          <Stepper status={status} />
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 truncate text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        {ticket.balanceUsdCents > 0 && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3">
            <div>
              <p className="text-sm font-medium text-warning">{t("balanceDue")}</p>
              <p className="text-xs text-muted-foreground">{t("balanceHint")}</p>
            </div>
            <Money usdCents={ticket.balanceUsdCents} rate={rate} rounding={rounding} className="shrink-0 items-end text-lg rtl:items-start" />
          </div>
        )}

        {ticket.warrantyUntil && (
          <div className={cn("flex items-center gap-3 rounded-lg px-4 py-3 text-sm", warrantyActive ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
            <ShieldCheck className="size-5 shrink-0" aria-hidden />
            <p>{warrantyActive ? t("warrantyUntil", { date: date(ticket.warrantyUntil) }) : t("warrantyEnded", { date: date(ticket.warrantyUntil) })}</p>
          </div>
        )}

        {ticket.timeline.length > 0 && (
          <section aria-labelledby="trk-timeline">
            <h3 id="trk-timeline" className="mb-3 text-sm font-semibold">
              {t("timeline")}
            </h3>
            <ol className="relative flex flex-col gap-4 border-s ps-5">
              {[...ticket.timeline].reverse().map((e, i) => (
                <li key={`${e.status}-${i}`} className="relative">
                  <span
                    aria-hidden
                    className={cn("absolute -start-[1.6rem] top-1 size-3 rounded-full border-2 border-card", i === 0 ? "bg-primary" : "bg-subtle-foreground")}
                  />
                  <p className={cn("text-sm", i === 0 ? "font-medium" : "text-muted-foreground")}>{ts(e.status as TicketStatus)}</p>
                  <p className="text-xs text-muted-foreground">{dateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </article>
  );
}

function Stepper({ status }: { status: TicketStatus }) {
  const t = useTranslations("track");
  const ts = useTranslations("status");
  const current = STEP_OF[status];
  const waiting = status === "WAITING_PART";
  const done = status === "PICKED_UP";

  return (
    <ol aria-label={t("progress")} className="grid grid-cols-5 gap-1">
      {STEPS.map((step, i) => {
        const complete = i < current || done;
        const isCurrent = i === current && !done;
        const label = isCurrent && waiting ? ts("WAITING_PART") : ts(step);
        return (
          <li key={step} aria-current={isCurrent ? "step" : undefined} className="flex min-w-0 flex-col items-center gap-2 text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "invisible" : complete || isCurrent ? "bg-primary" : "bg-border")} />
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  complete && "border-primary bg-primary text-primary-foreground",
                  isCurrent && !waiting && "border-primary bg-primary-soft text-primary",
                  isCurrent && waiting && "border-status-waiting-part-foreground bg-status-waiting-part text-status-waiting-part-foreground",
                  !complete && !isCurrent && "border-border bg-card text-subtle-foreground",
                )}
              >
                {complete ? (
                  <Check className="size-4" aria-hidden />
                ) : isCurrent && waiting ? (
                  <PackageSearch className="size-4" aria-hidden />
                ) : isCurrent && step === "REPAIRING" ? (
                  <Wrench className="size-4" aria-hidden />
                ) : isCurrent ? (
                  <Clock className="size-4" aria-hidden />
                ) : (
                  <span className="text-xs font-medium tabular-nums">{i + 1}</span>
                )}
              </span>
              <span className={cn("h-0.5 flex-1", i === STEPS.length - 1 ? "invisible" : complete ? "bg-primary" : "bg-border")} />
            </div>
            <span
              className={cn(
                "line-clamp-2 text-[11px] leading-tight sm:text-xs",
                isCurrent ? "font-semibold text-foreground" : complete ? "text-foreground" : "text-muted-foreground",
                isCurrent && waiting && "text-status-waiting-part-foreground",
              )}
            >
              {label}
              <span className="sr-only">{complete ? ` (${t("stepDone")})` : isCurrent ? ` (${t("stepCurrent")})` : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
