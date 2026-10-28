"use server";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { encrypt, decrypt } from "@/lib/crypto";
import { lockRows, retryOnConflict } from "@/lib/locks";
import { toUsdCents } from "@/lib/money";
import { nextTicketNumber } from "@/lib/numbering";
import { normalizePhone } from "@/lib/phone";
import { moveStock } from "@/lib/stock";
import { refreshShop, requireActionShop, type ShopContext } from "@/lib/tenant";
import { ticketAccessWhere } from "./queries";
import {
  paymentInput,
  ticketDetailsInput,
  ticketInput,
  ticketItemInput,
  TICKET_STATUSES,
  isValidPattern,
  type PaymentInput,
  type TicketDetailsInput,
  type TicketInput,
  type TicketItemInput,
  type TicketStatusValue,
} from "./schema";

// Transactions use the raw client, so every write inside them sets shopId explicitly.

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function invalid(issues: { path: PropertyKey[]; message: string }[]): ActionResult<never> {
  return {
    ok: false,
    error: "invalid",
    fieldErrors: Object.fromEntries(issues.map((i) => [i.path.map(String).join("."), i.message])),
  };
}

/** Loads a ticket the current user may access, or throws. */
async function accessibleTicket(ctx: ShopContext, ticketId: string) {
  const ticket = await ctx.db.ticket.findFirst({
    where: { AND: [{ id: ticketId }, ticketAccessWhere(ctx.user)] },
    select: { id: true, number: true, status: true, pickedUpAt: true },
  });
  if (!ticket) throw new Error("Ticket not found");
  return ticket;
}

async function openCashSessionId(tx: Prisma.TransactionClient, shopId: string) {
  const s = await tx.cashSession.findFirst({ where: { shopId, closedAt: null }, select: { id: true } });
  return s?.id ?? null;
}

async function recordPayment(
  tx: Prisma.TransactionClient,
  ctx: ShopContext,
  ticketId: string,
  p: { amount: number; currency: "USD" | "LBP"; method: (typeof paymentInput)["_output"]["method"]; reference: string | null },
) {
  const rate = ctx.shop.exchangeRate;
  await tx.payment.create({
    data: {
      shopId: ctx.shop.id,
      ticketId,
      method: p.method,
      currency: p.currency,
      amount: p.amount,
      rate,
      usdCentsEquivalent: toUsdCents(p.amount, p.currency, rate),
      reference: p.reference,
      cashSessionId: p.method === "CASH" ? await openCashSessionId(tx, ctx.shop.id) : null,
      userId: ctx.user.id,
    },
  });
}

async function recomputeTotal(tx: Prisma.TransactionClient, shopId: string, ticketId: string) {
  const items = await tx.ticketItem.findMany({
    where: { shopId, ticketId },
    select: { qty: true, unitPriceUsdCents: true },
  });
  const total = items.reduce((s, i) => s + i.qty * i.unitPriceUsdCents, 0);
  await tx.ticket.update({ where: { id: ticketId, shopId }, data: { totalUsdCents: total } });
}

/** Finds or creates a shop-level brand/model for "other" devices, so they're listed next time. */
async function resolveOtherDevice(tx: Prisma.TransactionClient, shopId: string, brandText: string | null, modelText: string) {
  const brandName = brandText?.trim() || "Other";
  const brand =
    (await tx.deviceBrand.findFirst({
      where: { name: { equals: brandName, mode: "insensitive" }, OR: [{ shopId: null }, { shopId }] },
    })) ?? (await tx.deviceBrand.create({ data: { shopId, name: brandName } }));
  const model =
    (await tx.deviceModel.findFirst({
      where: { brandId: brand.id, name: { equals: modelText, mode: "insensitive" } },
    })) ?? (await tx.deviceModel.create({ data: { shopId, brandId: brand.id, name: modelText } }));
  return model.id;
}

