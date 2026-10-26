"use server";

import { headers } from "next/headers";
import { parseTicketNumber } from "@/lib/numbering";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestSlug, getShopBySlug } from "@/lib/tenant";
import { findTrackTicket, type TrackTicket } from "./queries";

export type TrackResult =
  | { ok: true; ticket: TrackTicket }
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

  const ticket = await findTrackTicket(shop.ticketPrefix, { shopId: shop.id, number, customer: { phone: { endsWith: tail } } });
  if (!ticket) return { ok: false, error: "notFound" };
  return { ok: true, ticket };
}
