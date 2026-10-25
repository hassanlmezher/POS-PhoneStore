import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * redirect() for pages reached through the subdomain rewrite. Next would resolve a relative path
 * against the server's bind address (e.g. http://0.0.0.0:3000/login behind Caddy), so build the
 * absolute URL from the public host the browser used (X-Forwarded-* from Caddy, else Host).
 */
export async function redirectPublic(path: string): Promise<never> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host");
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
  redirect(host ? `${proto}://${host}${path}` : path);
}
