import "server-only";
import { prisma } from "@/lib/db";

/** Compact price row for client lists (quote, price list, intake chips). */
export type PriceRow = { id: string; modelId: string | null; device: string | null; service: string; usdCents: number };

/** The shop's whole price list: "any model" prices first, then by device and service. */
export async function listPrices(shopId: string): Promise<PriceRow[]> {
  const rows = await prisma.repairPrice.findMany({
    where: { shopId },
    select: { id: true, deviceModelId: true, service: true, priceUsdCents: true, deviceModel: { select: { name: true, brand: { select: { name: true } } } } },
    take: 3000,
  });
  return rows
    .map((r) => ({
      id: r.id,
      modelId: r.deviceModelId,
      device: r.deviceModel ? `${r.deviceModel.brand.name} ${r.deviceModel.name}` : null,
      service: r.service,
      usdCents: r.priceUsdCents,
    }))
    .sort((a, b) => (a.device ?? "").localeCompare(b.device ?? "", "en", { numeric: true }) || a.service.localeCompare(b.service));
}
