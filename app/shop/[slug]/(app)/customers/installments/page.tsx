import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlarmClock, CalendarCheck, CalendarClock, ChevronRight, ShoppingBag, Wallet, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { listPlans } from "@/features/installments/queries";
import { PlanParts } from "@/features/installments/ui/plan-parts";
import { dayKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("installments");
  return { title: t("title") };
}

export default async function InstallmentsPage({ params, searchParams }: PageProps<"/shop/[slug]/customers/installments">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireShop(slug);
  const { shop, user, readOnly } = ctx;
  const view = sp.view === "done" ? "done" : "open";
  const [t, tc, all] = await Promise.all([getTranslations("installments"), getTranslations("customers"), listPlans(ctx)]);
  const open = all.filter((p) => !p.done);
  const rows = view === "done" ? all.filter((p) => p.done) : open;
  const late = open.filter((p) => p.next?.state === "late").length;
  const owed = open.reduce((s, p) => s + p.owedUsdCents, 0);
  const today = dayKey(new Date(), shop.timezone);
  const rate = shop.exchangeRate;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("title")}>
        <Link href="/customers" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight aria-hidden className="size-4 rotate-180 rtl:rotate-0" />
          {tc("title")}
        </Link>
      </nav>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile icon={CalendarClock} label={t("statOpen")}>
          {open.length}
        </StatTile>
        <StatTile icon={AlarmClock} label={t("statLate")} tone={late ? "warning" : "default"}>
          {late}
        </StatTile>
        <div className="col-span-2 sm:col-span-1">
          <StatTile icon={Wallet} label={t("statOwed")}>
            <Money usdCents={owed} rate={rate} rounding={shop.lbpRounding} lbpClassName="text-sm" />
          </StatTile>
        </div>
      </div>
      <LinkTabs
        label={t("title")}
        items={[
          { href: "/customers/installments", label: t("tabOpen"), active: view === "open", count: open.length },
          { href: "/customers/installments?view=done", label: t("tabDone"), active: view === "done" },
        ]}
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={view === "open" ? CalendarClock : CalendarCheck} title={t(view === "open" ? "emptyOpen" : "emptyDone")} body={t("emptyBody")} />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((p) => {
            const canPay = can(user.role, p.kind === "sale" ? "pos" : "tickets.create") && !readOnly;
            const Icon = p.kind === "sale" ? ShoppingBag : Wrench;
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <Link href={`/customers/${p.customer.id}`} className="block truncate font-semibold hover:underline" dir="auto">
                        {p.customer.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        <Link href={p.href} className="hover:underline">
                          <Ltr>{p.kind === "sale" ? t("saleLabel", { number: p.number }) : p.label}</Ltr>
                        </Link>
                        {p.detail && ` · ${p.detail}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm sm:text-end">
                    <span className="text-xs text-muted-foreground">{p.done ? t("paidOff") : t("left")} </span>
                    {!p.done && (
                      <Money usdCents={p.owedUsdCents} rate={rate} rounding={shop.lbpRounding} layout="inline" className="text-sm whitespace-nowrap" usdClassName="font-semibold" lbpClassName="text-xs" />
                    )}
                  </div>
                </div>
                <PlanParts plan={p} canPay={canPay} rate={rate} rounding={shop.lbpRounding} today={today} payLabel={p.kind === "sale" ? t("saleLabel", { number: p.number }) : p.label} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
