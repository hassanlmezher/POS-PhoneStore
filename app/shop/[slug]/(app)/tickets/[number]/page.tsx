import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight, BadgeCheck, CalendarClock, ChevronLeft, MessageSquareText, Phone, RotateCcw, ShieldCheck, ShoppingCart, UserRound } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approvalWhatsApp } from "@/features/approvals/link";
import { ApprovalCard, type ApprovalView } from "@/features/approvals/ui/approval-card";
import { suggestedTemplate, ticketWhatsAppLinks } from "@/features/tickets/notify";
import { checkWhatsApp } from "@/features/followups/message";
import { FollowupButton } from "@/features/followups/ui/followup-button";
import { ComebackDialog } from "@/features/comebacks/ui/comeback-dialog";
import { getTicketByNumber, listTechnicians } from "@/features/tickets/queries";
import { CreatedBanner } from "@/features/tickets/ui/detail/created-banner";
import { EditDetailsButton } from "@/features/tickets/ui/detail/edit-details-dialog";
import { PrintMenu, WhatsAppMenu } from "@/features/tickets/ui/detail/header-menus";
import { ItemsCard } from "@/features/tickets/ui/detail/items-card";
import { NoteForm } from "@/features/tickets/ui/detail/note-form";
import { PasscodePanel } from "@/features/tickets/ui/detail/passcode-panel";
import { PaymentForm } from "@/features/tickets/ui/detail/payment-form";
import { StatusControl } from "@/features/tickets/ui/detail/status-control";
import { TechnicianSelect } from "@/features/tickets/ui/detail/technician-select";
import { isOverdue } from "@/features/tickets/ui/ticket-utils";
import { WarrantyBadge } from "@/features/tickets/ui/warranty-badge";
import { formatMoney } from "@/lib/money";
import { formatTicketNumber, parseTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { requireShop } from "@/lib/tenant";
import { cn } from "@/lib/utils";

function Card({ title, children, className, action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-card", className)}>
      <header className="flex min-h-14 items-center gap-3 border-b px-4 py-3 sm:px-6">
        <h2 className="font-semibold">{title}</h2>
        {action && <div className="ms-auto">{action}</div>}
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export default async function TicketPage({ params, searchParams }: PageProps<"/shop/[slug]/tickets/[number]">) {
  const { slug, number: raw } = await params;
  const sp = await searchParams;
  const number = parseTicketNumber(raw);
  if (number === null) notFound();
  const ctx = await requireShop(slug);
  const { shop, user, readOnly } = ctx;
  const ticket = await getTicketByNumber(ctx, number);
  if (!ticket) notFound();

  const [links, technicians, t, ta, tm, ts, tap, format, approvals] = await Promise.all([
    ticketWhatsAppLinks(ctx, ticket),
    listTechnicians(shop.id),
    getTranslations("ticket"),
    getTranslations("accessories"),
    getTranslations("paymentMethods"),
    getTranslations("status"),
    getTranslations("approval"),
    getFormatter(),
    ctx.db.priceApproval.findMany({
      where: { ticketId: ticket.id, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
  ]);

  const label = formatTicketNumber(shop.ticketPrefix, ticket.number);
  const rate = shop.exchangeRate;
  const rounding = shop.lbpRounding;
  const canStatus = can(user.role, "tickets.status") && !readOnly;
  const canItems = can(user.role, "tickets.items") && !readOnly;
  const canEdit = can(user.role, "tickets.create") && !readOnly;
  const canPos = can(user.role, "pos") && !readOnly;
  const overdue = isOverdue(ticket.promisedAt, ticket.status);
  const tcb = await getTranslations("comebacks");
  // After pickup: the "how is your phone?" check message.
  const followup =
    ticket.status === "PICKED_UP" && ticket.customer.phone
      ? { check: await checkWhatsApp(shop, ticket), tf: await getTranslations("followups") }
      : null;
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });

  // Latest price approval request (cancelled ones are hidden); pending ones get their WhatsApp link.
  const latest = approvals[0];
  const approval: ApprovalView | null = latest
    ? {
        id: latest.id,
        status: latest.status as ApprovalView["status"],
        amountUsdCents: latest.amountUsdCents,
        previousUsdCents: latest.previousUsdCents,
        reason: latest.reason,
        sentAt: dt(latest.createdAt),
        answeredAt: latest.respondedAt ? dt(latest.respondedAt) : null,
        ...(latest.status === "PENDING" &&
          (await approvalWhatsApp(shop, ticket.customer, { number: ticket.number, device: ticket.device }, latest).then((w) => ({ waUrl: w.url, link: w.link })))),
      }
    : null;
  const closed = ticket.status === "PICKED_UP" || ticket.status === "CANCELLED";
  const showApproval = !!approval || (canStatus && !closed);

  type Entry = { id: string; at: Date; who: string; kind: "status" | "note" | "approval"; from?: string | null; to?: string; body?: string | null; text?: string };
  // "@key" notes are written by the system and translated here.
  const systemNote = (note: string | null) => (note === "@approvedByCustomer" ? tap("systemApproved") : note);
  const timeline: Entry[] = [
    ...ticket.statusLogs.map((l) => ({ id: l.id, at: l.createdAt, who: l.user.name, kind: "status" as const, from: l.from, to: l.to, body: systemNote(l.note) })),
    ...ticket.notes.map((n) => ({ id: n.id, at: n.createdAt, who: n.user.name, kind: "note" as const, body: n.body })),
    ...approvals.flatMap((a) => {
      const price = formatMoney(a.amountUsdCents, "USD");
      const asked: Entry = { id: `${a.id}-ask`, at: a.createdAt, who: a.createdBy.name, kind: "approval", text: tap("timelineAsked", { price }), body: a.reason };
      if (!a.respondedAt || a.status === "PENDING") return [asked];
      const answer: Entry = {
        id: `${a.id}-answer`,
        at: a.respondedAt,
        who: ticket.customer.name,
        kind: "approval",
        text: tap(a.status === "APPROVED" ? "timelineApproved" : "timelineDeclined", { price }),
      };
      return [asked, answer];
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="flex flex-col gap-6">
      <nav>
        <Link href="/tickets" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t("backToRepairs")}
        </Link>
      </nav>

      {sp.created === "1" && (
        <CreatedBanner number={ticket.number} label={label} receivedUrl={links.find((l) => l.key === "TICKET_RECEIVED")?.url} />
      )}

      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <Ltr>{label}</Ltr>
            </h1>
            <StatusBadge status={ticket.status} />
            {overdue && <Badge variant="destructive">{t("overdue")}</Badge>}
            {approval?.status === "PENDING" && <Badge variant="warning">{tap("chipPending")}</Badge>}
            {ticket.comebackOf && <Badge variant="warning">{tcb("badge")}</Badge>}
          </div>
          {ticket.comebackOf && (
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <RotateCcw aria-hidden className="size-4" />
              {tcb.rich("comebackOf", {
                ticket: formatTicketNumber(shop.ticketPrefix, ticket.comebackOf.number),
                l: (c) => (
                  <Link href={`/tickets/${ticket.comebackOf!.number}`} className="font-medium text-primary hover:underline">
                    <Ltr>{c}</Ltr>
                  </Link>
                ),
              })}
              {ticket.comebackOf.assignedTo && <span>· {tcb("firstTech", { name: ticket.comebackOf.assignedTo.name })}</span>}
            </p>
          )}
          <p className="text-lg font-medium">{ticket.device}</p>
          <div className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
            <Link href={`/customers/${ticket.customer.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-foreground hover:text-primary">
              <UserRound aria-hidden className="size-4 text-muted-foreground" />
              {ticket.customer.name}
            </Link>
            <a href={`tel:${ticket.customer.phone}`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-primary">
              <Phone aria-hidden className="size-4" />
              <Ltr>{formatPhone(ticket.customer.phone, ctx.shop.countryCode)}</Ltr>
            </a>
            {ticket.promisedAt && (
              <span className={cn("inline-flex min-h-11 items-center gap-1.5", overdue && "font-medium text-destructive")}>
                <CalendarClock aria-hidden className="size-4" />
                {t("promisedOn", { date: format.dateTime(ticket.promisedAt, { dateStyle: "medium" }) })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canStatus && <StatusControl ticketId={ticket.id} status={ticket.status} />}
          <WhatsAppMenu links={links} suggested={suggestedTemplate(ticket.status, ticket.balanceUsdCents)} />
          <PrintMenu number={ticket.number} />
          {canEdit && (
            <EditDetailsButton
              ticketId={ticket.id}
              rate={rate}
              rounding={rounding}
              details={{
                imei: ticket.imei,
                color: ticket.color,
                problem: ticket.problem,
                conditionNotes: ticket.conditionNotes,
                accessories: ticket.accessories,
                estimateUsdCents: ticket.estimateUsdCents,
                promisedAt: ticket.promisedAt,
                warrantyDays: ticket.warrantyDays,
              }}
            />
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title={t("deviceInfo")}>
            <dl className="flex flex-col gap-3">
              <Row label={t("device")}>{ticket.device}</Row>
              <Row label={t("imei")}>{ticket.imei ? <Ltr className="font-mono">{ticket.imei}</Ltr> : <span className="text-subtle-foreground">—</span>}</Row>
              <Row label={t("color")}>{ticket.color || <span className="text-subtle-foreground">—</span>}</Row>
              <Row label={t("accessoriesLeft")}>
                {ticket.accessories.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {ticket.accessories.map((a) => (
                      <Badge key={a} variant="secondary">
                        {ta.has(a) ? ta(a) : a}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-subtle-foreground">{t("none")}</span>
                )}
              </Row>
              <Row label={t("condition")}>{ticket.conditionNotes || <span className="text-subtle-foreground">—</span>}</Row>
            </dl>
            <div className="mt-5 border-t pt-4">
              <PasscodePanel ticketId={ticket.id} hasPasscode={ticket.hasPasscode} hasPattern={ticket.hasPattern} canEdit={canEdit} />
            </div>
          </Card>

          <Card title={t("problem")}>
            <p className="text-sm leading-relaxed whitespace-pre-line">{ticket.problem}</p>
          </Card>

          <ItemsCard
            ticketId={ticket.id}
            items={ticket.items}
            totalUsdCents={ticket.totalUsdCents}
            canEdit={canItems}
            rate={rate}
            rounding={rounding}
            free={!!ticket.comebackOf}
          />

          <Card title={t("timeline")}>
            <div className="flex flex-col gap-6">
              <NoteForm ticketId={ticket.id} />
              <ol className="relative flex flex-col gap-5 before:absolute before:inset-y-1 before:start-[15px] before:w-px before:bg-border">
                {timeline.map((e) => (
                  <li key={e.id} className="relative flex gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card",
                        e.kind === "note" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {e.kind === "note" ? (
                        <MessageSquareText className="size-4" />
                      ) : e.kind === "approval" ? (
                        <BadgeCheck className="size-4" />
                      ) : (
                        <ArrowRight className="size-4 rtl:rotate-180" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium">{e.who}</span>
                        {e.kind === "status" ? (
                          e.from ? (
                            <span className="text-muted-foreground">
                              {t("movedFromTo", { from: ts(e.from as never), to: ts(e.to as never) })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t("createdEvent")}</span>
                          )
                        ) : e.kind === "approval" ? (
                          <span className="text-muted-foreground">{e.text}</span>
                        ) : (
                          <span className="text-muted-foreground">{t("addedNote")}</span>
                        )}
                        <span className="text-xs text-subtle-foreground">{dt(e.at)}</span>
                      </div>
                      {e.body && <p className="mt-1.5 rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">{e.body}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {showApproval && (
            <Card title={tap("title")}>
              <ApprovalCard
                ticketId={ticket.id}
                current={approval}
                canManage={canStatus && !closed}
                defaultUsdCents={ticket.chargeUsdCents}
                rate={rate}
                rounding={rounding}
              />
            </Card>
          )}
          <Card title={t("money")}>
            <dl className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-sm text-muted-foreground">
                  {t("charge")}
                  <span className="block text-xs text-subtle-foreground">{ticket.items.length ? t("fromItems") : t("fromEstimate")}</span>
                </dt>
                <dd>
                  <Money usdCents={ticket.chargeUsdCents} rate={rate} rounding={rounding} className="items-end rtl:items-start" />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-sm text-muted-foreground">{t("paid")}</dt>
                <dd>
                  <Money usdCents={ticket.paidUsdCents} rate={rate} rounding={rounding} className="items-end rtl:items-start" usdClassName="text-success" />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t pt-3">
                {ticket.balanceUsdCents < 0 ? (
                  <dt className="font-medium text-destructive">
                    {t("refundDue")}
                    <span className="block text-xs font-normal text-muted-foreground">{t("refundDueHint")}</span>
                  </dt>
                ) : (
                  <dt className="font-medium">{t("balance")}</dt>
                )}
                <dd>
                  <Money
                    usdCents={Math.abs(ticket.balanceUsdCents)}
                    rate={rate}
                    rounding={rounding}
                    className="items-end text-lg rtl:items-start"
                    usdClassName={ticket.balanceUsdCents > 0 ? "text-warning" : ticket.balanceUsdCents < 0 ? "text-destructive" : undefined}
                  />
                </dd>
              </div>
            </dl>
            {ticket.payments.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2 border-t pt-4">
                {ticket.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{tm(p.method)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format.dateTime(p.createdAt, { dateStyle: "medium" })} · {p.user.name}
                        {p.reference && (
                          <>
                            {" · "}
                            <Ltr>{p.reference}</Ltr>
                          </>
                        )}
                      </p>
                    </div>
                    <Ltr className="font-medium whitespace-nowrap">{formatMoney(p.amount, p.currency)}</Ltr>
                  </li>
                ))}
              </ul>
            )}
            {canPos && ticket.balanceUsdCents > 0 && ticket.status !== "CANCELLED" && (
              <Button asChild className="mt-4 w-full">
                <Link href={`/pos?ticket=${ticket.number}`}>
                  <ShoppingCart />
                  {t("payAtPos")}
                </Link>
              </Button>
            )}
            {canEdit && (
              <div className="mt-2">
                <PaymentForm ticketId={ticket.id} rate={rate} rounding={rounding} balanceUsdCents={ticket.balanceUsdCents} />
              </div>
            )}
          </Card>

          {followup && (
            <Card title={followup.tf("cardTitle")}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{followup.tf("checkLabel")}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.checkSentAt ? followup.tf("sentOn", { date: dt(ticket.checkSentAt) }) : followup.tf("notSent")}
                  </p>
                </div>
                {canStatus && <FollowupButton ticketId={ticket.id} href={followup.check} sent={!!ticket.checkSentAt} />}
              </div>
            </Card>
          )}

          <Card title={t("technician")}>
            <TechnicianSelect ticketId={ticket.id} value={ticket.assignedTo?.id ?? null} technicians={technicians} disabled={!canStatus} />
          </Card>

          <Card title={t("warranty")}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden className="size-4 text-muted-foreground" />
                <span className="text-sm">{t("warrantyDays", { count: ticket.warrantyDays })}</span>
              </div>
              <WarrantyBadge until={ticket.warrantyUntil} showNotStarted />
              {!ticket.warrantyUntil && ticket.warrantyDays > 0 && <p className="text-xs text-muted-foreground">{t("warrantyStartsAtPickup")}</p>}
              {ticket.comebacks.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 border-t pt-2 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">{tcb("cameBack", { count: ticket.comebacks.length })}</span>
                  {ticket.comebacks.map((c) => (
                    <Link key={c.id} href={`/tickets/${c.number}`} className="flex items-center justify-between gap-2 hover:underline">
                      <Ltr className="font-medium">{formatTicketNumber(shop.ticketPrefix, c.number)}</Ltr>
                      <span className="text-xs text-muted-foreground">{format.dateTime(c.createdAt, { dateStyle: "medium" })}</span>
                    </Link>
                  ))}
                </div>
              )}
              {ticket.status === "PICKED_UP" && canEdit && (
                <ComebackDialog
                  originalId={ticket.id}
                  label={label}
                  device={ticket.device}
                  warrantyUntil={ticket.warrantyUntil?.toISOString() ?? null}
                  className="mt-1 w-full"
                />
              )}
            </div>
          </Card>

          <p className="px-1 text-xs text-subtle-foreground">
            {t("createdBy", { name: `\u2068${ticket.createdBy.name}\u2069`, date: `\u2068${dt(ticket.createdAt)}\u2069` })}
          </p>
        </aside>
      </div>
    </div>
  );
}