export async function createTicket(input: TicketInput): Promise<ActionResult<{ number: number }>> {
  const ctx = await requireActionShop("tickets.create");
  const parsed = ticketInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const shopId = ctx.shop.id;

  let newPhone: string | null = null;
  if (!v.customerId && v.newCustomer) {
    newPhone = normalizePhone(v.newCustomer.phone, ctx.shop.countryCode);
    if (!newPhone) return { ok: false, error: "invalid", fieldErrors: { "newCustomer.phone": "invalidPhone" } };
  }
  if (v.assignedToId) {
    const tech = await prisma.user.findFirst({ where: { id: v.assignedToId, shopId, active: true } });
    if (!tech) return { ok: false, error: "invalid", fieldErrors: { assignedToId: "invalid" } };
  }

  // Retried if another ticket created the same new customer/device at the same moment (the retry reuses it).
  const number = await retryOnConflict(() => prisma.$transaction(async (tx) => {
    let customerId = v.customerId;
    if (customerId) {
      const c = await tx.customer.findFirst({ where: { id: customerId, shopId }, select: { id: true } });
      if (!c) throw new Error("Customer not found");
    } else {
      // Quick-add; reuse the existing customer if this phone is already known.
      const c = await tx.customer.upsert({
        where: { shopId_phone: { shopId, phone: newPhone! } },
        update: {},
        create: { shopId, name: v.newCustomer!.name, phone: newPhone!, locale: v.newCustomer!.locale },
        select: { id: true },
      });
      customerId = c.id;
    }

    let deviceModelId = v.deviceModelId;
    if (deviceModelId) {
      const m = await tx.deviceModel.findFirst({
        where: { id: deviceModelId, OR: [{ shopId: null }, { shopId }] },
        select: { id: true },
      });
      if (!m) throw new Error("Device model not found");
    } else {
      deviceModelId = await resolveOtherDevice(tx, shopId, v.brandText, v.modelText!);
    }

    const number = await nextTicketNumber(tx, shopId);
    const ticket = await tx.ticket.create({
      data: {
        shopId,
        number,
        customerId,
        deviceModelId,
        imei: v.imei,
        color: v.color,
        problem: v.problem,
        passcodeEnc: v.passcode ? encrypt(v.passcode) : null,
        patternEnc: v.pattern ? encrypt(v.pattern) : null,
        accessories: v.accessories,
        conditionNotes: v.conditionNotes,
        estimateUsdCents: v.estimate,
        promisedAt: v.promisedAt,
        assignedToId: v.assignedToId,
        warrantyDays: v.warrantyDays ?? ctx.shop.defaultWarrantyDays,
        createdById: ctx.user.id,
        statusLogs: { create: { shopId, to: "RECEIVED", userId: ctx.user.id } },
      },
      select: { id: true },
    });
    if (v.deposit) await recordPayment(tx, ctx, ticket.id, v.deposit);
    return number;
  }));

  refreshShop();
  return { ok: true, number };
}

export async function changeTicketStatus(
  ticketId: string,
  to: TicketStatusValue,
  note?: string,
): Promise<ActionResult> {
  const ctx = await requireActionShop("tickets.status");
  if (!TICKET_STATUSES.includes(to)) return { ok: false, error: "invalid" };
  const ticket = await accessibleTicket(ctx, ticketId);
  if (ticket.status === to) return { ok: true };
  const shopId = ctx.shop.id;

  await prisma.$transaction(async (tx) => {
    // Re-read under a lock so the log's "from" is right when two people change the status at once.
    await lockRows(tx, "Ticket", shopId, [ticketId]);
    const { status: from } = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId, shopId }, select: { status: true } });
    if (from === to) return;
    await tx.ticket.update({
      where: { id: ticketId, shopId },
      data: {
        status: to,
        // Warranty starts at pickup; moving back out of Picked up clears it.
        pickedUpAt: to === "PICKED_UP" ? new Date() : from === "PICKED_UP" ? null : undefined,
        // Each time it becomes Ready the pickup reminders start again from day 3.
        ...(to === "READY" && { pickupReminders: 0, pickupRemindedAt: null }),
      },
    });
    await tx.ticketStatusLog.create({
      data: { shopId, ticketId, from, to, userId: ctx.user.id, note: note?.trim() || null },
    });
  });
  refreshShop();
  return { ok: true };
}

