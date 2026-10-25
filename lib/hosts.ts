// Host parsing shared by proxy.ts and server code. No Node-only imports.

export const ROOT_DOMAIN = (process.env.ROOT_DOMAIN ?? "localhost:3000").toLowerCase();
export const SHOP_PATH = "/shop";
export const ADMIN_PATH = "/admin";
export const DEV_SHOP_COOKIE = "dev_shop";

/** Subdomain of the super admin panel (ADMIN_SUBDOMAIN, e.g. "pos-admin" when "admin." is used by another site). */
export const ADMIN_SUBDOMAIN = (process.env.ADMIN_SUBDOMAIN || "admin").toLowerCase();
const RESERVED = new Set(["www", "admin", ADMIN_SUBDOMAIN, "api", "app", "mail", "static"]);

export type HostKind =
  | { kind: "root" }
  | { kind: "admin" }
  | { kind: "shop"; slug: string }
  | { kind: "unknown" };

/** Classify a Host header. `<slug>.localhost:3000` works in dev without config. */
export function parseHost(rawHost: string | null): HostKind {
  const host = (rawHost ?? "").toLowerCase();
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return { kind: "root" };
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return { kind: "unknown" };
  const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
  if (sub === ADMIN_SUBDOMAIN) return { kind: "admin" };
  if (!isValidSlug(sub) || RESERVED.has(sub)) return { kind: "unknown" };
  return { kind: "shop", slug: sub };
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug);
}

/** Public origin of a shop, e.g. "https://demo.example.com" ("http://demo.localhost:3000" in dev). */
export function shopOrigin(slug: string): string {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${slug}.${ROOT_DOMAIN}`;
}

/** Slugs a new shop can't take (subdomains and paths the platform uses). */
export const RESERVED_SLUGS = ["www", "admin", ADMIN_SUBDOMAIN, "api", "app", "mail", "static", "shop", "track", "files", "login"];
