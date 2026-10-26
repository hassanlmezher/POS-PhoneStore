import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_HEADER, isLocale } from "@/i18n/config";
import {
  ADMIN_PATH,
  DEV_SHOP_COOKIE,
  SHOP_PATH,
  TENANT_HEADER,
  isValidSlug,
  parseHost,
  tenantHeaderValue,
  type HostKind,
} from "@/lib/hosts";

// Resolves the tenant from the Host header and rewrites to internal route groups:
//   <slug>.ROOT_DOMAIN/x  → /shop/<slug>/x
//   <ADMIN_SUBDOMAIN>.ROOT_DOMAIN/x → /admin/x  (default "admin")
//   ROOT_DOMAIN/x         → marketing (as is)
// Dev only: ROOT_DOMAIN/?shop=<slug> pins a shop via cookie (`?shop=` clears it).
// Random per server process, so clients can't forge it; incoming copies are overwritten above.
const REWRITE_HEADER = "x-pos-internal-rewrite";
const REWRITE_TOKEN = crypto.randomUUID();

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname } = url;
  const host = parseHost(req.headers.get("host"));

  // Behind Cloudflare/Caddy: send plain-http visitors to https (secure cookies need it). Done here
  // rather than with Cloudflare's zone-wide "Always Use HTTPS", which would also affect other sites.
  if (process.env.NODE_ENV === "production" && req.headers.get("x-forwarded-proto") === "http") {
    const secure = req.nextUrl.clone();
    secure.protocol = "https:";
    secure.host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? secure.host;
    secure.port = "";
    return NextResponse.redirect(secure, 308);
  }

  // Internal paths are never reachable directly. The production server runs the proxy a second
  // time on our own rewritten path; that pass carries REWRITE_HEADER with this process's token.
  if (isUnder(pathname, SHOP_PATH) || isUnder(pathname, ADMIN_PATH)) {
    return req.headers.get(REWRITE_HEADER) === REWRITE_TOKEN ? NextResponse.next() : notFound();
  }

  if (host.kind === "admin") {
    return rewriteTo(req, `${ADMIN_PATH}${pathname}`, host);
  }

  if (host.kind === "shop") return rewriteToShop(req, host.slug);

  if (host.kind === "root" && process.env.NODE_ENV !== "production") {
    const param = url.searchParams.get("shop");
    if (param !== null) {
      const clean = req.nextUrl.clone();
      clean.searchParams.delete("shop");
      const res = NextResponse.redirect(clean);
      if (param && isValidSlug(param)) res.cookies.set(DEV_SHOP_COOKIE, param, { path: "/" });
      else res.cookies.delete(DEV_SHOP_COOKIE);
      return res;
    }
    const pinned = req.cookies.get(DEV_SHOP_COOKIE)?.value;
    if (pinned && isValidSlug(pinned)) return rewriteToShop(req, pinned);
  }

  if (host.kind === "unknown") return notFound();
  if (req.headers.has(TENANT_HEADER)) {
    const headers = new Headers(req.headers);
    headers.delete(TENANT_HEADER);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

function notFound() {
  return new NextResponse(null, { status: 404 });
}


/** "/shop" or "/shop/…", but not "/shops". */
function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function rewriteToShop(req: NextRequest, slug: string) {
  return rewriteTo(req, `${SHOP_PATH}/${slug}${req.nextUrl.pathname}`, { kind: "shop", slug });
}

/** Internal rewrite (same origin as the app server, so Next never proxies it externally). */
function rewriteTo(req: NextRequest, pathname: string, tenant: HostKind) {
  const target = req.nextUrl.clone();
  target.pathname = pathname;
  // Behind Caddy, X-Forwarded-Proto makes nextUrl "https:", but the app server itself speaks plain
  // HTTP; a different protocol would make Next proxy the rewrite externally over TLS and fail.
  if (!process.env.VERCEL) target.protocol = "http:";
  const headers = new Headers(req.headers);
  headers.set(REWRITE_HEADER, REWRITE_TOKEN);
  headers.set(TENANT_HEADER, tenantHeaderValue(tenant)!);
  // ?lang=en|ar (links sent to customers) opens the page in that language and remembers it.
  headers.delete(LOCALE_HEADER);
  const lang = req.nextUrl.searchParams.get("lang");
  if (isLocale(lang)) headers.set(LOCALE_HEADER, lang);
  const res = NextResponse.rewrite(target, { request: { headers } });
  if (isLocale(lang)) res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

export const config = {
  // Skip Next internals, the auth API and static files.
  matcher: ["/((?!api/|_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
