import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus, Receipt, SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { UrlSearchInput } from "@/components/url-search-input";
import { listSales } from "@/features/pos/queries";
import { SalesTable } from "@/features/pos/ui/sales-table";
import { requirePermission } from "@/lib/tenant";

export default async function SalesPage({ params, searchParams }: PageProps<"/shop/[slug]/sales">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { db, shop, readOnly } = await requirePermission(slug, "pos");
  const [t, tm, format] = await Promise.all([getTranslations("sales"), getTranslations("paymentMethods"), getFormatter()]);
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize } = await listSales(db, { q, page });
  const rate = shop.exchangeRate;
  const rounding = shop.lbpRounding;
  const methods = (ps: { method: string }[]) => [...new Set(ps.map((p) => p.method))].map((m) => tm(m as never)).join(", ");

  const newSale = !readOnly && (
    <Button asChild>
      <Link href="/pos">
        <Plus />
        {t("newSale")}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle", { count: total })} actions={newSale} />

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="border-b p-3 sm:p-4">
          <UrlSearchInput basePath="/sales" label={t("search")} placeholder={t("searchPlaceholder")} className="sm:max-w-sm" />
        </div>

        {rows.length === 0 ? (
          q ? (
            <EmptyState icon={SearchX} title={t("noResults")} body={t("noResultsBody", { q })} />
          ) : (
            <EmptyState icon={Receipt} title={t("emptyTitle")} body={t("emptyBody")} action={newSale} />
          )
        ) : (
          <>
            <SalesTable
              rate={rate}
              rounding={rounding}
              rows={rows.map((s) => ({
                id: s.id,
                number: s.number,
                date: format.dateTime(s.createdAt, { dateStyle: "medium", timeStyle: "short" }),
                customer: s.customer?.name ?? null,
                items: s._count.items,
                totalUsdCents: s.totalUsdCents,
                voided: s.status === "VOIDED",
                methods: methods(s.payments),
                balanceUsdCents: s.balanceUsdCents,
                cashier: s.cashier.name,
              }))}
            />
            <div className="border-t empty:hidden">
              <Pagination page={page} pageSize={pageSize} total={total} basePath="/sales" params={sp} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
