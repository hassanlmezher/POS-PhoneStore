"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { ticketAccessWhere } from "@/features/tickets/queries";

const input = z.object({ ticketId: z.string().min(1).max(64), kind: z.enum(["review", "check"]) });

/** Records that the review request or the check message was sent (the wa.me link opens in the browser). */
export async function markFollowup(ticketId: string, kind: "review" | "check"): Promise<{ ok: boolean }> {
  const ctx = await requireActionShop("tickets.status");
  const parsed = input.safeParse({ ticketId, kind });
  if (!parsed.success) return { ok: false };
  const res = await prisma.ticket.updateMany({
    where: { AND: [{ id: ticketId, shopId: ctx.shop.id, status: "PICKED_UP" }, ticketAccessWhere(ctx.user)] },
    data: kind === "review" ? { reviewAskedAt: new Date() } : { checkSentAt: new Date() },
  });
  if (res.count) refreshShop();
  return { ok: res.count > 0 };
}
