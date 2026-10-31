import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Package, Plus, SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LinkTabs } from "@/components/link-tabs";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { UrlSearchInput } from "@/components/url-search-input";
import { listCategories, listProducts } from "@/features/inventory/queries";
import { InventoryTable } from "@/features/inventory/ui/inventory-table";
import { ProductDialogButton } from "@/features/inventory/ui/product-dialog";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";

const TABS = ["all", "accessories", "parts", "phones", "low"] as const;
type Tab = (typeof TABS)[number];

export default async function InventoryPage({ params, searchParams }: PageProps<"/shop/[slug]/inventory">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { db, shop, user, readOnly } = await requireShop(slug);
  const t = await getTranslations("inventory");

  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "all";
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const archived = sp.archived === "1";
  const isOwner = can(user.role, "inventory.adjust");
  const canAdd = isOwner && !readOnly;

  const [data, categories] = await Promise.all([
    listProducts(db, shop.id, {
      q,
      page,
      type: tab === "accessories" ? "ACCESSORY" : tab === "parts" ? "PART" : tab === "phones" ? "PHONE" : undefined,
      lowStock: tab === "low",
      includeArchived: archived,
    }),
    canAdd ? listCategories(db) : Promise.resolve([]),
  ]);

  const hrefFor = (next: Partial<{ tab: Tab; archived: boolean }>) => {
    const s = new URLSearchParams();
    const nt = next.tab ?? tab;
    if (nt !== "all") s.set("tab", nt);
    if (q) s.set("q", q);
    if (next.archived ?? archived) s.set("archived", "1");
    const qs = s.toString();
    return qs ? `/inventory?${qs}` : "/inventory";
  };

  const addButton = canAdd && (
    <ProductDialogButton categories={categories} rate={shop.exchangeRate} rounding={shop.lbpRounding}>
      <Plus />
      {t("add")}
    </ProductDialogButton>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle", { count: data.total })} actions={addButton} />

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4 xl:flex-row xl:items-center">
          <LinkTabs
            label={t("filter")}
            items={TABS.map((k) => ({
              href: hrefFor({ tab: k }),
              label: t(`tabs.${k}`),
              active: tab === k,
              ...(k === "low" ? { count: data.lowStockCount, tone: "warning" as const } : {}),
            }))}
          />
          <UrlSearchInput basePath="/inventory" label={t("search")} placeholder={t("searchPlaceholder")} className="sm:max-w-sm xl:ms-auto xl:max-w-xs xl:flex-1" />
          {isOwner && (
            <Link
              href={hrefFor({ archived: !archived })}
              className="inline-flex min-h-11 items-center text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
            >
              {archived ? t("hideArchived") : t("showArchived")}
            </Link>
          )}
        </div>

        {data.rows.length === 0 ? (
          q ? (
            <EmptyState icon={SearchX} title={t("noResults")} body={t("noResultsBody", { q })} />
          ) : tab === "low" ? (
            <EmptyState icon={Package} title={t("noLowStock")} body={t("noLowStockBody")} />
          ) : (
            <EmptyState icon={Package} title={t("emptyTitle")} body={isOwner ? t("emptyBody") : t("emptyBodyStaff")} action={addButton} />
          )
        ) : (
          <>
            <InventoryTable rows={data.rows} showCost={isOwner} rate={shop.exchangeRate} rounding={shop.lbpRounding} />
            <div className="border-t empty:hidden">
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/inventory" params={sp} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
