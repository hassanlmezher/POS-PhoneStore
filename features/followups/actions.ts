"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { ticketAccessWhere } from "@/features/tickets/queries";

/** Records that the 3-day check message was sent (the wa.me link opens in the browser). */
export async function markCheckSent(ticketId: string): Promise<{ ok: boolean }> {
  const ctx = await requireActionShop("tickets.status");
  if (!z.string().min(1).max(64).safeParse(ticketId).success) return { ok: false };
  const res = await prisma.ticket.updateMany({
    where: { AND: [{ id: ticketId, shopId: ctx.shop.id, status: "PICKED_UP" }, ticketAccessWhere(ctx.user)] },
    data: { checkSentAt: new Date() },
  });
  if (res.count) refreshShop();
  return { ok: res.count > 0 };
}
