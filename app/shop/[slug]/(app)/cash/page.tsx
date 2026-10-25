import Link from "next/link";
import { useTranslations } from "next-intl";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, History, Wallet } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { drawerTotals, getOpenSession, listClosedSessions } from "@/features/cash/queries";
import { CashDiff } from "@/features/cash/ui/cash-diff";
import { CloseDrawerForm } from "@/features/cash/ui/close-drawer-form";
import { DrawerBreakdown } from "@/features/cash/ui/drawer-breakdown";
import { MovementForm } from "@/features/cash/ui/movement-form";
import { MovementList, OtherMethodsList } from "@/features/cash/ui/session-lists";
import { OpenDrawerForm } from "@/features/cash/ui/open-drawer-form";
import { formatMoney } from "@/lib/money";
import { listPresets, presetLabel } from "@/features/settings/presets";
import { requirePermission } from "@/lib/tenant";

export default async function CashPage({ params, searchParams }: PageProps<"/shop/[slug]/cash">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { shop, readOnly } = await requirePermission(slug, "cash");
  const [t, format, locale] = await Promise.all([getTranslations("cash"), getFormatter(), getLocale()]);
  const tab = sp.tab === "history" ? "history" : "current";
  const page = Math.max(1, Number(sp.page) || 1);

  const [open, history] = await Promise.all([getOpenSession(shop.id), listClosedSessions(shop.id, tab === "history" ? page : 1)]);
  const [totals, presets] = await Promise.all([
    open ? drawerTotals(shop.id, open.id) : null,
    open && !readOnly ? listPresets(shop.id) : [],
  ]);
  const reasons = (kind: "PAY_IN" | "PAY_OUT") =>
    presets.filter((p) => p.kind === kind).map((p) => ({ id: p.id, label: presetLabel(p, locale) }));
  const when = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });

  const tabs = (
    <LinkTabs
      label={t("sections")}
      items={[
        { href: "/cash", label: t("tabCurrent"), active: tab === "current" },
        { href: "/cash?tab=history", label: t("tabHistory"), active: tab === "history", count: history.total },
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {tabs}

      {tab === "history" ? (
        <HistoryTable history={history} page={page} sp={sp} when={when} />
      ) : open && totals ? (
        <>
          <AutoRefresh seconds={60} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm shadow-card sm:px-6">
            <span className="inline-flex items-center gap-2 font-medium text-success">
              <span aria-hidden className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2.5 rounded-full bg-success" />
              </span>
              {t("drawerOpen")}
            </span>
            <span className="text-muted-foreground">{t("openedAtBy", { time: when(open.openedAt), name: open.openedBy.name })}</span>
            <span className="text-muted-foreground sm:ms-auto">{t("salesCount", { count: totals.salesCount })}</span>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:grid-rows-[auto_auto_auto_1fr]">
              <section aria-label={t("expectedInDrawer")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-start-1">
                {(
                  [
                    ["USD", totals.expectedUsdCents],
                    ["LBP", totals.expectedLbp],
                  ] as const
                ).map(([cur, v]) => (
                  <div key={cur} className="rounded-xl border bg-card p-4 shadow-card sm:p-5">
                    <p className="text-sm text-muted-foreground">{t("expectedIn", { currency: cur })}</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                      <bdi dir="ltr">{formatMoney(v, cur)}</bdi>
                    </p>
                  </div>
                ))}
              </section>

              <SectionCard className="xl:col-start-1" title={t("breakdown")} description={t("breakdownHint")} padded={false}>
                <DrawerBreakdown totals={totals} />
              </SectionCard>

              {!readOnly && (
                <div className="grid grid-cols-1 content-start gap-6 md:grid-cols-2 xl:col-start-2 xl:row-span-4 xl:row-start-1 xl:grid-cols-1">
                  <SectionCard title={t("payInOut")} description={t("payInOutHint")}>
                    <MovementForm reasons={{ PAY_IN: reasons("PAY_IN"), PAY_OUT: reasons("PAY_OUT") }} />
                  </SectionCard>
                  <SectionCard title={t("closeDrawer")} description={t("closeHint")}>
                    <CloseDrawerForm expectedUsdCents={totals.expectedUsdCents} expectedLbp={totals.expectedLbp} />
                  </SectionCard>
                </div>
              )}

              <SectionCard className="xl:col-start-1" title={t("movements")} padded={false}>
                <MovementList movements={open.movements} />
              </SectionCard>

              <SectionCard className="self-start xl:col-start-1" title={t("otherMethods")} description={t("otherMethodsHint")} padded={false}>
                <OtherMethodsList items={totals.otherMethods} rate={shop.exchangeRate} rounding={shop.lbpRounding} />
              </SectionCard>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title={t("openDrawer")} description={t("openHint")}>
            {readOnly ? <p className="text-sm text-muted-foreground">{t("readOnly")}</p> : <OpenDrawerForm />}
          </SectionCard>
          <SectionCard
            title={t("lastSession")}
            padded={false}
            actions={
              history.rows[0] && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/cash/${history.rows[0].id}`}>
                    {t("viewDetails")}
                    <ChevronRight className="rtl:rotate-180" />
                  </Link>
                </Button>
              )
            }
          >
            {history.rows[0] ? (
              <LastSession s={history.rows[0]} when={when} />
            ) : (
              <EmptyState icon={Wallet} title={t("noSessionsTitle")} body={t("noSessionsBody")} />
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

type History = Awaited<ReturnType<typeof listClosedSessions>>;
type Row = History["rows"][number];

function LastSession({ s, when }: { s: Row; when: (d: Date) => string }) {
  const t = useTranslations("cash");
  return (
    <dl className="divide-y text-sm">
      <div className="flex justify-between gap-3 px-4 py-3 sm:px-6">
        <dt className="text-muted-foreground">{t("closedAt")}</dt>
        <dd className="text-end">{s.closedAt ? t("atBy", { time: when(s.closedAt), name: s.closedBy?.name ?? "—" }) : "—"}</dd>
      </div>
      {(
        [
          ["USD", s.countedUsdCents ?? 0, s.diffUsdCents],
          ["LBP", s.countedLbp ?? 0, s.diffLbp],
        ] as const
      ).map(([cur, counted, diff]) => (
        <div key={cur} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <dt className="text-muted-foreground">{t("countedIn", { currency: cur })}</dt>
          <dd className="flex flex-wrap items-center justify-end gap-2">
            <bdi dir="ltr" className="font-medium tabular-nums">
              {formatMoney(counted, cur)}
            </bdi>
            <CashDiff diff={diff} currency={cur} />
          </dd>
        </div>
      ))}
      {s.note && (
        <div className="px-4 py-3 sm:px-6">
          <dt className="text-muted-foreground">{t("note")}</dt>
          <dd className="mt-1 whitespace-pre-wrap">{s.note}</dd>
        </div>
      )}
    </dl>
  );
}

function HistoryTable({
  history,
  page,
  sp,
  when,
}: {
  history: History;
  page: number;
  sp: Record<string, string | string[] | undefined>;
  when: (d: Date) => string;
}) {
  const t = useTranslations("cash");
  if (history.rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card shadow-card">
        <EmptyState icon={History} title={t("noSessionsTitle")} body={t("noSessionsBody")} />
      </div>
    );
  }
  const pair = (usd: number | null, lbp: number | null) => (
    <span dir="ltr" className="inline-flex flex-col items-end whitespace-nowrap tabular-nums rtl:items-start">
      <span>{formatMoney(usd ?? 0, "USD")}</span>
      <span className="text-xs text-muted-foreground">{formatMoney(lbp ?? 0, "LBP")}</span>
    </span>
  );
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("session")}</TableHead>
            <TableHead className="hidden xl:table-cell">{t("staff")}</TableHead>
            <TableHead className="text-end">{t("expected")}</TableHead>
            <TableHead className="text-end">{t("counted")}</TableHead>
            <TableHead className="text-end">{t("difference")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.rows.map((s) => (
            <TableRow key={s.id} className="relative">
              <TableCell>
                <Link href={`/cash/${s.id}`} className="font-medium outline-none after:absolute after:inset-0 focus-visible:underline">
                  {when(s.openedAt)}
                </Link>
                <p className="text-xs text-muted-foreground">{s.closedAt && t("closedAtShort", { time: when(s.closedAt) })}</p>
              </TableCell>
              <TableCell className="hidden text-muted-foreground xl:table-cell">
                <p>{t("openedByName", { name: s.openedBy.name })}</p>
                <p className="text-xs">{t("closedByName", { name: s.closedBy?.name ?? "—" })}</p>
              </TableCell>
              <TableCell className="text-end">{pair(s.expectedUsdCents, s.expectedLbp)}</TableCell>
              <TableCell className="text-end">{pair(s.countedUsdCents, s.countedLbp)}</TableCell>
              <TableCell className="text-end">
                <span className="inline-flex flex-col items-end gap-1 rtl:items-start">
                  <CashDiff diff={s.diffUsdCents} currency="USD" />
                  <CashDiff diff={s.diffLbp} currency="LBP" />
                </span>
              </TableCell>
              <TableCell>
                <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ul className="divide-y md:hidden">
        {history.rows.map((s) => (
          <li key={s.id}>
            <Link href={`/cash/${s.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-muted/50">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{when(s.openedAt)}</p>
                <p className="truncate text-xs text-muted-foreground">{t("closedByName", { name: s.closedBy?.name ?? "—" })}</p>
              </div>
              <span className="flex flex-col items-end gap-1 rtl:items-start">
                <CashDiff diff={s.diffUsdCents} currency="USD" />
                <CashDiff diff={s.diffLbp} currency="LBP" />
              </span>
              <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t empty:hidden">
        <Pagination page={page} pageSize={history.pageSize} total={history.total} basePath="/cash" params={sp} />
      </div>
    </div>
  );
}
