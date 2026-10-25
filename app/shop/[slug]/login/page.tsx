import { notFound } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
import { getSession, getShopBySlug } from "@/lib/tenant";
import { redirectPublic } from "@/lib/public-url";

export default async function ShopLoginPage({ params }: PageProps<"/shop/[slug]/login">) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const session = await getSession();
  if (session?.user.shopId === shop.id) await redirectPublic("/");
  return <LoginForm variant="shop" shopName={shop.name} slug={slug} />;
}
