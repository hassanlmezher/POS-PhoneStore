import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight, Phone, Truck, Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { listSuppliers } from "@/features/suppliers/queries";
import { SupplierDialogButton } from "@/features/suppliers/ui/supplier-dialog";
import { formatPhone } from "@/lib/phone";
import { requirePermission } from "@/lib/tenant";

export default async function SuppliersPage({ params }: PageProps<"/shop/[slug]/suppliers">) {
  const { slug } = await params;
  const ctx = await requirePermission(slug, "suppliers");
  const { shop, readOnly } = ctx;
  const [t, format, rows] = await Promise.all([getTranslations("suppliers"), getFormatter(), listSuppliers(ctx)]);
  const owed = rows.reduce((s, r) => s + Math.max(0, r.owedUsdCents), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={!readOnly && <SupplierDialogButton />} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile icon={Wallet} label={t("totalOwed")} tone={owed > 0 ? "warning" : "default"}>
          <Money usdCents={owed} rate={shop.exchangeRate} rounding={shop.lbpRounding} lbpClassName="text-sm" />
        </StatTile>
        <StatTile icon={Truck} label={t("count")}>{rows.length}</StatTile>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card shadow-card">
          <EmptyState icon={Truck} title={t("emptyTitle")} body={t("emptyBody")} action={!readOnly && <SupplierDialogButton />} />
        </div>
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/suppliers/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="truncate font-medium rtl:text-right">
                    {r.name}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {r.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone aria-hidden className="size-3.5" />
                        <Ltr>{formatPhone(r.phone, shop.countryCode)}</Ltr>
                      </span>
                    )}
                    {r.lastPurchase && <span>{t("lastPurchase", { date: format.dateTime(r.lastPurchase, { dateStyle: "medium" }) })}</span>}
                  </p>
                </div>
                <div className="text-end rtl:text-start">
                  {r.owedUsdCents > 0 ? (
                    <>
                      <span className="block text-xs text-muted-foreground">{t("youOwe")}</span>
                      <Money usdCents={r.owedUsdCents} rate={shop.exchangeRate} rounding={shop.lbpRounding} layout="inline" usdClassName="font-semibold text-warning" lbpClassName="text-xs" />
                    </>
                  ) : (
                    <span className="text-sm font-medium text-success">{r.owedUsdCents < 0 ? t("credit") : t("settled")}</span>
                  )}
                </div>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle-foreground rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
