import { getFormatter, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { centsToDecimal } from "@/features/reports/csv";
import { profitSummary } from "@/features/reports/queries";
import { DateRangePicker, type RangePreset } from "@/features/reports/ui/date-range-picker";
import type { ExpenseCategory } from "@/features/expenses/schema";
import { ExpensesList } from "@/features/expenses/ui/expenses-list";
import { RealProfitCard } from "@/features/expenses/ui/real-profit-card";
import { addDays, dayKey, dayRange, startOfDay } from "@/lib/dates";
import { requirePermission } from "@/lib/tenant";

export default async function ExpensesPage({ params, searchParams }: PageProps<"/shop/[slug]/expenses">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requirePermission(slug, "expenses");
  const { shop } = ctx;
  const [t, tr, format] = await Promise.all([getTranslations("expenses"), getTranslations("reports"), getFormatter()]);
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const range = dayRange(shop.timezone, str(sp.from), str(sp.to));

  const today = dayKey(new Date(), shop.timezone);
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const presets: RangePreset[] = [
    { key: "thisMonth", label: tr("presets.thisMonth"), from: monthStart, to: today },
    { key: "lastMonth", label: tr("presets.lastMonth"), from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
    { key: "last7", label: tr("presets.last7"), from: addDays(today, -6), to: today },
    { key: "today", label: tr("presets.today"), from: today, to: today },
  ];
  const rangeLabel =
    range.from === range.to
      ? format.dateTime(startOfDay(range.from, range.tz), { dateStyle: "full" })
      : format.dateTimeRange(startOfDay(range.from, range.tz), startOfDay(range.to, range.tz), { dateStyle: "medium" });

  const [p, expenses, drawer] = await Promise.all([
    profitSummary(shop.id, range),
    ctx.db.expense.findMany({
      where: { spentAt: { gte: range.start, lt: range.end } },
      orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        category: true,
        note: true,
        currency: true,
        amount: true,
        usdCentsEquivalent: true,
        spentAt: true,
        cashMovementId: true,
        user: { select: { name: true } },
      },
    }),
    ctx.db.cashSession.findFirst({ where: { closedAt: null }, select: { id: true } }),
  ]);
  const qs = new URLSearchParams({ from: range.from, to: range.to }).toString();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={rangeLabel}
        actions={
          <>
            <DateRangePicker key={`${range.from}-${range.to}`} basePath="/expenses" from={range.from} to={range.to} presets={presets} />
            {expenses.length > 0 && (
              <Button variant="outline" asChild>
                <a href={`/reports/export?type=expenses&${qs}`} download>
                  <Download />
                  {tr("exportCsv")}
                </a>
              </Button>
            )}
          </>
        }
      />
      <RealProfitCard p={p} rate={shop.exchangeRate} rounding={shop.lbpRounding} reportHref={`/reports?${qs}`} />
      <ExpensesList
        today={today}
        drawerOpen={!!drawer}
        rate={shop.exchangeRate}
        rounding={shop.lbpRounding}
        rows={expenses.map((e) => ({
          id: e.id,
          category: e.category as ExpenseCategory,
          note: e.note,
          currency: e.currency,
          amount: e.amount,
          amountText: e.currency === "USD" ? centsToDecimal(e.amount) : String(e.amount),
          usdCents: e.usdCentsEquivalent,
          day: dayKey(e.spentAt, shop.timezone),
          dayLabel: format.dateTime(e.spentAt, { weekday: "short", day: "numeric", month: "short", timeZone: shop.timezone }),
          by: e.user.name,
          fromDrawer: !!e.cashMovementId,
        }))}
      />
      <p className="text-xs text-muted-foreground">{t("stockNote")}</p>
    </div>
  );
}
