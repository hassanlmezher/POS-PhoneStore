import { BrandLogo } from "@/components/brand-logo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import { LanguageSwitch } from "@/components/app-shell/language-switch";
import { ShopMark } from "@/components/app-shell/shop-mark";
import { Button } from "@/components/ui/button";
import { TrackLookup } from "@/features/track/ui/track-lookup";
import { formatPhone, normalizePhone, waNumber } from "@/lib/phone";
import { getPlatformSettings } from "@/lib/platform";
import { getShopBySlug } from "@/lib/tenant";

// Public page (no login). Only uses getShopBySlug, so it keeps working for expired/suspended shops.
export async function generateMetadata({ params }: PageProps<"/shop/[slug]/track">): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  const t = await getTranslations("track");
  return { title: shop ? `${t("title")} · ${shop.name}` : t("title"), robots: { index: false } };
}

export default async function TrackPage({ params, searchParams }: PageProps<"/shop/[slug]/track">) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const [t, platform] = await Promise.all([getTranslations("track"), getPlatformSettings()]);

  const e164 = shop.phone ? normalizePhone(shop.phone, shop.countryCode) : null;
  const ticket = typeof sp.t === "string" ? sp.t.slice(0, 20) : "";

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-3 px-4">
          <ShopMark name={shop.name} logoUrl={shop.logoUrl} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{shop.name}</p>
            {shop.phone && (
              <a href={e164 ? `tel:${e164}` : undefined} className="block truncate text-xs text-muted-foreground hover:text-foreground">
                <bdi dir="ltr">{e164 ? formatPhone(e164, shop.countryCode) : shop.phone}</bdi>
              </a>
            )}
          </div>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <TrackLookup
          defaultTicket={ticket}
          rate={shop.exchangeRate}
          rounding={shop.lbpRounding}
          ticketPrefix={shop.ticketPrefix}
          countryCode={shop.countryCode}
        />

        {(e164 || shop.address) && (
          <section aria-label={t("contactTitle")} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:p-5">
            <h2 className="text-sm font-semibold">{t("contactTitle")}</h2>
            {shop.address && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {shop.address}
              </p>
            )}
            {e164 && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
                  <a href={`https://wa.me/${waNumber(e164)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    {t("whatsapp")}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`tel:${e164}`}>
                    <Phone />
                    {t("call")}
                  </a>
                </Button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="flex items-center justify-center gap-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-subtle-foreground">
        <BrandLogo className="size-5" />
        {t("poweredBy", { app: platform.appName })}
      </footer>
    </div>
  );
}
