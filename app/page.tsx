import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listPlans } from "@/features/admin/queries";
import { demoHref, marketingContact } from "@/features/marketing/contact";
import { getShowcaseData } from "@/features/marketing/showcase";
import { getPlatformSettings } from "@/lib/platform";
import { waLink } from "@/lib/whatsapp";
import { SiteHeader } from "@/features/marketing/ui/site-header";
import { Hero } from "@/features/marketing/ui/hero";
import { DayFeatures } from "@/features/marketing/ui/day-features";
import { LocalStrip } from "@/features/marketing/ui/local-strip";
import { Pricing, type PublicPlan } from "@/features/marketing/ui/pricing";
import { Faq } from "@/features/marketing/ui/faq";
import { SiteFooter } from "@/features/marketing/ui/site-footer";

async function appName() {
  return (await getPlatformSettings()).appName;
}

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, app] = await Promise.all([getTranslations("marketing.meta"), getLocale(), appName()]);
  const title = t("title", { app });
  const description = t("description");
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: app,
      title,
      description,
      locale: locale === "ar" ? "ar_LB" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_LB"],
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function MarketingHome() {
  const [t, app, plans, contact, showcase] = await Promise.all([
    getTranslations("marketing"),
    appName(),
    listPlans(),
    marketingContact(),
    getShowcaseData(),
  ]);
  const publicPlans: PublicPlan[] = plans
    .filter((p) => p.active)
    .map(({ id, name, priceUsdCents, maxStaff }) => ({ id, name, priceUsdCents, maxStaff }));

  const { whatsapp, email } = contact;
  const demo = demoHref(contact, t("demoMessage", { app }));
  const whatsappHref = whatsapp ? waLink(whatsapp, t("demoMessage", { app })) : null;

  return (
    <div id="top" className="flex min-h-svh flex-col">
      <SiteHeader appName={app} demo={demo} />
      <main className="flex-1">
        <Hero demo={demo} showcase={showcase} />
        <DayFeatures showcase={showcase} />
        <LocalStrip />
        <Pricing plans={publicPlans} demo={demo} />
        <Faq />
      </main>
      <SiteFooter appName={app} demo={demo} whatsapp={whatsapp} whatsappHref={whatsappHref} email={email} />
    </div>
  );
}
