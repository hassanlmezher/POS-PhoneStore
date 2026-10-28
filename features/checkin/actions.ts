"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshShop, requireActionShop, type ShopContext } from "@/lib/tenant";
import { imageMime } from "@/lib/uploads";
import { ticketAccessWhere } from "@/features/tickets/queries";
import { checklistInput, MAX_MEDIA_BYTES, MAX_PHOTOS, type Checklist } from "./rules";

type Result = { ok: true } | { ok: false; error: "invalid" | "notFound" | "tooLarge" | "badType" | "tooMany" };

const idInput = z.string().min(1).max(64);

async function ticketFor(ctx: ShopContext, ticketId: string) {
  if (!idInput.safeParse(ticketId).success) return null;
  return ctx.db.ticket.findFirst({ where: { AND: [{ id: ticketId }, ticketAccessWhere(ctx.user)] }, select: { id: true } });
}

async function readImage(formData: FormData): Promise<{ data: Uint8Array<ArrayBuffer>; mime: string } | "tooLarge" | "badType" | "invalid"> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "invalid";
  if (file.size > MAX_MEDIA_BYTES) return "tooLarge";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageMime(Buffer.from(bytes.buffer));
  if (!mime) return "badType";
  return { data: bytes, mime };
}

/** Adds one check-in photo (JPEG/PNG/WEBP, checked from its bytes). */
export async function uploadTicketPhoto(ticketId: string, formData: FormData): Promise<Result> {
  const ctx = await requireActionShop("tickets.create");
  const ticket = await ticketFor(ctx, ticketId);
  if (!ticket) return { ok: false, error: "notFound" };
  const img = await readImage(formData);
  if (typeof img === "string") return { ok: false, error: img };
  const shopId = ctx.shop.id;
  const added = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticket.id} AND "shopId" = ${shopId} FOR UPDATE`;
    const count = await tx.ticketMedia.count({ where: { shopId, ticketId: ticket.id, kind: "PHOTO" } });
    if (count >= MAX_PHOTOS) return false;
    await tx.ticketMedia.create({ data: { shopId, ticketId: ticket.id, kind: "PHOTO", ...img, userId: ctx.user.id } });
    return true;
  });
  if (!added) return { ok: false, error: "tooMany" };
  refreshShop();
  return { ok: true };
}

/** Saves the customer's signature (PNG drawn on screen), replacing an older one. */
export async function saveSignature(ticketId: string, formData: FormData): Promise<Result> {
  const ctx = await requireActionShop("tickets.create");
  const ticket = await ticketFor(ctx, ticketId);
  if (!ticket) return { ok: false, error: "notFound" };
  const img = await readImage(formData);
  if (typeof img === "string") return { ok: false, error: img };
  const shopId = ctx.shop.id;
  await prisma.$transaction([
    prisma.ticketMedia.deleteMany({ where: { shopId, ticketId: ticket.id, kind: "SIGNATURE" } }),
    prisma.ticketMedia.create({ data: { shopId, ticketId: ticket.id, kind: "SIGNATURE", ...img, userId: ctx.user.id } }),
  ]);
  refreshShop();
  return { ok: true };
}

export async function deleteTicketMedia(mediaId: string): Promise<Result> {
  const ctx = await requireActionShop("tickets.create");
  if (!idInput.safeParse(mediaId).success) return { ok: false, error: "invalid" };
  const res = await prisma.ticketMedia.deleteMany({
    where: { id: mediaId, shopId: ctx.shop.id, ticket: ticketAccessWhere(ctx.user) },
  });
  if (res.count === 0) return { ok: false, error: "notFound" };
  refreshShop();
  return { ok: true };
}

export async function saveChecklist(ticketId: string, checklist: Checklist): Promise<Result> {
  const ctx = await requireActionShop("tickets.create");
  const ticket = await ticketFor(ctx, ticketId);
  if (!ticket) return { ok: false, error: "notFound" };
  const parsed = checklistInput.safeParse(checklist);
  if (!parsed.success) return { ok: false, error: "invalid" };
  await prisma.ticket.update({ where: { id: ticket.id, shopId: ctx.shop.id }, data: { checklist: parsed.data } });
  refreshShop();
  return { ok: true };
}
