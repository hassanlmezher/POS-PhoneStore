import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getRequestSlug, getShopBySlug } from "@/lib/tenant";
import { LOCALE_COOKIE, defaultLocale, isLocale } from "./config";

// Locale comes from a cookie (no /ar URL prefix; URLs are already per-subdomain).
// An explicit locale (e.g. getTranslations({ locale }) on print pages) wins over the cookie.
// Dates are shown in the shop's own time zone (Shop.timezone); UTC outside a shop (landing, admin).
export default getRequestConfig(async ({ locale: requested }) => {
  const value = isLocale(requested) ? requested : (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  const slug = await getRequestSlug();
  const shop = slug ? await getShopBySlug(slug) : null;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: shop?.timezone ?? "UTC",
  };
});
