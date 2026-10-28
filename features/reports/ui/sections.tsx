import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChartColumn, Download, HandCoins, Package, Percent, ReceiptText, RotateCcw, ShoppingBag, UserRound, Wallet, Wrench } from "lucide-react";
import { BarChart } from "@/components/bar-chart";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { SectionCard } from "@/components/section-card";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge, type TicketStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RealProfitCard } from "@/features/expenses/ui/real-profit-card";
import { BalancesList } from "@/features/reports/ui/balances-list";
import { bestSellers, comebacksReport, outstandingBalances, profitSummary, repairsByStatus, revenueByTechnician } from "@/features/reports/queries";
import { startOfDay, type DayRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { formatPhone } from "@/lib/phone";
import type { ShopContext } from "@/lib/tenant";
import { cn } from "@/lib/utils";

type Props = { ctx: ShopContext; range: DayRange };

async function ExportButton({ type, range }: { type: string; range?: DayRange }) {
  const t = await getTranslations("reports");
  const qs = new URLSearchParams({ type, ...(range && { from: range.from, to: range.to }) });
  return (
    <Button variant="outline" asChild>
      <a href={`/reports/export?${qs.toString()}`} download>
        <Download />
        {t("exportCsv")}
      </a>
    </Button>
  );
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

export async function OverviewSection({ ctx, range }: Props) {
  const { shop } = ctx;
  const [t, format, p] = await Promise.all([getTranslations("reports"), getFormatter(), profitSummary(shop.id, range)]);
  const money = (c: number, className?: string) => <Money usdCents={c} rate={shop.exchangeRate} rounding={shop.lbpRounding} className={className} lbpClassName="text-xs" />;
  const margin = pct(p.totalProfit, p.totalRevenue);
  const repairs = p.techs.reduce((s, x) => s + x.repairs, 0);
  const short = p.days.length <= 7;
  const activeDays = p.days.filter((d) => d.takings || d.productRevenue || d.repairTakings || d.salesCount);
  const sum = (k: "salesCount" | "productRevenue" | "productCost" | "repairTakings" | "takings") => p.days.reduce((s, d) => s + d[k], 0);
  const cellMoney = (c: number) => (c === 0 ? <span className="text-subtle-foreground">—</span> : money(c, "items-end whitespace-nowrap rtl:items-start"));

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("summary")} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile icon={Wallet} label={t("totalTakings")}>
          {money(p.takings)}
        </StatTile>
        <StatTile icon={ShoppingBag} label={t("productRevenue")}>
          {money(p.productRevenue)}
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {t.rich("costOf", { amount: formatMoney(p.productCost, "USD"), m: (c) => <bdi dir="ltr">{c}</bdi> })}
          </p>
        </StatTile>
        <StatTile icon={Wrench} label={t("repairRevenue")}>
          {money(p.repairRevenue)}
          <p className="mt-1 text-xs font-normal text-muted-foreground">{t("repairsPickedUp", { count: repairs })}</p>
        </StatTile>
        <StatTile icon={Percent} label={t("totalProfit")} tone={p.totalProfit < 0 ? "warning" : "success"}>
          {money(p.totalProfit)}
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {margin === null ? t("noMargin") : t("margin", { pct: format.number(margin, { maximumFractionDigits: 1 }) })}
          </p>
        </StatTile>
      </section>

      <RealProfitCard
        p={p}
        rate={shop.exchangeRate}
        rounding={shop.lbpRounding}
        expensesHref={`/expenses?${new URLSearchParams({ from: range.from, to: range.to }).toString()}`}
      />

      <SectionCard title={t("salesByDay")} description={t("salesByDayHint")} actions={<ExportButton type="sales" range={range} />}>
        {activeDays.length === 0 ? (
          <EmptyState icon={ChartColumn} title={t("noSalesTitle")} body={t("noSalesBody")} className="py-8" />
        ) : (
          <BarChart
            label={t("salesByDay")}
            height={220}
            series={[
              { label: t("productRevenue"), color: "chart-1" },
              { label: t("repairTakings"), color: "chart-2" },
            ]}
            items={p.days.map((d) => {
              const date = startOfDay(d.day, range.tz);
              return {
                key: d.day,
                label: format.dateTime(date, short ? { weekday: "short" } : { day: "numeric", month: "short" }),
                title: format.dateTime(date, { weekday: "long", day: "numeric", month: "long" }),
                values: [d.productRevenue, d.repairTakings],
              };
            })}
          />
        )}
      </SectionCard>

      {activeDays.length > 0 && (
        <SectionCard title={t("dailyBreakdown")} description={t("dailyBreakdownHint")} padded={false}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-4 sm:ps-6">{t("date")}</TableHead>
                  <TableHead className="hidden md:table-cell text-end">{t("counterSales")}</TableHead>
                  <TableHead className="hidden lg:table-cell text-end">{t("productRevenue")}</TableHead>
                  <TableHead className="hidden xl:table-cell text-end">{t("productCost")}</TableHead>
                  <TableHead className="hidden sm:table-cell text-end">{t("repairTakings")}</TableHead>
                  <TableHead className="pe-4 text-end sm:pe-6">{t("takings")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDays.map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="ps-4 whitespace-nowrap sm:ps-6">{format.dateTime(startOfDay(d.day, range.tz), { weekday: "short", day: "numeric", month: "short" })}</TableCell>
                    <TableCell className="hidden text-end tabular-nums md:table-cell">{d.salesCount || <span className="text-subtle-foreground">—</span>}</TableCell>
                    <TableCell className="hidden text-end lg:table-cell">{cellMoney(d.productRevenue)}</TableCell>
                    <TableCell className="hidden text-end xl:table-cell">{cellMoney(d.productCost)}</TableCell>
                    <TableCell className="hidden text-end sm:table-cell">{cellMoney(d.repairTakings)}</TableCell>
                    <TableCell className="pe-4 text-end sm:pe-6">{cellMoney(d.takings)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-b-0 bg-muted/40 font-semibold hover:bg-muted/40">
                  <TableCell className="ps-4 sm:ps-6">{t("total")}</TableCell>
                  <TableCell className="hidden text-end tabular-nums md:table-cell">{sum("salesCount")}</TableCell>
                  <TableCell className="hidden text-end lg:table-cell">{money(sum("productRevenue"), "items-end whitespace-nowrap rtl:items-start")}</TableCell>
                  <TableCell className="hidden text-end xl:table-cell">{money(sum("productCost"), "items-end whitespace-nowrap rtl:items-start")}</TableCell>
                  <TableCell className="hidden text-end sm:table-cell">{money(sum("repairTakings"), "items-end whitespace-nowrap rtl:items-start")}</TableCell>
                  <TableCell className="pe-4 text-end sm:pe-6">{money(sum("takings"), "items-end whitespace-nowrap rtl:items-start")}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export async function RepairsSection({ ctx, range }: Props) {
  const { shop } = ctx;
  const [t, ts, tcb, format, statuses, techs, cb] = await Promise.all([
    getTranslations("reports"),
    getTranslations("status"),
    getTranslations("comebacks"),
    getFormatter(),
    repairsByStatus(shop.id, range),
    revenueByTechnician(shop.id, range),
    comebacksReport(shop.id, range),
  ]);
  const rate = (n: number, of: number) => (of > 0 ? format.number(n / of, { style: "percent", maximumFractionDigits: 1 }) : "—");
  const money = (c: number) => (
    <Money usdCents={c} rate={shop.exchangeRate} rounding={shop.lbpRounding} className="items-end whitespace-nowrap rtl:items-start" lbpClassName="text-xs" />
  );
  const sorted = [...statuses].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((s) => s.count));
  const received = sorted.reduce((s, x) => s + x.count, 0);
  const total = (k: "repairs" | "chargeUsdCents" | "partsCostUsdCents" | "laborUsdCents" | "profitUsdCents") => techs.reduce((s, x) => s + x[k], 0);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <SectionCard title={t("repairsByStatus")} description={t("repairsByStatusHint", { count: received })}>
        {sorted.length === 0 ? (
          <EmptyState icon={Wrench} title={t("noRepairsTitle")} body={t("noRepairsBody")} className="py-6" />
        ) : (
          <ul className="flex flex-col gap-3">
            {sorted.map((s) => (
              <li key={s.status} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                <StatusBadge status={s.status as TicketStatus} className="justify-self-start" />
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-chart-1" style={{ width: `${(s.count / max) * 100}%` }} />
                </span>
                <span className="text-end font-medium tabular-nums">
                  <span className="sr-only">{ts(s.status as TicketStatus)}: </span>
                  {s.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t("byTechnician")} description={t("byTechnicianHint")} padded={false} actions={<ExportButton type="technicians" range={range} />}>
        {techs.length === 0 ? (
          <EmptyState icon={UserRound} title={t("noPickupsTitle")} body={t("noPickupsBody")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-4 sm:ps-6">{t("technician")}</TableHead>
                  <TableHead className="px-2 text-end sm:px-4">{t("repairs")}</TableHead>
                  <TableHead className="hidden text-end sm:table-cell">{t("charged")}</TableHead>
                  <TableHead className="hidden text-end 2xl:table-cell">{t("partsCost")}</TableHead>
                  <TableHead className="hidden text-end 2xl:table-cell">{t("labor")}</TableHead>
                  <TableHead className="pe-4 text-end sm:pe-6">{t("profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {techs.map((r) => (
                  <TableRow key={r.techId ?? "none"}>
                    <TableCell className={cn("ps-4 font-medium sm:ps-6", !r.name && "text-muted-foreground italic")}>{r.name ?? t("unassigned")}</TableCell>
                    <TableCell className="px-2 text-end tabular-nums sm:px-4">{r.repairs}</TableCell>
                    <TableCell className="hidden text-end sm:table-cell">{money(r.chargeUsdCents)}</TableCell>
                    <TableCell className="hidden text-end 2xl:table-cell">{money(r.partsCostUsdCents)}</TableCell>
                    <TableCell className="hidden text-end 2xl:table-cell">{money(r.laborUsdCents)}</TableCell>
                    <TableCell className="pe-4 text-end sm:pe-6">{money(r.profitUsdCents)}</TableCell>
                  </TableRow>
                ))}
                {techs.length > 1 && (
                  <TableRow className="border-b-0 bg-muted/40 font-semibold hover:bg-muted/40">
                    <TableCell className="ps-4 sm:ps-6">{t("total")}</TableCell>
                    <TableCell className="px-2 text-end tabular-nums sm:px-4">{total("repairs")}</TableCell>
                    <TableCell className="hidden text-end sm:table-cell">{money(total("chargeUsdCents"))}</TableCell>
                    <TableCell className="hidden text-end 2xl:table-cell">{money(total("partsCostUsdCents"))}</TableCell>
                    <TableCell className="hidden text-end 2xl:table-cell">{money(total("laborUsdCents"))}</TableCell>
                    <TableCell className="pe-4 text-end sm:pe-6">{money(total("profitUsdCents"))}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard title={tcb("reportTitle")} description={tcb("reportHint")} className="xl:col-span-2">
        {cb.count === 0 ? (
          <EmptyState icon={RotateCcw} title={tcb("noneTitle")} body={tcb("noneBody")} className="py-6" />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{tcb("statCount")}</p>
                <p className="text-xl font-semibold tabular-nums">{cb.count}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{tcb("statRate")}</p>
                <p className="text-xl font-semibold tabular-nums">{rate(cb.count, cb.repairs)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">{tcb("statCost")}</p>
                <Money usdCents={cb.costUsdCents} rate={shop.exchangeRate} rounding={shop.lbpRounding} className="text-xl font-semibold" lbpClassName="text-xs font-normal" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{tcb("byTech")}</h3>
                <ul className="divide-y rounded-lg border">
                  {cb.techs.map((r) => (
                    <li key={r.techId ?? "none"} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className={cn("min-w-0 truncate font-medium", !r.name && "text-muted-foreground italic")}>{r.name ?? t("unassigned")}</span>
                      <span className="shrink-0 text-end tabular-nums">
                        {tcb("techLine", { count: r.comebacks })}
                        {r.repairs > 0 && <span className="ms-2 text-xs text-muted-foreground">{tcb("ofRepairs", { rate: rate(r.comebacks, r.repairs), repairs: r.repairs })}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{tcb("byPart")}</h3>
                {cb.parts.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{tcb("noParts")}</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {cb.parts.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span dir="auto" className="min-w-0 truncate rtl:text-right">{p.name}</span>
                        <span className="shrink-0 tabular-nums">{tcb("techLine", { count: p.count })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export async function ProductsSection({ ctx, range }: Props) {
  const { shop } = ctx;
  const [t, format, rows] = await Promise.all([getTranslations("reports"), getFormatter(), bestSellers(shop.id, range)]);
  const money = (c: number) => (
    <Money usdCents={c} rate={shop.exchangeRate} rounding={shop.lbpRounding} className="items-end whitespace-nowrap rtl:items-start" lbpClassName="text-xs" />
  );
  return (
    <SectionCard title={t("bestSellers")} description={t("bestSellersHint")} padded={false} actions={<ExportButton type="products" range={range} />}>
      {rows.length === 0 ? (
        <EmptyState icon={Package} title={t("noProductsTitle")} body={t("noProductsBody")} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="hidden w-10 ps-4 sm:table-cell sm:ps-6">#</TableHead>
                <TableHead className="ps-4 sm:ps-4">{t("product")}</TableHead>
                <TableHead className="px-2 text-end sm:px-4">{t("qty")}</TableHead>
                <TableHead className="hidden text-end sm:table-cell">{t("revenue")}</TableHead>
                <TableHead className="pe-4 text-end sm:pe-6">{t("profit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const m = pct(r.profitUsdCents, r.revenueUsdCents);
                return (
                  <TableRow key={r.productId} className="relative">
                    <TableCell className="hidden ps-4 text-muted-foreground tabular-nums sm:table-cell sm:ps-6">{i + 1}</TableCell>
                    <TableCell className="w-full max-w-0 ps-4 sm:max-w-72 sm:ps-4">
                      <Link href={`/inventory/${r.productId}`} className="block truncate font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:underline">
                        {r.name}
                      </Link>
                      {r.sku && <Ltr className="text-xs text-muted-foreground">{r.sku}</Ltr>}
                    </TableCell>
                    <TableCell className="px-2 text-end font-medium tabular-nums sm:px-4">{r.qty}</TableCell>
                    <TableCell className="hidden text-end sm:table-cell">{money(r.revenueUsdCents)}</TableCell>
                    <TableCell className="pe-4 text-end sm:pe-6">
                      {money(r.profitUsdCents)}
                      {m !== null && <p className="text-xs text-muted-foreground">{t("margin", { pct: format.number(m, { maximumFractionDigits: 1 }) })}</p>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}

/** Customers per page in the balances list (totals above it always cover everyone). */
const BALANCES_PAGE_SIZE = 25;

export async function BalancesSection({ ctx, page = 1, params }: { ctx: ShopContext; page?: number; params?: Record<string, string | string[] | undefined> }) {
  const { shop } = ctx;
  const [t, data, templateCount] = await Promise.all([
    getTranslations("reports"),
    outstandingBalances(shop.id),
    ctx.db.messageTemplate.count({ where: { key: "BALANCE_REMINDER" } }),
  ]);
  const money = (c: number, usdClassName?: string) => (
    <Money usdCents={c} rate={shop.exchangeRate} rounding={shop.lbpRounding} usdClassName={usdClassName} lbpClassName="text-xs" />
  );
  const pageRows = data.rows.slice((page - 1) * BALANCES_PAGE_SIZE, page * BALANCES_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t("summary")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile icon={HandCoins} label={t("owedNow")} tone={data.totalOwedUsdCents > 0 ? "warning" : "default"}>
          {money(data.totalOwedUsdCents)}
        </StatTile>
        <StatTile icon={Wrench} label={t("dueOnPickup")}>
          {money(data.totalDueOnPickupUsdCents)}
        </StatTile>
        <StatTile icon={UserRound} label={t("customersWithBalance")}>
          {data.rows.length}
        </StatTile>
      </section>

      <SectionCard title={t("balances")} description={t("balancesHint")} padded={false} actions={<ExportButton type="balances" />}>
        {data.rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title={t("noBalancesTitle")} body={t("noBalancesBody")} />
        ) : (
          <BalancesList
            canRemind={templateCount > 0}
            rate={shop.exchangeRate}
            rounding={shop.lbpRounding}
            rows={pageRows.map((r) => ({
              customerId: r.customerId,
              name: r.name,
              phone: formatPhone(r.phone, shop.countryCode),
              owedUsdCents: r.owedUsdCents,
              dueOnPickupUsdCents: r.dueOnPickupUsdCents,
              tickets: r.tickets.map((x) => ({ ...x, label: formatTicketNumber(shop.ticketPrefix, x.number) })),
              sales: r.sales,
            }))}
          />
        )}
        <div className="border-t empty:hidden">
          <Pagination page={page} pageSize={BALANCES_PAGE_SIZE} total={data.rows.length} basePath="/reports" params={params} />
        </div>
      </SectionCard>
    </div>
  );
}

