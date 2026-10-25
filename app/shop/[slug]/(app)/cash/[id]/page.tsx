import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft, CircleCheck, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { drawerTotals, getSession } from "@/features/cash/queries";
import { CashDiff } from "@/features/cash/ui/cash-diff";
import { DrawerBreakdown } from "@/features/cash/ui/drawer-breakdown";
import { MovementList, OtherMethodsList } from "@/features/cash/ui/session-lists";
import { requirePermission } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export default async function CashSessionPage({ params, searchParams }: PageProps<"/shop/[slug]/cash/[id]">) {
  const { slug, id } = await params;
  const sp = await searchParams;
  const { shop } = await requirePermission(slug, "cash");
  const [session, totals] = await Promise.all([getSession(shop.id, id), drawerTotals(shop.id, id)]);
  if (!session || !totals) notFound();
  const [t, format] = await Promise.all([getTranslations("cash"), getFormatter()]);
  const when = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const closed = !!session.closedAt;

  // Closed sessions show the snapshot taken at close, not a recomputation.
  const counted = closed
    ? {
        expectedUsdCents: session.expectedUsdCents ?? totals.expectedUsdCents,
        expectedLbp: session.expectedLbp ?? totals.expectedLbp,
        countedUsdCents: session.countedUsdCents ?? 0,
        countedLbp: session.countedLbp ?? 0,
      }
    : undefined;
  const diffUsd = counted ? counted.countedUsdCents - counted.expectedUsdCents : 0;
  const diffLbp = counted ? counted.countedLbp - counted.expectedLbp : 0;
  const exact = diffUsd === 0 && diffLbp === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ms-3">
          <Link href="/cash?tab=history">
            <ChevronLeft className="rtl:rotate-180" />
            {t("tabHistory")}
          </Link>
        </Button>
      </div>
      <PageHeader
        title={t("sessionTitle", { date: format.dateTime(session.openedAt, { dateStyle: "medium" }) })}
        description={
          <>
            {t("openedAtBy", { time: when(session.openedAt), name: session.openedBy.name })}
            {session.closedAt && <> · {t("closedAtBy", { time: when(session.closedAt), name: session.closedBy?.name ?? "—" })}</>}
          </>
        }
        actions={closed ? <Badge variant="secondary">{t("statusClosed")}</Badge> : <Badge variant="success">{t("drawerOpen")}</Badge>}
      />

      {sp.closed === "1" && counted && (
        <div
          role="status"
          className={cn(
            "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:p-5",
            exact ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft",
          )}
        >
          {exact ? <CircleCheck className="size-6 shrink-0 text-success" aria-hidden /> : <TriangleAlert className="size-6 shrink-0 text-warning" aria-hidden />}
          <div className="flex-1">
            <p className="font-semibold">{t(exact ? "resultExact" : "resultDiff")}</p>
            <p className="text-sm text-muted-foreground">{t("resultBody")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["USD", diffUsd],
                ["LBP", diffLbp],
              ] as const
            ).map(([cur, diff]) => (
              <span key={cur} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {cur}
                <CashDiff diff={diff} currency={cur} />
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title={t("breakdown")} padded={false}>
          <DrawerBreakdown totals={totals} counted={counted} />
        </SectionCard>
        <div className="flex flex-col gap-6">
          <SectionCard title={t("movements")} padded={false}>
            <MovementList movements={session.movements} />
          </SectionCard>
          <SectionCard title={t("otherMethods")} description={t("otherMethodsHint")} padded={false}>
            <OtherMethodsList items={totals.otherMethods} rate={shop.exchangeRate} rounding={shop.lbpRounding} />
          </SectionCard>
          {session.note && (
            <SectionCard title={t("note")}>
              <p className="text-sm whitespace-pre-wrap">{session.note}</p>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
