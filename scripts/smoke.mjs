// End-to-end smoke test against a running server (dev or prod): logs in as each role through the
// real auth API, loads every page and checks status codes + permissions. Every page renders from
// the database, so this also proves the app is wired to it.
//   node scripts/smoke.mjs [baseHost=localhost:3000]
// Env: SMOKE_PASSWORD (required) for the temporary accounts from scripts/test-accounts.ts;
//   SMOKE_VIA=http://127.0.0.1:3100 to hit a production server directly with the headers Cloudflare
//   sends (Host, X-Forwarded-Host/Proto=https); SMOKE_ADMIN_SUB (default "admin").
const BASE = process.argv[2] ?? "localhost:3000";
const PASSWORD = process.env.SMOKE_PASSWORD;
if (!PASSWORD) throw new Error("Set SMOKE_PASSWORD (see scripts/test-accounts.ts)");
const VIA = process.env.SMOKE_VIA ?? "";
const shopHost = `demo.${BASE}`;
const adminHost = `${process.env.SMOKE_ADMIN_SUB ?? "admin"}.${BASE}`;
const proto = VIA ? "https" : "http";
const target = (host, path) => (VIA ? `${VIA}${path}` : `http://${host}${path}`);
const hostHeaders = (host) => (VIA ? { host, "x-forwarded-host": host, "x-forwarded-proto": "https" } : {});

// fetch() ignores a custom Host header, so requests go through node:http (no redirects followed).
import http from "node:http";
function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const setCookie = [res.headers["set-cookie"] ?? []].flat();
        resolve({ status: res.statusCode, text: async () => data, headers: { getSetCookie: () => setCookie } });
      });
    });
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error(`timeout ${url}`)));
    if (body) req.write(body);
    req.end();
  });
}

let failures = 0;
const results = [];

async function login(host, email, attempt = 0) {
  const res = await request(target(host, "/api/auth/sign-in/email"), {
    method: "POST",
    headers: { ...hostHeaders(host), "content-type": "application/json", origin: `${proto}://${host}` },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  // Production rate-limits sign-ins per IP (Better Auth): wait for the window and retry.
  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 11000));
    return login(host, email, attempt + 1);
  }
  if (res.status !== 200 || !cookie) throw new Error(`login ${email} failed: ${res.status}`);
  return cookie;
}

async function check(label, host, path, cookie, expect) {
  const res = await request(target(host, path), { headers: { host, ...hostHeaders(host), ...(cookie && { cookie }) } });
  const body = res.status === 200 ? await res.text() : "";
  // A 200 page that rendered Next's error boundary still counts as a failure.
  const crashed = /Application error|Unhandled Runtime Error|NEXT_HTTP_ERROR/.test(body);
  const ok = (Array.isArray(expect) ? expect : [expect]).includes(res.status) && !crashed;
  if (!ok) failures++;
  results.push(`${ok ? "ok  " : "FAIL"} ${String(res.status).padEnd(3)} ${label.padEnd(9)} ${host}${path}${crashed ? "  (error page)" : ""}`);
  return { status: res.status, body };
}

async function firstMatch(host, path, cookie, re) {
  const res = await request(target(host, path), { headers: { host, ...hostHeaders(host), cookie } });
  return (await res.text()).match(re)?.[1] ?? null;
}

const owner = await login(shopHost, "smoke-owner@test.invalid");
const tech = await login(shopHost, "smoke-tech@test.invalid");
const cashier = await login(shopHost, "smoke-cashier@test.invalid");
const admin = await login(adminHost, "smoke-admin@test.invalid");

// Discover real ids/numbers from the database through the pages themselves.
const ticket = await firstMatch(shopHost, "/tickets?view=table", owner, /href="\/tickets\/(\d+)"/);
const sale = await firstMatch(shopHost, "/sales", owner, /href="\/sales\/(\d+)"/);
const customer = await firstMatch(shopHost, "/customers", owner, /href="\/customers\/([a-z0-9]+)"/);
const product = await firstMatch(shopHost, "/inventory", owner, /href="\/inventory\/([a-z0-9]+)"/);
const session = await firstMatch(shopHost, "/cash?tab=history", owner, /href="\/cash\/([a-z0-9]+)"/);
const tenant = await firstMatch(adminHost, "/", admin, /href="\/tenants\/([a-z0-9]+)"/);

const ownerPages = [
  "/", "/tickets", "/tickets?view=table", "/tickets/new", `/tickets/${ticket}`,
  "/customers", `/customers/${customer}`, "/pos", "/sales", `/sales/${sale}`,
  "/inventory", "/inventory?tab=low", `/inventory/${product}`, "/cash", "/cash?tab=history",
  ...(session ? [`/cash/${session}`] : []),
  "/reports", "/reports?tab=repairs", "/reports?tab=products", "/reports?tab=balances", "/expenses", "/expenses?from=2026-09-01&to=2026-09-30", "/prices", "/tickets/followups", "/tickets/parts", "/tickets/parts?view=arrived", "/suppliers",
  "/settings", "/settings?tab=receipts", "/settings?tab=rate", "/settings?tab=messages", "/settings?tab=staff",
  "/settings?tab=quickPicks",
  `/print/ticket/${ticket}?size=80mm`, `/print/ticket/${ticket}?size=a4&lang=ar`, `/print/sale/${sale}`,
  `/print/labels?ids=${product}`,
  "/reports/export?type=sales", "/reports/export?type=technicians", "/reports/export?type=products", "/reports/export?type=balances", "/reports/export?type=expenses",
];
for (const p of ownerPages) await check("owner", shopHost, p, owner, 200);

// Cashier: POS/cash/sales yes; reports/settings no.
for (const p of ["/", "/pos", "/sales", "/cash", "/tickets", "/customers", "/inventory", "/prices"]) await check("cashier", shopHost, p, cashier, 200);
for (const p of ["/reports", "/settings", "/expenses", "/suppliers", "/reports/export?type=sales"]) await check("cashier", shopHost, p, cashier, 404);

// Technician: repairs yes; money pages no.
for (const p of ["/", "/tickets", "/customers", "/inventory", "/prices", "/tickets/followups", "/tickets/parts"]) await check("tech", shopHost, p, tech, 200);
for (const p of ["/pos", "/cash", "/sales", "/reports", "/expenses", "/suppliers", "/settings"]) await check("tech", shopHost, p, tech, 404);

// Public + logged out.
if (!VIA) await check("public", BASE, "/", null, 200); // on the live domain the root is another site
await check("public", shopHost, "/track", null, 200);
await check("public", shopHost, "/files/logo", null, [200, 404]);
await check("anon", shopHost, "/", null, 307);
await check("anon", shopHost, "/login", null, 200);
await check("anon", shopHost, "/shop/other/login", null, 404);
await check("anon", `nope.${BASE}`, "/login", null, 404);

// Super admin.
for (const p of ["/", "/plans", "/platform", ...(tenant ? [`/tenants/${tenant}`] : [])]) await check("admin", adminHost, p, admin, 200);
await check("owner", adminHost, "/", owner, 307);

console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} passed`);
process.exit(failures ? 1 : 0);
