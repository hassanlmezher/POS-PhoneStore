import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlarmClock, PackageCheck, Truck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { knownSuppliers, listPartOrders, partOrderCounts } from "@/features/partorders/queries";
import { OrderList } from "@/features/partorders/ui/order-list";
import { dayKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partOrders");
  return { title: t("title") };
}

export default async function PartOrdersPage({ params, searchParams }: PageProps<"/shop/[slug]/tickets/parts">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireShop(slug);
  const { shop, user, readOnly } = ctx;
  const view = sp.view === "arrived" ? "arrived" : "waiting";
  const [t, rows, counts, suppliers] = await Promise.all([
    getTranslations("partOrders"),
    listPartOrders(ctx, view),
    partOrderCounts(ctx),
    knownSuppliers(ctx),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile icon={Truck} label={t("statWaiting")}>{counts.waiting}</StatTile>
        <StatTile icon={AlarmClock} label={t("statLate")} tone={counts.late ? "warning" : "default"}>
          {counts.late}
        </StatTile>
      </div>
      <LinkTabs
        label={t("title")}
        items={[
          { href: "/tickets/parts", label: t("tabWaiting"), active: view === "waiting", count: counts.waiting },
          { href: "/tickets/parts?view=arrived", label: t("tabArrived"), active: view === "arrived" },
        ]}
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={view === "waiting" ? Truck : PackageCheck} title={t(view === "waiting" ? "emptyWaiting" : "emptyArrived")} body={t("emptyBody")} />
        </div>
      ) : (
        <div className="rounded-xl bg-card shadow-card">
          <OrderList
            rows={rows}
            canEdit={can(user.role, "tickets.status") && !readOnly}
            suppliers={suppliers}
            today={dayKey(new Date(), shop.timezone)}
            rate={shop.exchangeRate}
            rounding={shop.lbpRounding}
            ticketId={null}
          />
        </div>
      )}
    </div>
  );
}
