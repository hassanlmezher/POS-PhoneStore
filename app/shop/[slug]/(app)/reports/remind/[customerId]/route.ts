import { outstandingBalances } from "@/features/reports/queries";
import { balanceReminderLink } from "@/features/reports/reminder";
import { requirePermission } from "@/lib/tenant";

// Balance reminder: /reports/remind/<customerId> → redirects to the prefilled wa.me message. Built on
// click so the balances list doesn't carry a long WhatsApp link (twice: HTML + page data) per customer.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; customerId: string }> }) {
  const { slug, customerId } = await params;
  const { shop, db } = await requirePermission(slug, "reports");
  const [{ rows }, templates] = await Promise.all([
    outstandingBalances(shop.id),
    db.messageTemplate.findMany({ where: { key: "BALANCE_REMINDER" }, select: { locale: true, body: true } }),
  ]);
  const row = rows.find((r) => r.customerId === customerId);
  const link = row && balanceReminderLink(shop, row, templates);
  if (!link) return new Response("Not found", { status: 404 });
  return Response.redirect(link, 302);
}
