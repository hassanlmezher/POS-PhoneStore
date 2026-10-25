import "server-only";
import { ROOT_DOMAIN } from "@/lib/hosts";

// Automatic web address per shop (<slug>.ROOT_DOMAIN) when hosted on Vercel with DNS on Cloudflare:
//   1. Vercel: add the hostname to the project (Vercel then issues its HTTPS certificate).
//   2. Cloudflare: add "CNAME <slug> → cname.vercel-dns.com", DNS only.
// Needs VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID (optional), CLOUDFLARE_API_TOKEN (Zone → DNS → Edit
// on the domain) and CLOUDFLARE_ZONE_ID. Without them (local dev, Docker) everything is skipped.

const VERCEL_TARGET = "cname.vercel-dns.com";
const MARK = "InChouf POS shop (auto)";

export type DomainResult = { status: "ok" | "skipped" | "error"; detail?: string };
export type DomainStatus = {
  host: string;
  configured: boolean;
  vercel: "ok" | "missing" | "pending" | "unknown";
  dns: "ok" | "missing" | "conflict" | "unknown";
  /** The address answers from this app (checked from the server, so not affected by a browser's DNS cache). */
  live: boolean;
};

function env() {
  const vercelToken = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  // Never for local hosts (localhost, *.localhost, ports).
  const realDomain = !ROOT_DOMAIN.includes(":") && !ROOT_DOMAIN.includes("localhost");
  const configured = !!(vercelToken && projectId && cfToken && zoneId && realDomain);
  return { configured, vercelToken, projectId, teamId, cfToken, zoneId };
}

export function domainsConfigured() {
  return env().configured;
}

const hostFor = (slug: string) => `${slug}.${ROOT_DOMAIN}`;

async function vercel(path: string, init: RequestInit = {}) {
  const e = env();
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.vercel.com${path}${e.teamId ? `${sep}teamId=${e.teamId}` : ""}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${e.vercelToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { code?: string; message?: string } };
  return { status: res.status, body };
}

async function cloudflare(path: string, init: RequestInit = {}) {
  const e = env();
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${e.zoneId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${e.cfToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  return (await res.json().catch(() => ({ success: false }))) as {
    success: boolean;
    result?: Array<{ id: string; type: string; content: string; comment?: string | null }> & { id?: string };
    errors?: { message: string }[];
  };
}

/** Sets up <slug>.ROOT_DOMAIN on Vercel + Cloudflare. Safe to call again (idempotent). */
export async function provisionShopDomain(slug: string): Promise<DomainResult> {
  const e = env();
  if (!e.configured) return { status: "skipped" };
  const host = hostFor(slug);
  try {
    const v = await vercel(`/v10/projects/${e.projectId}/domains`, { method: "POST", body: JSON.stringify({ name: host }) });
    const alreadyOurs = v.status === 409 && /already/i.test(v.body.error?.message ?? "") && v.body.error?.code !== "domain_already_in_use";
    if (v.status >= 300 && !alreadyOurs) {
      return { status: "error", detail: `Vercel: ${v.body.error?.message ?? v.status}` };
    }

    const existing = await cloudflare(`/dns_records?name=${encodeURIComponent(host)}`);
    if (!existing.success) return { status: "error", detail: `Cloudflare: ${existing.errors?.[0]?.message ?? "request failed"}` };
    const records = existing.result ?? [];
    if (records.length === 0) {
      const created = await cloudflare(`/dns_records`, {
        method: "POST",
        body: JSON.stringify({ type: "CNAME", name: host, content: VERCEL_TARGET, proxied: false, ttl: 1, comment: MARK }),
      });
      if (!created.success) return { status: "error", detail: `Cloudflare: ${created.errors?.[0]?.message ?? "create failed"}` };
    } else if (!records.some((r) => r.type === "CNAME" && r.content === VERCEL_TARGET)) {
      // Never overwrite a record someone else made (another site may use this name).
      return { status: "error", detail: `Cloudflare: ${host} already has a different DNS record` };
    }
    return { status: "ok" };
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Removes the shop's hostname from Vercel and deletes the DNS record we created (only ours). */
export async function removeShopDomain(slug: string): Promise<DomainResult> {
  const e = env();
  if (!e.configured) return { status: "skipped" };
  const host = hostFor(slug);
  try {
    await vercel(`/v9/projects/${e.projectId}/domains/${host}`, { method: "DELETE" });
    const existing = await cloudflare(`/dns_records?name=${encodeURIComponent(host)}`);
    for (const r of existing.result ?? []) {
      if (r.type === "CNAME" && r.content === VERCEL_TARGET && r.comment === MARK) {
        await cloudflare(`/dns_records/${r.id}`, { method: "DELETE" });
      }
    }
    return { status: "ok" };
  } catch (err) {
    return { status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Current state of a shop's web address, for the admin panel. */
export async function shopDomainStatus(slug: string): Promise<DomainStatus> {
  const e = env();
  const host = hostFor(slug);
  if (!e.configured) return { host, configured: false, vercel: "unknown", dns: "unknown", live: false };
  const [v, c, live] = await Promise.all([
    vercel(`/v9/projects/${e.projectId}/domains/${host}`).catch(() => null),
    cloudflare(`/dns_records?name=${encodeURIComponent(host)}`).catch(() => null),
    isLive(host),
  ]);
  const vercelState: DomainStatus["vercel"] = !v ? "unknown" : v.status === 404 ? "missing" : v.body.verified === false ? "pending" : v.status < 300 ? "ok" : "unknown";
  const records = c?.result ?? [];
  const dns: DomainStatus["dns"] = !c?.success
    ? "unknown"
    : records.length === 0
      ? "missing"
      : records.some((r) => r.type === "CNAME" && r.content === VERCEL_TARGET)
        ? "ok"
        : "conflict";
  return { host, configured: true, vercel: vercelState, dns, live };
}

/** True when https://host answers from Vercel (our app), not from another site via the wildcard. */
async function isLive(host: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${host}/login`, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(6000) });
    return res.headers.has("x-vercel-id") && res.status < 500;
  } catch {
    return false; // DNS not there yet, or HTTPS certificate still being issued
  }
}
