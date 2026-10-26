import "server-only";
import { ticketBalance } from "@/features/tickets/money";
import { deviceName, ticketAccessWhere } from "@/features/tickets/queries";
import type { ShopContext } from "@/lib/tenant";
import { daysWaiting, dueStage, storageFee } from "./rules";

/** Phones that are Ready but not picked up yet, longest wait first. */
export async function listUncollected(ctx: ShopContext) {
  const tickets = await ctx.db.ticket.findMany({
    where: { AND: [{ status: "READY" }, ticketAccessWhere(ctx.user)] },
    select: {
      id: true,
      number: true,
      updatedAt: true,
      estimateUsdCents: true,
      totalUsdCents: true,
      pickupReminders: true,
      pickupRemindedAt: true,
      storageItemId: true,
      trackToken: true,
      brandText: true,
      modelText: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
      customer: { select: { id: true, name: true, phone: true, locale: true } },
      _count: { select: { items: true } },
      payments: { select: { usdCentsEquivalent: true } },
      saleItems: { where: { sale: { status: "COMPLETED" } }, select: { qty: true, unitPriceUsdCents: true, discountUsdCents: true } },
      statusLogs: { where: { to: "READY" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
    take: 500,
  });
  const storageIds = tickets.map((t) => t.storageItemId).filter((id): id is string => !!id);
  const storageItems = storageIds.length
    ? await ctx.db.ticketItem.findMany({ where: { id: { in: storageIds } }, select: { id: true, qty: true, unitPriceUsdCents: true } })
    : [];
  const charged = new Map(storageItems.map((i) => [i.id, i.qty * i.unitPriceUsdCents]));
  const now = new Date();
  const { storageFreeDays, storageFeeUsdCents } = ctx.shop;

  return tickets
    .map((t) => {
      const readyAt = t.statusLogs[0]?.createdAt ?? t.updatedAt;
      const days = daysWaiting(readyAt, now);
      return {
        id: t.id,
        number: t.number,
        device: deviceName(t),
        customer: t.customer,
        trackToken: t.trackToken,
        readyAt,
        days,
        balanceUsdCents: Math.max(0, ticketBalance(t)),
        remindersSent: t.pickupReminders,
        remindedAt: t.pickupRemindedAt,
        dueStage: dueStage(days),
        storageDueUsdCents: storageFee(days, storageFreeDays, storageFeeUsdCents),
        storageChargedUsdCents: (t.storageItemId && charged.get(t.storageItemId)) || 0,
      };
    })
    .sort((a, b) => b.days - a.days);
}
export type UncollectedTicket = Awaited<ReturnType<typeof listUncollected>>[number];
