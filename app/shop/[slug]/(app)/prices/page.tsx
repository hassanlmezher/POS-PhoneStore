import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import type { QuoteTexts } from "@/features/prices/message";
import { listPrices } from "@/features/prices/queries";
import { PriceList } from "@/features/prices/ui/price-list";
import { QuickQuote } from "@/features/prices/ui/quick-quote";
import { getDeviceCatalog } from "@/features/tickets/queries";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";

async function quoteTexts(locale: "en" | "ar"): Promise<QuoteTexts> {
  const t = await getTranslations({ locale, namespace: "prices.quoteMessage" });
  return { body: t.raw("body") as string, line: t.raw("line") as string, total: t.raw("total") as string };
}

export default async function PricesPage({ params }: PageProps<"/shop/[slug]/prices">) {
  const { slug } = await params;
  const { shop, user, readOnly } = await requireShop(slug);
  const [t, prices, catalog, en, ar] = await Promise.all([
    getTranslations("prices"),
    listPrices(shop.id),
    getDeviceCatalog(shop.id),
    quoteTexts("en"),
    quoteTexts("ar"),
  ]);
  const priced = new Set(prices.map((p) => p.modelId).filter(Boolean));
  const quoteCatalog = catalog.map((b) => ({ ...b, models: b.models.filter((m) => priced.has(m.id)) })).filter((b) => b.models.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {prices.length > 0 && (
        <QuickQuote
          catalog={quoteCatalog}
          prices={prices}
          shopName={shop.name}
          rate={shop.exchangeRate}
          rounding={shop.lbpRounding}
          defaultLocale={shop.defaultLocale}
          texts={{ EN: en, AR: ar }}
          canCreateTicket={can(user.role, "tickets.create") && !readOnly}
        />
      )}
      <PriceList prices={prices} catalog={catalog} canEdit={can(user.role, "prices.edit") && !readOnly} rate={shop.exchangeRate} rounding={shop.lbpRounding} />
    </div>
  );
}
