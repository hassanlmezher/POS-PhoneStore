import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Archive, CircleCheckBig, Clock, Settings, Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { pickupWhatsApp } from "@/features/pickup/message";
import { listUncollected } from "@/features/pickup/queries";
import { PICKUP_STAGES } from "@/features/pickup/rules";
import { PickupList } from "@/features/pickup/ui/pickup-list";
import { formatMoney } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pickup");
  return { title: t("title") };
}

export default async function PickupPage({ params }: PageProps<"/shop/[slug]/tickets/pickup">) {
  const { slug } = await params;
  const ctx = await requireShop(slug);
  const { shop, user, readOnly } = ctx;
  const [t, format, list] = await Promise.all([getTranslations("pickup"), getFormatter(), listUncollected(ctx)]);
  const date = (d: Date) => format.dateTime(d, { dateStyle: "medium" });
  const showMoney = user.role !== "TECHNICIAN";
  const feeOn = shop.storageFeeUsdCents > 0;

  const rows = await Promise.all(
    list.map(async (r) => {
      const nextStage = Math.min(PICKUP_STAGES.length, Math.max(r.dueStage, r.remindersSent + 1));
      return {
        id: r.id,
        number: r.number,
        label: formatTicketNumber(shop.ticketPrefix, r.number),
        device: r.device,
        customer: r.customer.name,
        days: r.days,
        readySince: date(r.readyAt),
        balanceUsdCents: showMoney ? r.balanceUsdCents : 0,
        remindersSent: r.remindersSent,
        remindedAt: r.remindedAt ? date(r.remindedAt) : null,
        dueStage: r.dueStage,
        nextStage,
        waUrl: r.customer.phone ? await pickupWhatsApp(shop, r, nextStage) : null,
        storageDueUsdCents: r.storageDueUsdCents,
        storageChargedUsdCents: r.storageChargedUsdCents,
      };
    }),
  );
  const longWait = list.filter((r) => r.days >= 14).length;
  const waitingMoney = list.reduce((s, r) => s + r.balanceUsdCents, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={feeOn ? t("subtitleFee", { free: shop.storageFreeDays, fee: formatMoney(shop.storageFeeUsdCents, "USD") }) : t("subtitle")}
        actions={
          can(user.role, "settings") && (
            <Button variant="outline" asChild>
              <Link href="/settings?tab=receipts#storage">
                <Settings />
                {t(feeOn ? "feeSettings" : "setupFee")}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile icon={Archive} label={t("statWaiting")}>{list.length}</StatTile>
        <StatTile icon={Clock} label={t("statLong")} tone="warning">{longWait}</StatTile>
        {showMoney && (
          <StatTile icon={Wallet} label={t("statMoney")} tone="success" className="col-span-2 lg:col-span-1">
            <Money usdCents={waitingMoney} rate={shop.exchangeRate} rounding={shop.lbpRounding} layout="inline" />
          </StatTile>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={CircleCheckBig} title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : (
        <PickupList
          rows={rows}
          rate={shop.exchangeRate}
          rounding={shop.lbpRounding}
          canRemind={can(user.role, "tickets.status") && !readOnly}
          canCharge={feeOn && can(user.role, "tickets.items") && !readOnly}
        />
      )}
    </div>
  );
}
