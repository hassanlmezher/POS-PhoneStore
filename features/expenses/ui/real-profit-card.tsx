import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Money } from "@/components/money";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import type { profitSummary } from "@/features/reports/queries";
import type { ExpenseCategory } from "@/features/expenses/schema";
import { CATEGORY_ICONS } from "@/features/expenses/ui/category-icon";
import { cn } from "@/lib/utils";

type Summary = Pick<
  Awaited<ReturnType<typeof profitSummary>>,
  "totalRevenue" | "productCost" | "repairCost" | "totalProfit" | "expenses" | "expensesTotal" | "realProfit"
>;

type Props = {
  p: Summary;
  rate: number;
  rounding: number;
  /** Link to the page where expenses are added (shown on Reports), keeping the date range. */
  expensesHref?: string;
  /** Link to the full report (shown on Expenses). */
  reportHref?: string;
};

/** Sales − cost of products and parts − expenses = real profit, plus where the expenses went. */
export async function RealProfitCard({ p, rate, rounding, expensesHref, reportHref }: Props) {
  const [t, format] = await Promise.all([getTranslations("expenses"), getFormatter()]);
  const money = (c: number, className?: string) => (
    <Money usdCents={c} rate={rate} rounding={rounding} className={cn("items-end rtl:items-start", className)} lbpClassName="text-xs" />
  );
  const cost = p.productCost + p.repairCost;
  const loss = p.realProfit < 0;
  const share = p.totalRevenue > 0 ? Math.round((p.realProfit / p.totalRevenue) * 1000) / 10 : null;

  const line = (sign: string, label: React.ReactNode, amount: number, className?: string) => (
    <div className={cn("flex items-start justify-between gap-4 py-2.5", className)}>
      <dt className="flex min-w-0 items-baseline gap-2">
        <span aria-hidden className="w-3 shrink-0 text-center font-semibold text-muted-foreground">
          {sign}
        </span>
        <span>{label}</span>
      </dt>
      <dd>{money(amount)}</dd>
    </div>
  );

  return (
    <SectionCard
      title={t("realProfit")}
      description={t("realProfitHint")}
      actions={
        (expensesHref || reportHref) && (
          <Button variant="outline" asChild>
            <Link href={(expensesHref ?? reportHref)!}>
              {expensesHref ? t("manageExpenses") : t("fullReport")}
              <ArrowRight className="rtl:rotate-180" />
            </Link>
          </Button>
        )
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <dl className="flex flex-col text-sm">
          {line("", t("sales"), p.totalRevenue)}
          {line("−", t("costOfGoods"), cost)}
          {line("=", t("beforeExpenses"), p.totalProfit, "border-t font-medium")}
          {line("−", t("expensesLine"), p.expensesTotal)}
          <div
            className={cn(
              "mt-2 flex items-start justify-between gap-4 rounded-lg px-3 py-3",
              loss ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success",
            )}
          >
            <dt>
              <span className="block font-semibold">{t("realProfit")}</span>
              {share !== null && (
                <span className="text-xs opacity-80">{t("realShare", { pct: format.number(share, { maximumFractionDigits: 1 }) })}</span>
              )}
            </dt>
            <dd>{money(p.realProfit, "text-lg font-semibold")}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t("whereItWent")}</h3>
          {p.expenses.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("noExpensesYet")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {p.expenses.map((e) => {
                const Icon = CATEGORY_ICONS[e.category as ExpenseCategory];
                const pct = p.expensesTotal > 0 ? (e.usdCents / p.expensesTotal) * 100 : 0;
                return (
                  <li key={e.category} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Icon aria-hidden className="size-4 text-muted-foreground" />
                        {t(`categories.${e.category}`)}
                        <span className="text-xs text-muted-foreground">{t("entries", { count: e.count })}</span>
                      </span>
                      <Money usdCents={e.usdCents} rate={rate} rounding={rounding} layout="inline" lbpClassName="text-xs" />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
