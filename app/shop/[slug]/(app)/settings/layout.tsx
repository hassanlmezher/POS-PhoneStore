import { requirePermission } from "@/lib/tenant";

// Permission check in the layout so a refused user gets a real 404 before any loading UI streams.
export default async function Layout({ children, params }: LayoutProps<"/shop/[slug]/settings">) {
  const { slug } = await params;
  await requirePermission(slug, "settings");
  return children;
}
