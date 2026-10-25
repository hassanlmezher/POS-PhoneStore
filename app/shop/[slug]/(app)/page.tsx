import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  AlarmClock,
  ChevronRight,
  CircleCheckBig,
  Inbox,
  LockOpen,
  PackageCheck,
  PackageX,
  Plus,
  ShoppingCart,
  Wallet,
  Wrench,
} from "lucide-react";
import { BarChart } from "@/components/bar-chart";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatTile } from "@/components/stat-tile";
import { StockLevel } from "@/components/stock-level";
import { Button } from "@/components/ui/button";
import { dashboardData } from "@/features/dashboard/queries";
import { TicketList, type DashboardTicket } from "@/features/dashboard/ui/ticket-list";
import { trackUrl } from "@/features/tickets/notify";
import { startOfDay } from "@/lib/dates";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";
import { fillTemplate, waLink } from "@/lib/whatsapp";

export default async function DashboardPage({ params }: PageProps<"/shop/[slug]">) {
  const { slug } = await params;
  const ctx = await requireShop(slug);
  const { shop, user, readOnly } = ctx;
  const [t, format, d] = await Promise.all([getTranslations("dashboard"), getFormatter(), dashboardData(ctx)]);
  const tc = await getTranslations("common");
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;
  const canCreate = can(user.role, "tickets.create") && !readOnly;
  const canSell = can(user.role, "pos") && !readOnly;
  const canCash = can(user.role, "cash");
  const isTech = user.role === "TECHNICIAN";
  const rate = shop.exchangeRate;
  const rounding = shop.lbpRounding;

  // "Ready" WhatsApp message in each customer's language (only fetched when there is something ready).
  const readyTemplates = d.ready.length
    ? await ctx.db.messageTemplate.findMany({ where: { key: "TICKET_READY" }, select: { locale: true, body: true } })
    : [];
  const ready: DashboardTicket[] = d.ready.map((tk) => {
    const body = readyTemplates.find((x) => x.locale === tk.customer.locale)?.body ?? readyTemplates[0]?.body;
    const label = formatTicketNumber(shop.ticketPrefix, tk.number);
    const balance = Math.max(0, tk.balanceUsdCents);
    return {
      ...tk,
      waUrl: body
        ? waLink(
            tk.customer.phone,
            fillTemplate(body, {
              customer: tk.customer.name,
              device: tk.device,
              ticket: label,
              balance: `${formatMoney(balance, "USD")} (${formatMoney(toLbp(balance, rate, rounding), "LBP")})`,
              shop: shop.name,
              trackUrl: trackUrl(shop.slug, label),
            }),
          )
        : null,
    };
  });

  const viewAll = (href: string) => (
    <Button variant="ghost" size="sm" asChild className="h-11 sm:h-9">
      <Link href={href}>
        {t("viewAll")}
        <ChevronRight className="rtl:rotate-180" />
      </Link>
    </Button>
  );

  const myRepairs = isTech && (
    <SectionCard title={t("myRepairs")} description={t("myRepairsHint")} padded={false} actions={viewAll("/tickets")}>
      {d.myRepairs.length === 0 ? (
        <EmptyState icon={Wrench} title={t("myRepairsEmptyTitle")} body={t("myRepairsEmptyBody")} />
      ) : (
        <TicketList tickets={d.myRepairs} prefix={shop.ticketPrefix} showStatus />
      )}
    </SectionCard>
  );

  const readyCard = (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          {t("readyTitle")}
          {d.readyCount > 0 && <span className="rounded-full bg-status-ready px-2 text-xs leading-5 text-status-ready-foreground tabular-nums">{d.readyCount}</span>}
        </span>
      }
      description={t("readyDescription")}
      padded={false}
      actions={d.readyCount > 0 && viewAll("/tickets?view=table&status=READY")}
    >
      {ready.length === 0 ? (
        <EmptyState icon={CircleCheckBig} title={t("readyEmptyTitle")} body={t("readyEmptyBody")} />
      ) : (
        <TicketList tickets={ready} prefix={shop.ticketPrefix} showBalance={!isTech} />
      )}
    </SectionCard>
  );

  const overdueCard = (
    <SectionCard title={t("overdueTitle")} description={t("overdueDescription")} padded={false}>
      {d.overdue.length === 0 ? (
        <EmptyState icon={AlarmClock} title={t("overdueEmptyTitle")} body={t("overdueEmptyBody")} className="py-8" />
      ) : (
        <TicketList tickets={d.overdue} prefix={shop.ticketPrefix} showStatus overdue />
      )}
    </SectionCard>
  );

  const drawerCard = canCash && (
    <SectionCard
      title={t("drawerTitle")}
      padded={false}
      actions={
        d.drawer && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            {t("drawerOpen")}
          </span>
        )
      }
    >
      {d.drawer?.totals ? (
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            {t("drawerOpenedBy", { time: format.dateTime(d.drawer.openedAt, { timeStyle: "short" }), name: d.drawer.openedBy.name })}
          </p>
          <dl className="grid grid-cols-2 gap-3">
            {(
              [
                ["USD", d.drawer.totals.expectedUsdCents],
                ["LBP", d.drawer.totals.expectedLbp],
              ] as const
            ).map(([cur, v]) => (
              <div key={cur} className="rounded-lg bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{t("expectedIn", { currency: cur })}</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                  <bdi dir="ltr">{formatMoney(v, cur)}</bdi>
                </dd>
              </div>
            ))}
          </dl>
          <Button variant="outline" asChild>
            <Link href="/cash">
              {t("manageDrawer")}
              <ChevronRight className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      ) : (
        <EmptyState
          icon={Wallet}
          title={t("drawerClosedTitle")}
          body={t("drawerClosedBody")}
          className="py-8"
          action={
            !readOnly && (
              <Button asChild>
                <Link href="/cash">
                  <LockOpen />
                  {t("openDrawer")}
                </Link>
              </Button>
            )
          }
        />
      )}
    </SectionCard>
  );

  const weekCard = d.showMoney && (
    <SectionCard title={t("weekTitle")} description={t("weekDescription")}>
      <BarChart
        label={t("weekTitle")}
        height={140}
        series={[{ label: t("takings"), color: "chart-1" }]}
        items={d.week.map((w) => {
          const date = startOfDay(w.day, ctx.shop.timezone);
          return {
            key: w.day,
            label: format.dateTime(date, { weekday: "short" }),
            title: format.dateTime(date, { weekday: "long", day: "numeric", month: "long" }),
            values: [w.takings],
          };
        })}
      />
    </SectionCard>
  );

  const lowStockCard = (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          {t("lowStockTitle")}
          {d.lowStockCount > 0 && <span className="rounded-full bg-warning-soft px-2 text-xs leading-5 text-warning tabular-nums">{d.lowStockCount}</span>}
        </span>
      }
      padded={false}
      actions={d.lowStockCount > 0 && viewAll("/inventory?tab=low")}
    >
      {d.lowStock.length === 0 ? (
        <EmptyState icon={PackageCheck} title={t("lowStockEmptyTitle")} body={t("lowStockEmptyBody")} className="py-8" />
      ) : (
        <ul className="divide-y">
          {d.lowStock.map((p) => (
            <li key={p.id}>
              <Link href={`/inventory/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/40 sm:px-6">
                <PackageX aria-hidden className="size-4 shrink-0 text-warning" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <StockLevel qty={p.qty} threshold={p.lowStockThreshold} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <PageHeader
        title={t("greeting", { name: firstName })}
        description={t("subtitle")}
        actions={
          <>
            {canSell && (
              <Button variant="outline" asChild>
                <Link href="/pos">
                  <ShoppingCart />
                  {tc("newSale")}
                </Link>
              </Button>
            )}
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

      <section aria-label={t("overview")} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link href="/tickets" className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <StatTile icon={Wrench} label={t("openRepairs")} className="h-full transition-colors hover:border-primary/30">
            {d.openRepairs}
          </StatTile>
        </Link>
        <Link href="/tickets?view=table&status=READY" className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <StatTile icon={CircleCheckBig} label={t("readyForPickup")} tone="success" className="h-full transition-colors hover:border-primary/30">
            {d.readyCount}
          </StatTile>
        </Link>
        <StatTile icon={Inbox} label={t("receivedToday")}>
          {d.receivedToday}
        </StatTile>
        {d.showMoney ? (
          <StatTile icon={Wallet} label={t("takingsToday")}>
            <Money usdCents={d.takingsToday} rate={rate} rounding={rounding} lbpClassName="text-xs" />
            <p className="mt-1 text-xs font-normal text-muted-foreground">{t("salesCount", { count: d.salesToday })}</p>
          </StatTile>
        ) : (
          <StatTile icon={AlarmClock} label={t("overdue")} tone={d.overdue.length ? "warning" : "default"}>
            {d.overdue.length}
          </StatTile>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {myRepairs}
          {readyCard}
          {overdueCard}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {drawerCard}
          {weekCard}
          {lowStockCard}
        </div>
      </div>
    </div>
  );
}
