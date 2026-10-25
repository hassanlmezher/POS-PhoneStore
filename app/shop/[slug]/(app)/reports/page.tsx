import { getFormatter, getTranslations } from "next-intl/server";
import { LinkTabs } from "@/components/link-tabs";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker, type RangePreset } from "@/features/reports/ui/date-range-picker";
import { BalancesSection, OverviewSection, ProductsSection, RepairsSection } from "@/features/reports/ui/sections";
import { addDays, dayKey, dayRange, startOfDay } from "@/lib/dates";
import { requirePermission } from "@/lib/tenant";

const TABS = ["overview", "repairs", "products", "balances"] as const;
type Tab = (typeof TABS)[number];

export default async function ReportsPage({ params, searchParams }: PageProps<"/shop/[slug]/reports">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requirePermission(slug, "reports");
  const [t, format] = await Promise.all([getTranslations("reports"), getFormatter()]);
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const range = dayRange(ctx.shop.timezone, str(sp.from), str(sp.to));
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";

  const today = dayKey(new Date(), ctx.shop.timezone);
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const presets: RangePreset[] = [
    { key: "today", label: t("presets.today"), from: today, to: today },
    { key: "yesterday", label: t("presets.yesterday"), from: addDays(today, -1), to: addDays(today, -1) },
    { key: "last7", label: t("presets.last7"), from: addDays(today, -6), to: today },
    { key: "thisMonth", label: t("presets.thisMonth"), from: monthStart, to: today },
    { key: "lastMonth", label: t("presets.lastMonth"), from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
  ];
  const rangeLabel =
    range.from === range.to
      ? format.dateTime(startOfDay(range.from, range.tz), { dateStyle: "full" })
      : format.dateTimeRange(startOfDay(range.from, range.tz), startOfDay(range.to, range.tz), { dateStyle: "medium" });

  const qs = (next: Tab) => {
    const s = new URLSearchParams({ from: range.from, to: range.to });
    if (next !== "overview") s.set("tab", next);
    return `/reports?${s.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={tab === "balances" ? t("balancesSubtitle") : rangeLabel}
        actions={
          tab !== "balances" && (
            <DateRangePicker key={`${range.from}-${range.to}`} from={range.from} to={range.to} presets={presets} keep={tab === "overview" ? {} : { tab }} />
          )
        }
      />
      <LinkTabs
        label={t("sections")}
        items={TABS.map((k) => ({ href: qs(k), label: t(`tabs.${k}`), active: tab === k }))}
      />

      {tab === "overview" && <OverviewSection ctx={ctx} range={range} />}
      {tab === "repairs" && <RepairsSection ctx={ctx} range={range} />}
      {tab === "products" && <ProductsSection ctx={ctx} range={range} />}
      {tab === "balances" && <BalancesSection ctx={ctx} page={Math.max(1, Number(sp.page) || 1)} params={sp} />}
    </div>
  );
}
