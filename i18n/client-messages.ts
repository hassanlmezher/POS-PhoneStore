import "server-only";
import type { AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";

// Messages sent to the browser, per area. Passing everything put all ~60 KB of both apps' text
// into every page's HTML (and cost server time to serialize it); server components still read
// the full set through getTranslations(). Add a namespace here when a client component in that
// area starts using it (a missing one logs MISSING_MESSAGE and shows the key).
const BASE = ["common", "errors", "auth"];
const AREAS = {
  base: BASE,
  shop: [
    ...BASE,
    "nav", "roles", "search", "pattern", "status", "ticket", "tickets", "intake", "accessories", "pos", "cash",
    "inventory", "product", "productTypes", "movementReasons", "customers", "sales", "reports", "settings",
    "templates", "paymentMethods", "stock", "warranty", "dashboard", "approval", "pickup", "expenses", "prices", "followups", "comebacks", "checkin", "partOrders", "suppliers", "installments", "unpaidWarning",
  ],
  track: [...BASE, "track", "status"],
  approve: [...BASE, "approval"],
} as const;

export async function clientMessages(area: keyof typeof AREAS | "all"): Promise<AbstractIntlMessages> {
  const all = await getMessages();
  if (area === "all") return all;
  return Object.fromEntries(AREAS[area].filter((ns) => ns in all).map((ns) => [ns, all[ns]]));
}