export async function assignTicket(ticketId: string, userId: string | null): Promise<ActionResult> {
  const ctx = await requireActionShop("tickets.status");
  await accessibleTicket(ctx, ticketId);
  if (userId) {
    const u = await prisma.user.findFirst({ where: { id: userId, shopId: ctx.shop.id, active: true } });
    if (!u) return { ok: false, error: "invalid" };
  }
  await ctx.db.ticket.update({ where: { id: ticketId }, data: { assignedToId: userId } });
  refreshShop();
  return { ok: true };
}

export async function updateTicketDetails(ticketId: string, input: TicketDetailsInput): Promise<ActionResult> {
  const ctx = await requireActionShop("tickets.create");
  await accessibleTicket(ctx, ticketId);
  const parsed = ticketDetailsInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { estimate, ...rest } = parsed.data;
  await ctx.db.ticket.update({ where: { id: ticketId }, data: { ...rest, estimateUsdCents: estimate } });
  refreshShop();
  return { ok: true };
}

export type LockChange = { kind: "none" } | { kind: "passcode"; value: string } | { kind: "pattern"; value: string };

/**
 * Replaces or removes the stored screen lock. Removing must be explicit ({ kind: "none" }); an empty
 * passcode/pattern is rejected so a careless "Save" can never wipe a lock. Every change is audit-logged.
 */
export async function setTicketPasscode(ticketId: string, change: LockChange): Promise<ActionResult> {
  const ctx = await requireActionShop("tickets.create");
  await accessibleTicket(ctx, ticketId);
  let data: { passcodeEnc: string | null; patternEnc: string | null };
  if (change.kind === "none") {
    data = { passcodeEnc: null, patternEnc: null };
  } else if (change.kind === "passcode") {
    const value = change.value?.trim();
    if (!value || value.length > 100) return { ok: false, error: "invalid", fieldErrors: { passcode: "required" } };
    data = { passcodeEnc: encrypt(value), patternEnc: null };
  } else if (change.kind === "pattern") {
    if (!isValidPattern(change.value ?? "")) return { ok: false, error: "invalid", fieldErrors: { pattern: "patternTooShort" } };
    data = { passcodeEnc: null, patternEnc: encrypt(change.value) };
  } else {
    return { ok: false, error: "invalid" };
  }
  await ctx.db.ticket.update({ where: { id: ticketId }, data });
  await ctx.db.auditLog.create({
    data: {
      shopId: ctx.shop.id,
      userId: ctx.user.id,
      action: change.kind === "none" ? "passcode.remove" : "passcode.change",
      entity: "Ticket",
      entityId: ticketId,
      meta: { kind: change.kind },
    },
  });
  refreshShop();
  return { ok: true };
}

/** Reveals the passcode/pattern. Every reveal is audit-logged. */
export async function revealPasscode(ticketId: string): Promise<ActionResult<{ passcode: string | null; pattern: string | null }>> {
  const ctx = await requireActionShop(undefined, { write: false });
  await accessibleTicket(ctx, ticketId);
  const t = await ctx.db.ticket.findUnique({ where: { id: ticketId }, select: { passcodeEnc: true, patternEnc: true } });
  if (!t) return { ok: false, error: "notFound" };
  await ctx.db.auditLog.create({
    data: { shopId: ctx.shop.id, userId: ctx.user.id, action: "passcode.reveal", entity: "Ticket", entityId: ticketId },
  });
  return {
    ok: true,
    passcode: t.passcodeEnc ? decrypt(t.passcodeEnc) : null,
    pattern: t.patternEnc ? decrypt(t.patternEnc) : null,
  };
}

