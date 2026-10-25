import "server-only";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma, tenantDb } from "@/lib/db";
import { DEV_SHOP_COOKIE, parseHost } from "@/lib/hosts";
import { redirectPublic } from "@/lib/public-url";
import { can, type Permission, type Role } from "@/lib/permissions";
import { isReadOnly } from "@/lib/subscription";

export const getShopBySlug = cache(async (slug: string) => {
  return prisma.shop.findUnique({ where: { slug } });
});

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type ShopContext = Awaited<ReturnType<typeof requireShop>>;

/**
 * Resolve the shop for this request and ensure the signed-in user belongs to it.
 * `slug` comes from the internal rewrite (derived from the Host header), never from user input.
 */
export const requireShop = cache(async (slug: string) => {
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const session = await getSession();
  const user = session?.user;
  if (!user || user.shopId !== shop.id || user.active === false) return redirectPublic("/login");

  const readOnly = isReadOnly(shop);

  return {
    shop,
    user: { id: user.id, name: user.name, email: user.email, role: user.role as Role },
    db: tenantDb(shop.id),
    readOnly,
  };
});

/** Like requireShop, but also checks a permission. Use at the top of pages and server actions. */
export async function requirePermission(slug: string, permission: Permission) {
  const ctx = await requireShop(slug);
  if (!can(ctx.user.role, permission)) notFound();
  return ctx;
}

/** Shop slug for the current request, from the Host header (or the dev `?shop=` cookie). */
export async function getRequestSlug(): Promise<string | null> {
  const host = parseHost((await headers()).get("host"));
  if (host.kind === "shop") return host.slug;
  if (host.kind === "root" && process.env.NODE_ENV !== "production") {
    return (await cookies()).get(DEV_SHOP_COOKIE)?.value ?? null;
  }
  return null;
}

/**
 * For server actions: resolves the shop from the request host (never from client input),
 * checks membership, optional permission, and refuses writes on read-only shops.
 */
export async function requireActionShop(permission?: Permission, opts: { write?: boolean } = { write: true }) {
  const slug = await getRequestSlug();
  if (!slug) throw new Error("No shop for this request");
  const ctx = await requireShop(slug);
  if (permission && !can(ctx.user.role, permission)) throw new Error("Forbidden");
  if (opts.write !== false && ctx.readOnly) throw new Error("Shop is read-only");
  return ctx;
}

export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.user?.isSuperAdmin) return redirectPublic("/login");
  return session.user;
}

/**
 * Invalidate cached shop pages after a mutation. Public paths (/tickets) differ from the
 * internal route (/shop/[slug]/tickets), so we revalidate the whole tree; pages are dynamic anyway.
 */
export function refreshShop() {
  revalidatePath("/", "layout");
}
