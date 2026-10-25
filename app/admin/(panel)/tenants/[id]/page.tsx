import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft, ExternalLink, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getShopForAdmin, listPlans } from "@/features/admin/queries";
import { ResetOwnerPasswordButton } from "@/features/admin/ui/reset-owner-password";
import { ShopBasicsForm } from "@/features/admin/ui/shop-basics-form";
import { SubStatusBadge } from "@/features/admin/ui/sub-status-badge";
import { SubscriptionPanel } from "@/features/admin/ui/subscription-panel";
import { DomainCard } from "@/features/admin/ui/domain-card";
import { DeleteShopCard } from "@/features/admin/ui/delete-shop";
import { shopDomainStatus } from "@/lib/domains";
import { ROOT_DOMAIN, shopOrigin } from "@/lib/hosts";

export default async function AdminShopPage({ params }: PageProps<"/admin/tenants/[id]">) {
  const { id } = await params;
  const [shop, plans, t, tr, format] = await Promise.all([
    getShopForAdmin(id),
    listPlans(),
    getTranslations("admin.shop"),
    getTranslations("roles"),
    getFormatter(),
  ]);
  if (!shop) notFound();
  const domainStatus = await shopDomainStatus(shop.slug);
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const date = (d: Date | null) => (d ? format.dateTime(d, { dateStyle: "medium" }) : "—");

  const usage: [string, React.ReactNode][] = [
    [t("tickets"), shop._count.tickets],
    [t("sales"), shop._count.sales],
    [t("customers"), shop._count.customers],
    [t("products"), shop._count.products],
    [t("staff"), shop.users.length],
    [t("created"), date(shop.createdAt)],
    [t("lastActivity"), shop.lastActivityAt ? format.relativeTime(shop.lastActivityAt) : "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="-mb-2 inline-flex h-11 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("back")}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {shop.name}
            <SubStatusBadge status={shop.effectiveStatus} />
          </span>
        }
        description={<bdi dir="ltr">{shopOrigin(shop.slug).replace(/^https?:\/\//, "")}</bdi>}
        actions={
          <Button variant="outline" asChild>
            <a href={shopOrigin(shop.slug)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="rtl:-scale-x-100" />
              {t("openShop")}
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <SubscriptionPanel
            shopId={shop.id}
            sub={{ planId: shop.planId, subscriptionStatus: shop.subscriptionStatus, trialEndsAt: shop.trialEndsAt, paidUntil: shop.paidUntil }}
            plans={plans.map((p) => ({ id: p.id, name: p.name, priceUsdCents: p.priceUsdCents, active: p.active }))}
            payments={shop.subscriptionPayments}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <ShopBasicsForm shop={{ id: shop.id, name: shop.name, slug: shop.slug }} rootDomain={ROOT_DOMAIN} protocol={protocol} />

          <DomainCard shopId={shop.id} status={domainStatus} />

          <DeleteShopCard shop={{ id: shop.id, slug: shop.slug, name: shop.name }} />

          <SectionCard title={t("usageTitle")}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              {usage.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title={t("staffTitle")} padded={false}>
            {shop.users.length === 0 ? (
              <EmptyState icon={Users} title={t("noStaff")} />
            ) : (
              <ul className="divide-y">
                {shop.users.map((u) => (
                  <li key={u.id} className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        <span className="truncate">{u.name}</span>
                        {!u.active && <Badge variant="secondary">{t("inactive")}</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        <bdi dir="ltr">{u.email}</bdi> · {tr(u.role)}
                      </p>
                    </div>
                    {u.role === "OWNER" && <ResetOwnerPasswordButton user={{ id: u.id, name: u.name, email: u.email }} />}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
