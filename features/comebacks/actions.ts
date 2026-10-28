"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatTicketNumber, nextTicketNumber } from "@/lib/numbering";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { warrantyUntil } from "@/features/tickets/money";
import { deviceName, ticketAccessWhere } from "@/features/tickets/queries";

const input = z.object({ originalId: z.string().min(1).max(64), problem: z.string().trim().min(1, "required").max(2000) });

/**
 * Opens a free repair for a phone that came back: same customer, phone, IMEI and lock, linked to the
 * original ticket, same technician, price 0, and the warranty days that were left on the original.
 */
export async function createComeback(
  originalId: string,
  problem: string,
): Promise<{ ok: true; number: number } | { ok: false; error: string; fieldErrors?: Record<string, string> }> {
  const ctx = await requireActionShop("tickets.create");
  const parsed = input.safeParse({ originalId, problem });
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const shopId = ctx.shop.id;
  const original = await ctx.db.ticket.findFirst({
    where: { AND: [{ id: originalId, status: "PICKED_UP" }, ticketAccessWhere(ctx.user)] },
    select: {
      id: true,
      customerId: true,
      deviceModelId: true,
      imei: true,
      color: true,
      passcodeEnc: true,
      patternEnc: true,
      assignedToId: true,
      pickedUpAt: true,
      warrantyDays: true,
      assignedTo: { select: { active: true } },
    },
  });
  if (!original) return { ok: false, error: "notFound" };
  const until = warrantyUntil(original);
  const daysLeft = until ? Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86_400_000)) : 0;

  const number = await prisma.$transaction(async (tx) => {
    const number = await nextTicketNumber(tx, shopId);
    await tx.ticket.create({
      data: {
        shopId,
        number,
        customerId: original.customerId,
        deviceModelId: original.deviceModelId,
        imei: original.imei,
        color: original.color,
        passcodeEnc: original.passcodeEnc,
        patternEnc: original.patternEnc,
        problem: parsed.data.problem,
        estimateUsdCents: 0,
        assignedToId: original.assignedTo?.active ? original.assignedToId : null,
        warrantyDays: daysLeft,
        comebackOfId: original.id,
        createdById: ctx.user.id,
        statusLogs: { create: { shopId, to: "RECEIVED", userId: ctx.user.id } },
      },
    });
    return number;
  });
  refreshShop();
  return { ok: true, number };
}

/** A customer's picked-up repairs still under warranty, newest first (shown at check-in). */
export async function listWarrantyRepairs(customerId: string) {
  const ctx = await requireActionShop("tickets.create", { write: false });
  if (!z.string().min(1).max(64).safeParse(customerId).success) return [];
  const rows = await ctx.db.ticket.findMany({
    where: { AND: [{ customerId, status: "PICKED_UP", warrantyDays: { gt: 0 } }, ticketAccessWhere(ctx.user)] },
    select: {
      id: true,
      number: true,
      problem: true,
      pickedUpAt: true,
      warrantyDays: true,
      brandText: true,
      modelText: true,
      deviceModel: { select: { name: true, brand: { select: { name: true } } } },
    },
    orderBy: { pickedUpAt: "desc" },
    take: 20,
  });
  const now = Date.now();
  return rows
    .map((r) => ({ r, until: warrantyUntil(r) }))
    .filter(({ until }) => until && until.getTime() > now)
    .map(({ r, until }) => ({
      id: r.id,
      label: formatTicketNumber(ctx.shop.ticketPrefix, r.number),
      device: deviceName(r),
      problem: r.problem,
      until: until!.toISOString(),
    }));
}
export type WarrantyRepair = Awaited<ReturnType<typeof listWarrantyRepairs>>[number];
