"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { formatTicketNumber, parseTicketNumber } from "@/lib/numbering";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestSlug, getShopBySlug } from "@/lib/tenant";
import { ticketBalance, warrantyUntil } from "@/features/tickets/money";
import { deviceName } from "@/features/tickets/queries";

export type TrackResult =
  | {
      ok: true;
      ticket: {
        label: string;
        status: string;
        device: string;
        receivedAt: Date;
        promisedAt: Date | null;
        pickedUpAt: Date | null;
        warrantyUntil: Date | null;
        balanceUsdCents: number;
        /** Status changes only: no staff names, notes or prices. */
        timeline: { status: string; at: Date }[];
      };
    }
  | { ok: false; error: "invalid" | "notFound" | "rateLimited"; retryAfterSec?: number };

/**
 * Public repair status lookup (no login). Needs the ticket number AND the last 6+ digits of
 * the customer's phone; both wrong or right give the same "not found" so numbers can't be probed.
 * Rate-limited per IP and shop.
 */
export async function lookupTicket(_prev: TrackResult | undefined, formData: FormData): Promise<TrackResult> {
  const slug = await getRequestSlug();
  const shop = slug ? await getShopBySlug(slug) : null;
  if (!shop) return { ok: false, error: "notFound" };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const limit = rateLimit(`track:${shop.id}:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.ok) return { ok: false, error: "rateLimited", retryAfterSec: limit.retryAfterSec };

  const number = parseTicketNumber(String(formData.get("ticket") ?? ""));
  const digits = String(formData.get("phone") ?? "").replace(/\D/g, "");
  if (number === null || digits.length < 6) return { ok: false, error: "invalid" };
  const tail = digits.slice(-8).replace(/^0+/, ""); // "03 123 456" → "3123456"

  const t = await prisma.ticket.findFirst({
    where: { shopId: shop.id, number, customer: { phone: { endsWith: tail } } },
    select: {
      number: true,
      status: true,
      createdAt: true,
      promisedAt: true,
      pickedUpAt: true,
      warrantyDays: true,
      estimateUsdCents: true,
      totalUsdCents: true,
      brandText: true,
      modelText: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
      _count: { select: { items: true } },
      payments: { select: { usdCentsEquivalent: true } },
      saleItems: {
        where: { sale: { status: "COMPLETED" } },
        select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true },
      },
      statusLogs: { select: { to: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) return { ok: false, error: "notFound" };

  return {
    ok: true,
    ticket: {
      label: formatTicketNumber(shop.ticketPrefix, t.number),
      status: t.status,
      device: deviceName(t),
      receivedAt: t.createdAt,
      promisedAt: t.promisedAt,
      pickedUpAt: t.pickedUpAt,
      warrantyUntil: warrantyUntil(t),
      balanceUsdCents: Math.max(0, ticketBalance(t)),
      timeline: t.statusLogs.map((l) => ({ status: l.to, at: l.createdAt })),
    },
  };
}
