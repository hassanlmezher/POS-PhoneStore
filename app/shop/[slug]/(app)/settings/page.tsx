import { getTranslations } from "next-intl/server";
import { LinkTabs } from "@/components/link-tabs";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatTicketNumber } from "@/lib/numbering";
import { requirePermission, type ShopContext } from "@/lib/tenant";
import { listPresets } from "@/features/settings/presets";
import { exchangeRateHistory, listStaff, listTemplates, shopPlan } from "@/features/settings/queries";
import { TEMPLATE_KEYS } from "@/features/settings/schema";
import { QuickPicks } from "@/features/settings/ui/quick-picks";
import { RateSection } from "@/features/settings/ui/rate-section";
import { ReceiptSettingsForm } from "@/features/settings/ui/receipt-settings-form";
import { ShopProfileForm } from "@/features/settings/ui/shop-profile-form";
import { StaffSection } from "@/features/settings/ui/staff-section";
import { TemplateEditor } from "@/features/settings/ui/template-editor";
import { trackUrl } from "@/features/tickets/notify";

const TABS = ["shop", "receipts", "rate", "messages", "quickPicks", "staff"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({ params, searchParams }: PageProps<"/shop/[slug]/settings">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requirePermission(slug, "settings");
  const t = await getTranslations("settings");
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "shop";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <LinkTabs
        label={t("sections")}
        items={TABS.map((k) => ({ href: k === "shop" ? "/settings" : `/settings?tab=${k}`, label: t(`tabs.${k}`), active: tab === k }))}
      />
      {tab === "shop" && <ShopTab ctx={ctx} />}
      {tab === "receipts" && <ReceiptsTab ctx={ctx} />}
      {tab === "rate" && <RateTab ctx={ctx} />}
      {tab === "messages" && <MessagesTab ctx={ctx} />}
      {tab === "quickPicks" && <QuickPicksTab ctx={ctx} />}
      {tab === "staff" && <StaffTab ctx={ctx} />}
    </div>
  );
}

function ShopTab({ ctx: { shop, readOnly } }: { ctx: ShopContext }) {
  return (
    <ShopProfileForm
      readOnly={readOnly}
      shop={{
        name: shop.name,
        address: shop.address,
        phone: shop.phone,
        defaultLocale: shop.defaultLocale,
        logoUrl: shop.logoUrl,
        timezone: shop.timezone,
        countryCode: shop.countryCode,
        googleReviewUrl: shop.googleReviewUrl,
      }}
    />
  );
}

async function ReceiptsTab({ ctx: { shop, readOnly } }: { ctx: ShopContext }) {
  const last = await prisma.ticket.findFirst({ where: { shopId: shop.id }, orderBy: { number: "desc" }, select: { number: true } });
  return (
    <ReceiptSettingsForm
      readOnly={readOnly}
      rate={shop.exchangeRate}
      nextTicketNumber={shop.ticketSeq + 1}
      latestTicket={last ? { number: last.number, label: formatTicketNumber(shop.ticketPrefix, last.number) } : null}
      shop={{
        ticketPrefix: shop.ticketPrefix,
        defaultWarrantyDays: shop.defaultWarrantyDays,
        storageFreeDays: shop.storageFreeDays,
        storageFeeUsdCents: shop.storageFeeUsdCents,
        lbpRounding: shop.lbpRounding,
        receiptFooter: shop.receiptFooter ?? "",
        receiptFooterAr: shop.receiptFooterAr ?? "",
        termsText: shop.termsText ?? "",
        termsTextAr: shop.termsTextAr ?? "",
      }}
    />
  );
}

async function RateTab({ ctx: { shop, readOnly } }: { ctx: ShopContext }) {
  const history = await exchangeRateHistory(shop.id);
  return (
    <RateSection
      readOnly={readOnly}
      rate={shop.exchangeRate}
      history={history.map((r) => ({ id: r.id, rate: r.rate, at: r.createdAt, by: r.setBy?.name ?? null }))}
    />
  );
}

async function MessagesTab({ ctx: { shop, readOnly } }: { ctx: ShopContext }) {
  const rows = await listTemplates(shop.id);
  const body = (key: string, locale: string) => rows.find((r) => r.key === key && r.locale === locale)?.body ?? "";
  const sampleTicket = formatTicketNumber(shop.ticketPrefix, 1042);
  return (
    <TemplateEditor
      readOnly={readOnly}
      templates={TEMPLATE_KEYS.map((key) => ({ key, en: body(key, "EN"), ar: body(key, "AR") }))}
      sample={{
        shop: shop.name,
        ticket: sampleTicket,
        trackUrl: trackUrl(shop.slug, "4f9c2a7e1b"),
        rate: shop.exchangeRate,
        rounding: shop.lbpRounding,
      }}
    />
  );
}

async function QuickPicksTab({ ctx: { shop, readOnly } }: { ctx: ShopContext }) {
  const presets = await listPresets(shop.id);
  const of = (kind: "PROBLEM" | "PAY_IN" | "PAY_OUT") =>
    presets.filter((p) => p.kind === kind).map(({ id, labelEn, labelAr }) => ({ id, labelEn, labelAr }));
  return <QuickPicks readOnly={readOnly} lists={{ PROBLEM: of("PROBLEM"), PAY_IN: of("PAY_IN"), PAY_OUT: of("PAY_OUT") }} />;
}

async function StaffTab({ ctx: { shop, user, readOnly } }: { ctx: ShopContext }) {
  const [staff, plan] = await Promise.all([listStaff(shop.id), shopPlan(shop.planId)]);
  return <StaffSection staff={staff} currentUserId={user.id} maxStaff={plan?.maxStaff ?? null} readOnly={readOnly} />;
}
