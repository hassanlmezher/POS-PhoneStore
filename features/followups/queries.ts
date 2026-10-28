import "server-only";
import { deviceName, ticketAccessWhere } from "@/features/tickets/queries";
import type { ShopContext } from "@/lib/tenant";
import { CHECK_AFTER_DAYS, daysSince, FOLLOWUP_WINDOW_DAYS } from "./rules";

/** Phones picked up 3–30 days ago whose customer hasn't had the check message yet, oldest first. */
export async function listChecksDue(ctx: ShopContext) {
  const now = new Date();
  const rows = await ctx.db.ticket.findMany({
    where: {
      AND: [
        {
          status: "PICKED_UP",
          checkSentAt: null,
          pickedUpAt: { gte: new Date(now.getTime() - FOLLOWUP_WINDOW_DAYS * 86_400_000), lte: new Date(now.getTime() - CHECK_AFTER_DAYS * 86_400_000) },
        },
        ticketAccessWhere(ctx.user),
      ],
    },
    select: {
      id: true,
      number: true,
      pickedUpAt: true,
      warrantyDays: true,
      brandText: true,
      modelText: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
      customer: { select: { name: true, phone: true, locale: true } },
    },
    orderBy: { pickedUpAt: "asc" },
    take: 500,
  });
  return rows.map((r) => ({ ...r, device: deviceName(r), days: daysSince(r.pickedUpAt ?? now, now) }));
}

/** Count for the Repairs page button. */
export async function countChecksDue(ctx: ShopContext) {
  const now = new Date();
  return ctx.db.ticket.count({
    where: {
      AND: [
        {
          status: "PICKED_UP",
          checkSentAt: null,
          pickedUpAt: { gte: new Date(now.getTime() - FOLLOWUP_WINDOW_DAYS * 86_400_000), lte: new Date(now.getTime() - CHECK_AFTER_DAYS * 86_400_000) },
        },
        ticketAccessWhere(ctx.user),
      ],
    },
  });
}
