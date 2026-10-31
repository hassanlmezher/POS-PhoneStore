import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Archive, Columns3, MessageCircleHeart, Plus, Rows3, SearchX, Truck, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { UrlSearchInput } from "@/components/url-search-input";
import { countChecksDue } from "@/features/followups/queries";
import { partOrderCounts } from "@/features/partorders/queries";
import { boardTickets, listTickets, listTechnicians, ticketAccessWhere, type TicketCard } from "@/features/tickets/queries";
import { CLOSED_STATUSES, TICKET_STATUSES, type TicketStatusValue } from "@/features/tickets/schema";
import { TicketBoard, type BoardCard } from "@/features/tickets/ui/ticket-board";
import { TicketFilters } from "@/features/tickets/ui/ticket-filters";
import { TicketTable } from "@/features/tickets/ui/ticket-table";
import { isOverdue } from "@/features/tickets/ui/ticket-utils";
import { formatTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { requireShop } from "@/lib/tenant";

function toBoardCard(c: TicketCard, prefix: string): BoardCard {
  return {
    id: c.id,
    number: c.number,
    label: formatTicketNumber(prefix, c.number),
    status: c.status,
    device: c.device,
    customerName: c.customer.name,
    promisedAt: c.promisedAt,
    overdue: isOverdue(c.promisedAt, c.status),
    techName: c.assignedTo?.name ?? null,
    balanceUsdCents: c.balanceUsdCents,
    approval: c.approval,
  };
}

export default async function TicketsPage({ params, searchParams }: PageProps<"/shop/[slug]/tickets">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireShop(slug);
  const { shop, user, readOnly } = ctx;
  const t = await getTranslations("tickets");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const [waitingPickup, followups, parts] = await Promise.all([
    ctx.db.ticket.count({ where: { AND: [{ status: "READY" }, ticketAccessWhere(user)] } }),
    countChecksDue(ctx),
    partOrderCounts(ctx),
  ]);

  const view = sp.view === "table" ? "table" : "board";
  const q = typeof sp.q === "string" ? sp.q : "";
  const canCreate = can(user.role, "tickets.create") && !readOnly;
  const canMove = can(user.role, "tickets.status") && !readOnly;
  const viewHref = (v: string) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (v === "table") next.set("view", "table");
    const s = next.toString();
    return s ? `/tickets?${s}` : "/tickets";
  };

  const header = (
    <PageHeader
      title={t("title")}
      description={t("subtitle")}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href="/tickets/pickup">
              <Archive />
              {t("waitingPickup")}
              {waitingPickup > 0 && (
                <span className="rounded-full bg-status-ready px-2 text-xs leading-5 text-status-ready-foreground tabular-nums">{waitingPickup}</span>
              )}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tickets/parts">
              <Truck />
              {t("partOrders")}
              {parts.late > 0 ? (
                <span className="rounded-full bg-destructive-soft px-2 text-xs leading-5 text-destructive tabular-nums">{t("lateCount", { count: parts.late })}</span>
              ) : (
                parts.waiting > 0 && <span className="rounded-full bg-muted px-2 text-xs leading-5 tabular-nums">{parts.waiting}</span>
              )}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tickets/followups">
              <MessageCircleHeart />
              {t("afterPickup")}
              {followups > 0 && <span className="rounded-full bg-success-soft px-2 text-xs leading-5 text-success tabular-nums">{followups}</span>}
            </Link>
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/tickets/new">
                <Plus />
                {tc("newTicket")}
              </Link>
            </Button>
          )}
        </>
      }
    />
  );

  const toolbar = (extra?: React.ReactNode) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <nav aria-label={t("viewLabel")} className="inline-flex h-11 w-fit rounded-lg border bg-muted/60 p-1">
        {[
          { v: "board", icon: Columns3, label: t("viewBoard") },
          { v: "table", icon: Rows3, label: t("viewTable") },
        ].map(({ v, icon: Icon, label }) => (
          <Link
            key={v}
            href={viewHref(v)}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
              view === v ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <UrlSearchInput basePath="/tickets" label={t("search")} placeholder={t("searchPlaceholder")} className="sm:w-72" />
      {extra}
    </div>
  );

  if (view === "board") {
    const board = await boardTickets(ctx, q);
    const cards = board.cards.map((c) => toBoardCard(c, shop.ticketPrefix));
    return (
      <div className="flex flex-col gap-6">
        {header}
        {toolbar()}
        {cards.length === 0 && !q ? (
          <div className="rounded-xl border bg-card shadow-card">
            <EmptyState
              icon={Wrench}
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={
                canCreate && (
                  <Button asChild>
                    <Link href="/tickets/new">
                      <Plus />
                      {tc("newTicket")}
                    </Link>
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <TicketBoard
            cards={cards}
            canMove={canMove}
            canPay={can(user.role, "pos") && !readOnly}
            rate={shop.exchangeRate}
            rounding={shop.lbpRounding}
            closedMore={board.closedMore}
            closedHref={`/tickets?view=table&status=${CLOSED_STATUSES.join(",")}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
          />
        )}
      </div>
    );
  }

  const statusParam = typeof sp.status === "string" ? sp.status : "";
  const status = statusParam.split(",").filter((s): s is TicketStatusValue => (TICKET_STATUSES as readonly string[]).includes(s));
  const tech = typeof sp.tech === "string" ? sp.tech : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const canFilterTech = can(user.role, "tickets.viewAll");
  const [{ rows, total, pageSize }, technicians] = await Promise.all([
    listTickets(ctx, { q, status, assignedToId: canFilterTech ? tech : undefined, page }),
    canFilterTech ? listTechnicians(shop.id) : Promise.resolve([]),
  ]);
  const filtered = !!(q || status.length || tech);

  return (
    <div className="flex flex-col gap-6">
      {header}
      {toolbar(<TicketFilters technicians={technicians} canFilterTech={canFilterTech} />)}
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title={t("noResults")} body={t("noResultsBody")} />
          ) : (
            <EmptyState icon={Wrench} title={t("emptyTitle")} body={t("emptyBody")} />
          )
        ) : (
          <>
            <TicketTable
              rate={shop.exchangeRate}
              rounding={shop.lbpRounding}
              rows={rows.map((r) => ({
                id: r.id,
                number: r.number,
                label: formatTicketNumber(shop.ticketPrefix, r.number),
                device: r.device,
                customer: r.customer.name,
                status: r.status,
                tech: r.assignedTo?.name ?? null,
                promised: r.promisedAt ? format.dateTime(r.promisedAt, { dateStyle: "medium" }) : null,
                overdue: isOverdue(r.promisedAt, r.status),
                balanceUsdCents: r.balanceUsdCents,
                created: format.dateTime(r.createdAt, { dateStyle: "medium" }),
              }))}
            />
            <div className="border-t">
              <Pagination page={page} pageSize={pageSize} total={total} basePath="/tickets" params={sp} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
