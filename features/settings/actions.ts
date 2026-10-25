"use server";

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { createUserWithPassword, setUserPassword } from "@/lib/accounts";
import { refreshShop, requireActionShop } from "@/lib/tenant";
import { deleteShopLogo, saveShopLogo } from "@/lib/uploads";
import { isTimeZone } from "@/lib/dates";
import {
  presetInput,
  type PresetInput,
  exchangeRateInput,
  receiptSettingsInput,
  shopProfileInput,
  staffCreateInput,
  staffUpdateInput,
  templateInput,
  type ReceiptSettingsInput,
  type ShopProfileInput,
  type StaffCreateInput,
  type StaffUpdateInput,
  type TemplateInput,
} from "./schema";

export type SettingsResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function invalid(issues: { path: PropertyKey[]; message: string }[]): SettingsResult<never> {
  return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message])) };
}

export async function updateShopProfile(input: ShopProfileInput): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const parsed = shopProfileInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isTimeZone(parsed.data.timezone)) return { ok: false, error: "invalid", fieldErrors: { timezone: "invalidTimezone" } };
  await prisma.shop.update({ where: { id: ctx.shop.id }, data: parsed.data });
  refreshShop();
  return { ok: true };
}

export async function updateReceiptSettings(input: ReceiptSettingsInput): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const parsed = receiptSettingsInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  await prisma.shop.update({ where: { id: ctx.shop.id }, data: parsed.data });
  refreshShop();
  return { ok: true };
}

/** Updates today's rate. Old payments keep their own snapshot; every change is logged. */
export async function setExchangeRate(rate: number | string): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const parsed = exchangeRateInput.safeParse({ rate });
  if (!parsed.success) return invalid(parsed.error.issues);
  if (parsed.data.rate === ctx.shop.exchangeRate) return { ok: true };
  await prisma.$transaction([
    prisma.shop.update({ where: { id: ctx.shop.id }, data: { exchangeRate: parsed.data.rate } }),
    prisma.exchangeRate.create({ data: { shopId: ctx.shop.id, rate: parsed.data.rate, setById: ctx.user.id } }),
  ]);
  refreshShop();
  return { ok: true };
}

export async function updateTemplate(input: TemplateInput): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const parsed = templateInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { key, locale, body } = parsed.data;
  await ctx.db.messageTemplate.upsert({
    where: { shopId_key_locale: { shopId: ctx.shop.id, key, locale } },
    update: { body },
    create: { shopId: ctx.shop.id, key, locale, body },
  });
  refreshShop();
  return { ok: true };
}

export async function uploadLogo(formData: FormData): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "required" };
  const saved = await saveShopLogo(ctx.shop.id, file);
  if (!saved.ok) return { ok: false, error: saved.error };
  await prisma.shop.update({ where: { id: ctx.shop.id }, data: { logoUrl: `/files/logo?v=${saved.version}` } });
  refreshShop();
  return { ok: true };
}

export async function removeLogo(): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  await deleteShopLogo(ctx.shop.id);
  await prisma.shop.update({ where: { id: ctx.shop.id }, data: { logoUrl: null } });
  refreshShop();
  return { ok: true };
}

// ---------- Staff ----------

async function activeOwnerCount(shopId: string, excludeUserId?: string) {
  return prisma.user.count({
    where: { shopId, role: "OWNER", active: true, ...(excludeUserId && { id: { not: excludeUserId } }) },
  });
}

export async function createStaff(input: StaffCreateInput): Promise<SettingsResult<{ id: string }>> {
  const ctx = await requireActionShop("settings");
  const parsed = staffCreateInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const plan = ctx.shop.planId ? await prisma.plan.findUnique({ where: { id: ctx.shop.planId } }) : null;
  if (plan?.maxStaff) {
    const count = await prisma.user.count({ where: { shopId: ctx.shop.id, active: true } });
    if (count >= plan.maxStaff) return { ok: false, error: "staffLimit" };
  }
  try {
    const user = await prisma.$transaction((tx) =>
      createUserWithPassword(tx, { ...parsed.data, shopId: ctx.shop.id }),
    );
    refreshShop();
    return { ok: true, id: user.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "invalid", fieldErrors: { email: "emailTaken" } };
    }
    throw e;
  }
}

/** Edit name/role/active. A shop always keeps at least one active owner. */
export async function updateStaff(userId: string, input: StaffUpdateInput): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const parsed = staffUpdateInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const user = await prisma.user.findFirst({ where: { id: userId, shopId: ctx.shop.id } });
  if (!user) return { ok: false, error: "notFound" };

  const losesOwner = user.role === "OWNER" && user.active && (parsed.data.role !== "OWNER" || !parsed.data.active);
  if (losesOwner && (await activeOwnerCount(ctx.shop.id, userId)) === 0) return { ok: false, error: "lastOwner" };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: parsed.data });
    // Deactivated users are signed out immediately.
    if (!parsed.data.active) await tx.session.deleteMany({ where: { userId } });
  });
  refreshShop();
  return { ok: true };
}

export async function resetStaffPassword(userId: string, password: string): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { ok: false, error: "invalid", fieldErrors: { password: "passwordTooShort" } };
  }
  const user = await prisma.user.findFirst({ where: { id: userId, shopId: ctx.shop.id }, select: { id: true } });
  if (!user) return { ok: false, error: "notFound" };
  await prisma.$transaction((tx) => setUserPassword(tx, userId, password));
  await ctx.db.auditLog.create({
    data: { shopId: ctx.shop.id, userId: ctx.user.id, action: "staff.resetPassword", entity: "User", entityId: userId },
  });
  return { ok: true };
}

// ---------- Quick picks (problems on intake, drawer pay in/out reasons) ----------

/** Creates (no id) or updates a quick pick. New ones go to the end of their list. */
export async function savePreset(id: string | null, input: PresetInput): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const parsed = presetInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const shopId = ctx.shop.id;
  if (id) {
    const res = await prisma.shopPreset.updateMany({ where: { id, shopId }, data: parsed.data });
    if (!res.count) return { ok: false, error: "notFound" };
  } else {
    const last = await prisma.shopPreset.findFirst({
      where: { shopId, kind: parsed.data.kind },
      orderBy: { sort: "desc" },
      select: { sort: true },
    });
    await prisma.shopPreset.create({ data: { ...parsed.data, shopId, sort: (last?.sort ?? -1) + 1 } });
  }
  refreshShop();
  return { ok: true };
}

export async function deletePreset(id: string): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const res = await prisma.shopPreset.deleteMany({ where: { id, shopId: ctx.shop.id } });
  if (!res.count) return { ok: false, error: "notFound" };
  refreshShop();
  return { ok: true };
}

/** Moves a quick pick one place up or down within its list. */
export async function movePreset(id: string, direction: "up" | "down"): Promise<SettingsResult> {
  const ctx = await requireActionShop("settings");
  const shopId = ctx.shop.id;
  const item = await prisma.shopPreset.findFirst({ where: { id, shopId } });
  if (!item) return { ok: false, error: "notFound" };
  const list = await prisma.shopPreset.findMany({
    where: { shopId, kind: item.kind },
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const i = list.findIndex((p) => p.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await prisma.$transaction(list.map((p, sort) => prisma.shopPreset.update({ where: { id: p.id }, data: { sort } })));
  refreshShop();
  return { ok: true };
}
