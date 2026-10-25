import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarClock, ChevronRight, CircleDollarSign, ExternalLink, Store } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrlSearchInput } from "@/components/url-search-input";
import { listPlans, listShops, platformStats } from "@/features/admin/queries";
import { NewShopButton } from "@/features/admin/ui/new-shop-dialog";
import { SubStatusBadge } from "@/features/admin/ui/sub-status-badge";
import { ROOT_DOMAIN, shopOrigin } from "@/lib/hosts";
import { formatMoney } from "@/lib/money";

export default async function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [t, format, stats, shops, plans] = await Promise.all([
    getTranslations("admin"),
    getFormatter(),
    platformStats(),
    listShops(q),
    listPlans(),
  ]);
  const date = (d: Date | null) => (d ? format.dateTime(d, { dateStyle: "medium" }) : "—");
  const num = (n: number) => <span className="tabular-nums">{n}</span>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <NewShopButton
            rootDomain={ROOT_DOMAIN}
            protocol={process.env.NODE_ENV === "production" ? "https" : "http"}
            plans={plans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priceUsdCents: p.priceUsdCents }))}
          />
        }
      />

      <section aria-label={t("statsLabel")} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={Store} label={t("stats.total")}>
          {stats.total}
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-normal text-muted-foreground">
            {(["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED"] as const).map((s) => (
              <span key={s} className="whitespace-nowrap">
                {t(`subStatus.${s}`)} <span className="font-medium text-foreground tabular-nums">{stats.byStatus[s]}</span>
              </span>
            ))}
          </p>
        </StatTile>
        <StatTile icon={Store} label={t("stats.active")} tone="success">
          {stats.byStatus.ACTIVE}
        </StatTile>
        <StatTile icon={CircleDollarSign} label={t("stats.mrr")} tone="success">
          <bdi dir="ltr">{formatMoney(stats.mrrUsdCents, "USD")}</bdi>
        </StatTile>
        <StatTile icon={CalendarClock} label={t("stats.expiring")} tone={stats.expiringSoon > 0 ? "warning" : "default"}>
          {stats.expiringSoon}
        </StatTile>
      </section>

      <section aria-labelledby="shops-title" className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="shops-title" className="font-semibold">
            {t("shopsTitle")} <span className="ms-1 text-sm font-normal text-muted-foreground tabular-nums">{shops.length}</span>
          </h2>
          <UrlSearchInput basePath="/" placeholder={t("searchPlaceholder")} label={t("searchPlaceholder")} className="sm:max-w-xs" />
        </div>

        {shops.length === 0 ? (
          <EmptyState icon={Store} title={q ? t("noMatch") : t("empty")} body={q ? t("noMatchBody") : t("emptyBody")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("cols.shop")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("cols.plan")}</TableHead>
                <TableHead>{t("cols.status")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("cols.until")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("cols.staff")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("cols.tickets")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("cols.sales")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("cols.created")}</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">{t("open")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((s) => (
                <TableRow key={s.id} className="relative">
                  <TableCell className="w-full max-w-0 sm:w-auto sm:max-w-none">
                    <Link href={`/tenants/${s.id}`} className="block truncate font-medium sm:max-w-56 after:absolute after:inset-0 hover:underline">
                      {s.name}
                    </Link>
                    <a
                      href={shopOrigin(s.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 inline-flex min-h-6 items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      <bdi dir="ltr">{s.slug}</bdi>
                      <ExternalLink className="size-3 rtl:-scale-x-100" aria-hidden />
                      <span className="sr-only">{t("openShop")}</span>
                    </a>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{s.plan?.name ?? "—"}</TableCell>
                  <TableCell>
                    <SubStatusBadge status={s.effectiveStatus} />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {s.subscriptionStatus === "TRIAL" ? date(s.trialEndsAt) : date(s.paidUntil)}
                  </TableCell>
                  <TableCell className="hidden text-end md:table-cell">{num(s._count.users)}</TableCell>
                  <TableCell className="hidden text-end md:table-cell">{num(s._count.tickets)}</TableCell>
                  <TableCell className="hidden text-end md:table-cell">{num(s._count.sales)}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">{date(s.createdAt)}</TableCell>
                  <TableCell className="ps-0 sm:ps-4">
                    <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

