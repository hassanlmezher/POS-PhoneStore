import "server-only";
import { deviceName, ticketAccessWhere } from "@/features/tickets/queries";
import type { ShopContext } from "@/lib/tenant";
import { CHECK_AFTER_DAYS, daysSince, FOLLOWUP_WINDOW_DAYS } from "./rules";

const select = {
  id: true,
  number: true,
  pickedUpAt: true,
  warrantyDays: true,
  reviewAskedAt: true,
  checkSentAt: true,
  brandText: true,
  modelText: true,
  deviceModel: { select: { name: true, brand: { select: { name: true } } } },
  customer: { select: { name: true, phone: true, locale: true } },
} as const;

/** Phones picked up in the last 30 days that still need a review request or the 3-day check. */
export async function listFollowups(ctx: ShopContext) {
  const now = new Date();
  const since = new Date(now.getTime() - FOLLOWUP_WINDOW_DAYS * 86_400_000);
  const rows = await ctx.db.ticket.findMany({
    where: {
      AND: [
        { status: "PICKED_UP", pickedUpAt: { gte: since } },
        { OR: [{ reviewAskedAt: null }, { checkSentAt: null }] },
        ticketAccessWhere(ctx.user),
      ],
    },
    select,
    orderBy: { pickedUpAt: "desc" },
    take: 500,
  });
  const list = rows.map((r) => ({ ...r, device: deviceName(r), days: daysSince(r.pickedUpAt ?? now, now) }));
  return {
    review: list.filter((r) => !r.reviewAskedAt),
    check: list.filter((r) => !r.checkSentAt && r.days >= CHECK_AFTER_DAYS).sort((a, b) => b.days - a.days),
  };
}
export type FollowupTicket = Awaited<ReturnType<typeof listFollowups>>["review"][number];

/** Count for the Repairs page button. */
export async function countFollowups(ctx: ShopContext) {
  const { review, check } = await listFollowups(ctx);
  return new Set([...review, ...check].map((r) => r.id)).size;
}
