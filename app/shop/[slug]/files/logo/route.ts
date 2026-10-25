import { getShopBySlug } from "@/lib/tenant";
import { readShopLogo } from "@/lib/uploads";

// Public: the logo appears on receipts and the customer status page.
// URLs carry ?v=<version>, so the response can be cached for a long time.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) return new Response(null, { status: 404 });
  const logo = await readShopLogo(shop.id);
  if (!logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
