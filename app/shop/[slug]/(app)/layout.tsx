import { AppShell } from "@/components/app-shell/app-shell";
import { requireShop } from "@/lib/tenant";

export default async function ShopAppLayout({ children, params }: LayoutProps<"/shop/[slug]">) {
  const { slug } = await params;
  const { shop, user, readOnly } = await requireShop(slug);
  return (
    <AppShell
      shop={{ name: shop.name, logoUrl: shop.logoUrl, exchangeRate: shop.exchangeRate, countryCode: shop.countryCode }}
      user={{ name: user.name, email: user.email, role: user.role }}
      readOnly={readOnly}
    >
      {children}
    </AppShell>
  );
}
