"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { lockRows } from "@/lib/locks";
import { formatMoney } from "@/lib/money";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { ticketAccessWhere } from "@/features/tickets/queries";
import { daysWaiting, PICKUP_STAGES, storageFee } from "./rules";

type Result = { ok: true } | { ok: false; error: "invalid" | "notFound" | "noFee" };

const idInput = z.string().min(1).max(64);

/** Records that pickup reminder `stage` (1–3) was sent. The wa.me link itself opens in the browser. */
export async function markPickupReminder(ticketId: string, stage: number): Promise<Result> {
  const ctx = await requireActionShop("tickets.status");
  if (!idInput.safeParse(ticketId).success || !Number.isInteger(stage) || stage < 1 || stage > PICKUP_STAGES.length) {
    return { ok: false, error: "invalid" };
  }
  const res = await prisma.ticket.updateMany({
    where: { AND: [{ id: ticketId, shopId: ctx.shop.id, status: "READY" }, ticketAccessWhere(ctx.user)] },
    data: { pickupReminders: stage, pickupRemindedAt: new Date() },
  });
  if (res.count === 0) return { ok: false, error: "notFound" };
  refreshShop();
  return { ok: true };
}

/**
 * Adds (or updates) the "storage fee" line for the days a ready phone waited past the free days.
 * A ticket priced only by its estimate first gets the estimate as a line, so the total stays right.
 */
export async function chargeStorageFee(ticketId: string): Promise<Result> {
  const ctx = await requireActionShop("tickets.items");
  if (!idInput.safeParse(ticketId).success) return { ok: false, error: "invalid" };
  const shopId = ctx.shop.id;
  const t = await getTranslations("pickup");

  return prisma.$transaction(async (tx): Promise<Result> => {
    await lockRows(tx, "Ticket", shopId, [ticketId]);
    const ticket = await tx.ticket.findFirst({
      where: { AND: [{ id: ticketId, shopId, status: "READY" }, ticketAccessWhere(ctx.user)] },
      select: {
        updatedAt: true,
        estimateUsdCents: true,
        storageItemId: true,
        _count: { select: { items: true } },
        statusLogs: { where: { to: "READY" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
    if (!ticket) return { ok: false, error: "notFound" };
    const days = daysWaiting(ticket.statusLogs[0]?.createdAt ?? ticket.updatedAt);
    const fee = storageFee(days, ctx.shop.storageFreeDays, ctx.shop.storageFeeUsdCents);
    if (fee <= 0) return { ok: false, error: "noFee" };

    if (ticket._count.items === 0 && (ticket.estimateUsdCents ?? 0) > 0) {
      await tx.ticketItem.create({
        data: { shopId, ticketId, kind: "LABOR", description: t("repairLine"), unitPriceUsdCents: ticket.estimateUsdCents ?? 0 },
      });
    }
    const description = t("storageLine", {
      days: days - ctx.shop.storageFreeDays,
      fee: formatMoney(ctx.shop.storageFeeUsdCents, "USD"),
    });
    const existing = ticket.storageItemId
      ? await tx.ticketItem.findFirst({ where: { id: ticket.storageItemId, shopId, ticketId }, select: { id: true } })
      : null;
    if (existing) {
      await tx.ticketItem.update({ where: { id: existing.id }, data: { description, qty: 1, unitPriceUsdCents: fee } });
    } else {
      const item = await tx.ticketItem.create({ data: { shopId, ticketId, kind: "LABOR", description, unitPriceUsdCents: fee } });
      await tx.ticket.update({ where: { id: ticketId, shopId }, data: { storageItemId: item.id } });
    }
    const items = await tx.ticketItem.findMany({ where: { shopId, ticketId }, select: { qty: true, unitPriceUsdCents: true } });
    await tx.ticket.update({
      where: { id: ticketId, shopId },
      data: { totalUsdCents: items.reduce((s, i) => s + i.qty * i.unitPriceUsdCents, 0) },
    });
    refreshShop();
    return { ok: true };
  });
}
