import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRight, MessageCircle, Phone } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { SectionCard } from "@/components/section-card";
import { StatTile } from "@/components/stat-tile";
import { reorderList, supplierDetail } from "@/features/suppliers/queries";
import { PayButton, PurchaseButton, ReorderButton } from "@/features/suppliers/ui/supplier-actions";
import { SupplierDialogButton } from "@/features/suppliers/ui/supplier-dialog";
import { SupplierHistory, type HistoryRow } from "@/features/suppliers/ui/supplier-history";
import { dayKey } from "@/lib/dates";
import { formatPhone, waNumber } from "@/lib/phone";
import { requirePermission } from "@/lib/tenant";
import { HandCoins, PackagePlus, Wallet } from "lucide-react";

export default async function SupplierPage({ params }: PageProps<"/shop/[slug]/suppliers/[id]">) {
  const { slug, id } = await params;
  const ctx = await requirePermission(slug, "suppliers");
  const { shop, readOnly } = ctx;
  const detail = await supplierDetail(ctx, id);
  if (!detail) notFound();
  const { supplier } = detail;
  const shopLocale = shop.defaultLocale === "AR" ? "ar" : "en";
  const [t, tl, reorder, drawer] = await Promise.all([
    getTranslations("suppliers"),
    getTranslations({ locale: shopLocale, namespace: "suppliers" }),
    reorderList(ctx, supplier.id),
    ctx.db.cashSession.findFirst({ where: { closedAt: null }, select: { id: true } }),
  ]);
  const common = { supplierId: supplier.id, today: dayKey(new Date(), shop.timezone), drawerOpen: !!drawer, rate: shop.exchangeRate, rounding: shop.lbpRounding };
  const rows: HistoryRow[] = detail.history.map((h) =>
    h.kind === "purchase"
      ? {
          kind: "purchase",
          id: h.id,
          at: h.at.toISOString(),
          usdCents: h.usdCents,
          balanceAfter: h.balanceAfter,
          reference: h.data.reference,
          note: h.data.note,
          items: h.data.items.map((i) => ({ name: i.product.name, qty: i.qty, unitCostUsdCents: i.unitCostUsdCents })),
        }
      : {
          kind: "payment",
          id: h.id,
          at: h.at.toISOString(),
          usdCents: h.usdCents,
          balanceAfter: h.balanceAfter,
          note: h.data.note,
          method: h.data.method,
          currency: h.data.currency,
          amount: h.data.amount,
          withPurchase: !!h.data.purchaseId,
          fromDrawer: !!h.data.cashMovementId,
        },
  );

  return (
    <div className="flex flex-col gap-6">
      <nav>
        <Link href="/suppliers" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight aria-hidden className="size-4 rotate-180 rtl:rotate-0" />
          {t("title")}
        </Link>
      </nav>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 dir="auto" className="text-2xl font-semibold tracking-tight">
            {supplier.name}
          </h1>
          {supplier.phone && (
            <div className="flex flex-wrap items-center gap-x-4 text-sm">
              <a href={`tel:${supplier.phone}`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-primary">
                <Phone aria-hidden className="size-4 text-muted-foreground" />
                <Ltr>{formatPhone(supplier.phone, shop.countryCode)}</Ltr>
              </a>
              <a href={`https://wa.me/${waNumber(supplier.phone)}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-1.5 hover:text-primary">
                <MessageCircle aria-hidden className="size-4 text-success" />
                WhatsApp
              </a>
            </div>
          )}
          {supplier.note && <p className="text-sm text-muted-foreground">{supplier.note}</p>}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <PurchaseButton {...common} />
            <PayButton {...common} owedUsdCents={detail.owedUsdCents} />
            <ReorderButton
              rows={reorder}
              phone={supplier.phone}
              supplierName={supplier.name}
              shopName={shop.name}
              texts={{ body: tl.raw("waOrder") as string, line: tl.raw("waOrderLine") as string }}
            />
            <SupplierDialogButton supplier={supplier} />
          </div>
        )}
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile icon={Wallet} label={detail.owedUsdCents < 0 ? t("credit") : t("youOwe")} tone={detail.owedUsdCents > 0 ? "warning" : "success"}>
          <Money usdCents={Math.abs(detail.owedUsdCents)} rate={shop.exchangeRate} rounding={shop.lbpRounding} lbpClassName="text-sm" />
        </StatTile>
        <StatTile icon={PackagePlus} label={t("totalBought")}>
          <Money usdCents={detail.boughtUsdCents} rate={shop.exchangeRate} rounding={shop.lbpRounding} lbpClassName="text-sm" />
        </StatTile>
        <StatTile icon={HandCoins} label={t("totalPaid")}>
          <Money usdCents={detail.paidUsdCents} rate={shop.exchangeRate} rounding={shop.lbpRounding} lbpClassName="text-sm" />
        </StatTile>
      </section>

      <SectionCard title={t("history")} description={t("historyHint")} padded={false}>
        <SupplierHistory rows={rows} canEdit={!readOnly} rate={shop.exchangeRate} rounding={shop.lbpRounding} />
      </SectionCard>
    </div>
  );
}
