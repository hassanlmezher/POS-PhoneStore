import { prisma } from "@/lib/db";
import { dayKey, dayRange } from "@/lib/dates";
import { formatTicketNumber } from "@/lib/numbering";
import { requirePermission } from "@/lib/tenant";
import { centsToDecimal, toCsv } from "@/features/reports/csv";
import { bestSellers, outstandingBalances, revenueByTechnician, salesByDay } from "@/features/reports/queries";

// CSV export: /reports/export?type=sales|technicians|products|balances|expenses&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { shop } = await requirePermission(slug, "reports");
  const url = new URL(req.url);
  const range = dayRange(shop.timezone, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const type = url.searchParams.get("type");

  let csv: string;
  switch (type) {
    case "sales": {
      const days = await salesByDay(shop.id, range);
      csv = toCsv(
        ["date", "counter_sales", "product_revenue_usd", "product_cost_usd", "repair_takings_usd", "total_takings_usd"],
        days.map((d) => [
          d.day,
          d.salesCount,
          centsToDecimal(d.productRevenue),
          centsToDecimal(d.productCost),
          centsToDecimal(d.repairTakings),
          centsToDecimal(d.takings),
        ]),
      );
      break;
    }
    case "technicians": {
      const rows = await revenueByTechnician(shop.id, range);
      csv = toCsv(
        ["technician", "repairs", "charged_usd", "parts_cost_usd", "labor_usd", "profit_usd"],
        rows.map((r) => [
          r.name ?? "-",
          r.repairs,
          centsToDecimal(r.chargeUsdCents),
          centsToDecimal(r.partsCostUsdCents),
          centsToDecimal(r.laborUsdCents),
          centsToDecimal(r.profitUsdCents),
        ]),
      );
      break;
    }
    case "products": {
      const rows = await bestSellers(shop.id, range, 1000);
      csv = toCsv(
        ["product", "sku", "qty", "revenue_usd", "cost_usd", "profit_usd"],
        rows.map((r) => [
          r.name,
          r.sku,
          r.qty,
          centsToDecimal(r.revenueUsdCents),
          centsToDecimal(r.costUsdCents),
          centsToDecimal(r.profitUsdCents),
        ]),
      );
      break;
    }
    case "expenses": {
      const rows = await prisma.expense.findMany({
        where: { shopId: shop.id, spentAt: { gte: range.start, lt: range.end } },
        orderBy: { spentAt: "asc" },
        select: { spentAt: true, category: true, note: true, currency: true, amount: true, usdCentsEquivalent: true, cashMovementId: true },
      });
      csv = toCsv(
        ["date", "category", "note", "currency", "amount", "usd_equivalent", "from_drawer"],
        rows.map((r) => [
          dayKey(r.spentAt, shop.timezone),
          r.category.toLowerCase(),
          r.note,
          r.currency,
          r.currency === "USD" ? centsToDecimal(r.amount) : r.amount,
          centsToDecimal(r.usdCentsEquivalent),
          r.cashMovementId ? "yes" : "no",
        ]),
      );
      break;
    }
    case "balances": {
      const { rows } = await outstandingBalances(shop.id);
      csv = toCsv(
        ["customer", "phone", "owed_usd", "due_on_pickup_usd", "tickets", "sales"],
        rows.map((r) => [
          r.name,
          r.phone,
          centsToDecimal(r.owedUsdCents),
          centsToDecimal(r.dueOnPickupUsdCents),
          r.tickets.map((t) => formatTicketNumber(shop.ticketPrefix, t.number)).join(" "),
          r.sales.map((s) => `#${s.number}`).join(" "),
        ]),
      );
      break;
    }
    default:
      return new Response("Unknown report type", { status: 400 });
  }

  const name = type === "balances" ? `${shop.slug}-balances.csv` : `${shop.slug}-${type}-${range.from}-to-${range.to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
