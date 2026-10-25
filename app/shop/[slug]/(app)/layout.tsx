import { NextIntlClientProvider } from "next-intl";
import { AppShell } from "@/components/app-shell/app-shell";
import { clientMessages } from "@/i18n/client-messages";
import { requireShop } from "@/lib/tenant";

export default async function ShopAppLayout({ children, params }: LayoutProps<"/shop/[slug]">) {
  const { slug } = await params;
  const [{ shop, user, readOnly }, messages] = await Promise.all([requireShop(slug), clientMessages("shop")]);
  return (
    <NextIntlClientProvider messages={messages}>
      <AppShell
        shop={{ name: shop.name, logoUrl: shop.logoUrl, exchangeRate: shop.exchangeRate, countryCode: shop.countryCode }}
        user={{ name: user.name, email: user.email, role: user.role }}
        readOnly={readOnly}
      >
        {children}
      </AppShell>
    </NextIntlClientProvider>
  );
}