export async function addTicketItem(ticketId: string, input: TicketItemInput): Promise<ActionResult> {
  const ctx = await requireActionShop("tickets.items");
  await accessibleTicket(ctx, ticketId);
  const parsed = ticketItemInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const shopId = ctx.shop.id;

  await prisma.$transaction(async (tx) => {
    // Serialize item changes per ticket so the recomputed total includes every line.
    await lockRows(tx, "Ticket", shopId, [ticketId]);
    // Warranty comebacks are repaired free: lines keep their cost but no price.
    const comeback = await tx.ticket.findFirst({ where: { id: ticketId, shopId, comebackOfId: { not: null } }, select: { id: true } });
    let unitCostUsdCents = 0;
    if (v.kind === "PART" && v.productId) {
      const product = await tx.product.findFirst({
        where: { id: v.productId, shopId },
        select: { costUsdCents: true },
      });
      if (!product) throw new Error("Product not found");
      unitCostUsdCents = product.costUsdCents;
    }
    const item = await tx.ticketItem.create({
      data: {
        shopId,
        ticketId,
        kind: v.kind,
        productId: v.kind === "PART" ? v.productId : null,
        description: v.description,
        qty: v.qty,
        unitPriceUsdCents: comeback ? 0 : v.unitPriceUsdCents,
        unitCostUsdCents,
      },
    });
    if (item.productId) {
      await moveStock(tx, {
        shopId,
        productId: item.productId,
        delta: -item.qty,
        reason: "TICKET_PART",
        userId: ctx.user.id,
        ticketItemId: item.id,
      });
    }
    await recomputeTotal(tx, shopId, ticketId);
  });
  refreshShop();
  return { ok: true };
}

export async function removeTicketItem(itemId: string): Promise<ActionResult> {
  const ctx = await requireActionShop("tickets.items");
  const shopId = ctx.shop.id;
  const found = await ctx.db.ticketItem.findUnique({ where: { id: itemId }, select: { ticketId: true } });
  if (!found) return { ok: false, error: "notFound" };
  await accessibleTicket(ctx, found.ticketId);

  const removed = await prisma.$transaction(async (tx) => {
    await lockRows(tx, "Ticket", shopId, [found.ticketId]);
    // Re-read under the lock: a double-click's second request finds the item already gone.
    const item = await tx.ticketItem.findUnique({ where: { id: itemId, shopId } });
    if (!item) return false;
    if (item.productId) {
      await moveStock(tx, {
        shopId,
        productId: item.productId,
        delta: item.qty,
        reason: "RETURN",
        userId: ctx.user.id,
        note: "@removedFromTicket", // translated on display (movementReasons.removedFromTicket)
      });
    }
    await tx.ticketItem.delete({ where: { id: itemId, shopId } });
    await recomputeTotal(tx, shopId, item.ticketId);
    return true;
  });
  if (!removed) return { ok: false, error: "notFound" };
  refreshShop();
  return { ok: true };
}

export async function addTicketNote(ticketId: string, body: string): Promise<ActionResult> {
  const ctx = await requireActionShop();
  await accessibleTicket(ctx, ticketId);
  const text = body.trim();
  if (!text || text.length > 2000) return { ok: false, error: "invalid" };
  await ctx.db.ticketNote.create({ data: { shopId: ctx.shop.id, ticketId, userId: ctx.user.id, body: text } });
  refreshShop();
  return { ok: true };
}

/** Deposit or payment recorded directly on a ticket (not processed). */
export async function addTicketPayment(ticketId: string, input: PaymentInput): Promise<ActionResult> {
  const ctx = await requireActionShop("tickets.create");
  await accessibleTicket(ctx, ticketId);
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  await prisma.$transaction((tx) => recordPayment(tx, ctx, ticketId, parsed.data));
  refreshShop();
  return { ok: true };
}

/** Parts for the "add part" picker: name, SKU, barcode or compatible model. */
export async function searchParts(q: string) {
  const ctx = await requireActionShop(undefined, { write: false });
  const term = q.trim();
  return ctx.db.product.findMany({
    where: {
      active: true,
      ...(term && {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
          { barcode: term },
          { compatibleModels: { some: { name: { contains: term, mode: "insensitive" } } } },
        ],
      }),
    },
    select: { id: true, name: true, type: true, sku: true, qty: true, priceUsdCents: true },
    orderBy: [{ type: "desc" }, { name: "asc" }],
    take: 10,
  });
}
