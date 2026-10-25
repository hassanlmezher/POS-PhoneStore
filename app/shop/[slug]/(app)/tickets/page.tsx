import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Columns3, Plus, Rows3, SearchX, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrlSearchInput } from "@/components/url-search-input";
import { boardTickets, listTickets, listTechnicians, type TicketCard } from "@/features/tickets/queries";
import { TICKET_STATUSES, type TicketStatusValue } from "@/features/tickets/schema";
import { TicketBoard, type BoardCard } from "@/features/tickets/ui/ticket-board";
import { TicketFilters } from "@/features/tickets/ui/ticket-filters";
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
    const cards = (await boardTickets(ctx, q)).map((c) => toBoardCard(c, shop.ticketPrefix));
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
          <TicketBoard cards={cards} canMove={canMove} rate={shop.exchangeRate} rounding={shop.lbpRounding} />
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
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("colTicket")}</TableHead>
                  <TableHead>{t("colDevice")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colCustomer")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("technician")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colPromised")}</TableHead>
                  <TableHead className="text-end">{t("balance")}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t("colCreated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const overdue = isOverdue(r.promisedAt, r.status);
                  return (
                    <TableRow key={r.id} className="relative">
                      <TableCell className="font-semibold whitespace-nowrap">
                        <Link href={`/tickets/${r.number}`} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                          <Ltr>{formatTicketNumber(shop.ticketPrefix, r.number)}</Ltr>
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <p className="truncate font-medium">{r.device}</p>
                        <p className="truncate text-xs text-muted-foreground md:hidden">{r.customer.name}</p>
                      </TableCell>
                      <TableCell className="hidden max-w-48 truncate md:table-cell">{r.customer.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{r.assignedTo?.name ?? t("unassigned")}</TableCell>
                      <TableCell className={cn("hidden whitespace-nowrap md:table-cell", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                        {r.promisedAt ? format.dateTime(r.promisedAt, { dateStyle: "medium" }) : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        {r.balanceUsdCents > 0 ? (
                          <Money usdCents={r.balanceUsdCents} rate={shop.exchangeRate} rounding={shop.lbpRounding} className="items-end rtl:items-start" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                        {format.dateTime(r.createdAt, { dateStyle: "medium" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="border-t">
              <Pagination page={page} pageSize={pageSize} total={total} basePath="/tickets" params={sp} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
