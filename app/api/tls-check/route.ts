import { prisma } from "@/lib/db";
import { parseHost } from "@/lib/hosts";

// Caddy "on-demand TLS" asks this endpoint before issuing a certificate for a hostname,
// so certificates are only requested for our own domains and existing shops.
// GET /api/tls-check?domain=fixit.example.com → 200 (allowed) | 404
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain")?.toLowerCase() ?? "";
  // Production hosts have no port; parseHost compares against ROOT_DOMAIN.
  const host = parseHost(domain);
  if (host.kind === "root" || host.kind === "admin") return new Response("ok");
  if (host.kind === "shop") {
    const shop = await prisma.shop.findUnique({ where: { slug: host.slug }, select: { id: true } });
    if (shop) return new Response("ok");
  }
  return new Response("unknown", { status: 404 });
}
