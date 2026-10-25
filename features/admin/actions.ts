"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { createUserWithPassword, setUserPassword } from "@/lib/accounts";
import { applyShopDefaults } from "@/lib/shop-defaults";
import { provisionShopDomain, removeShopDomain, type DomainResult } from "@/lib/domains";
import { deleteShopData } from "@/lib/shop-delete";
import { requireSuperAdmin } from "@/lib/tenant";
import {
  createShopInput,
  planInput,
  slugSchema,
  subscriptionPaymentInput,
  updateSubscriptionInput,
  type CreateShopInput,
  type PlanInput,
  type SubscriptionPaymentInput,
  type UpdateSubscriptionInput,
} from "./schema";

export type AdminResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function invalid(issues: { path: PropertyKey[]; message: string }[]): AdminResult<never> {
  return { ok: false, error: "invalid", fieldErrors: Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message])) };
}

const refresh = () => revalidatePath("/", "layout");

/** New shop on trial, with default WhatsApp templates and its first owner account. */
export async function createShop(
  input: CreateShopInput,
): Promise<AdminResult<{ id: string; slug: string; domain: DomainResult }>> {
  await requireSuperAdmin();
  const parsed = createShopInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;

  try {
    const shop = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name: v.name,
          slug: v.slug,
          planId: v.planId,
          defaultLocale: v.defaultLocale,
          subscriptionStatus: "TRIAL",
          trialEndsAt: new Date(Date.now() + v.trialDays * 86_400_000),
        },
        select: { id: true, slug: true, exchangeRate: true },
      });
      await applyShopDefaults(tx, shop.id);
      const owner = await createUserWithPassword(tx, {
        email: v.ownerEmail,
        name: v.ownerName,
        password: v.ownerPassword,
        shopId: shop.id,
        role: "OWNER",
      });
      await tx.exchangeRate.create({ data: { shopId: shop.id, rate: shop.exchangeRate, setById: owner.id } });
      return shop;
    });
    // Its web address (<slug>.domain) is set up automatically on Vercel + Cloudflare when configured.
    const domain = await provisionShopDomain(shop.slug);
    refresh();
    return { ok: true, id: shop.id, slug: shop.slug, domain };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String(e.meta?.target ?? "");
      return { ok: false, error: "invalid", fieldErrors: target.includes("slug") ? { slug: "slugTaken" } : { ownerEmail: "emailTaken" } };
    }
    throw e;
  }
}

export async function updateShopBasics(shopId: string, input: { name: string; slug: string }): Promise<AdminResult> {
  await requireSuperAdmin();
  const slug = slugSchema.safeParse(input.slug);
  if (!slug.success) return invalid(slug.error.issues.map((i) => ({ ...i, path: ["slug"] })));
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "invalid", fieldErrors: { name: "required" } };
  const before = await prisma.shop.findUnique({ where: { id: shopId }, select: { slug: true } });
  if (!before) return { ok: false, error: "notFound" };
  try {
    await prisma.shop.update({ where: { id: shopId }, data: { name, slug: slug.data } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "invalid", fieldErrors: { slug: "slugTaken" } };
    }
    throw e;
  }
  // A new slug means a new web address: add it, then drop the old one.
  if (before.slug !== slug.data) {
    const added = await provisionShopDomain(slug.data);
    if (added.status !== "error") await removeShopDomain(before.slug);
  }
  refresh();
  return { ok: true };
}

/** Admin "set up web address" button: (re)creates <slug>.domain on Vercel + Cloudflare. */
export async function setupShopDomain(shopId: string): Promise<AdminResult<{ domain: DomainResult }>> {
  await requireSuperAdmin();
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { slug: true } });
  if (!shop) return { ok: false, error: "notFound" };
  const domain = await provisionShopDomain(shop.slug);
  refresh();
  return { ok: true, domain };
}

export async function updateSubscription(shopId: string, input: UpdateSubscriptionInput): Promise<AdminResult> {
  await requireSuperAdmin();
  const parsed = updateSubscriptionInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  await prisma.shop.update({ where: { id: shopId }, data: parsed.data });
  refresh();
  return { ok: true };
}

/** Records a manual payment and marks the shop paid until the end of the period. */
export async function recordSubscriptionPayment(shopId: string, input: SubscriptionPaymentInput): Promise<AdminResult> {
  const admin = await requireSuperAdmin();
  const parsed = subscriptionPaymentInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data;
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { paidUntil: true } });
  if (!shop) return { ok: false, error: "notFound" };

  await prisma.$transaction([
    prisma.subscriptionPayment.create({ data: { shopId, ...v, recordedById: admin.id } }),
    prisma.shop.update({
      where: { id: shopId },
      data: {
        subscriptionStatus: "ACTIVE",
        // Never shorten an already longer paid period.
        paidUntil: shop.paidUntil && shop.paidUntil > v.periodEnd ? shop.paidUntil : v.periodEnd,
      },
    }),
  ]);
  refresh();
  return { ok: true };
}

export async function resetOwnerPassword(userId: string, password: string): Promise<AdminResult> {
  await requireSuperAdmin();
  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, error: "invalid", fieldErrors: { password: "passwordTooShort" } };
  }
  const user = await prisma.user.findFirst({ where: { id: userId, isSuperAdmin: false }, select: { id: true } });
  if (!user) return { ok: false, error: "notFound" };
  await prisma.$transaction((tx) => setUserPassword(tx, userId, password));
  return { ok: true };
}

export async function savePlan(planId: string | null, input: PlanInput): Promise<AdminResult> {
  await requireSuperAdmin();
  const parsed = planInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const data = {
    name: parsed.data.name,
    priceUsdCents: parsed.data.price,
    maxStaff: parsed.data.maxStaff ?? null,
    active: parsed.data.active,
  };
  if (planId) await prisma.plan.update({ where: { id: planId }, data });
  else await prisma.plan.create({ data });
  refresh();
  return { ok: true };
}

const platformInput = z.object({
  appName: z.string().trim().min(1, "required").max(60),
  contactWhatsapp: z.string().trim().max(30).optional().transform((v) => v || null),
  contactEmail: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "invalidEmail"),
  showcaseShopSlug: z.string().trim().max(40).optional().transform((v) => v || null),
});
export type PlatformInput = z.input<typeof platformInput>;

/** Super admin: product name, landing-page contact, and which (demo) shop illustrates the landing page. */
export async function updatePlatformSettings(input: PlatformInput): Promise<AdminResult> {
  await requireSuperAdmin();
  const parsed = platformInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (parsed.data.showcaseShopSlug) {
    const shop = await prisma.shop.findUnique({ where: { slug: parsed.data.showcaseShopSlug }, select: { id: true } });
    if (!shop) return { ok: false, error: "invalid", fieldErrors: { showcaseShopSlug: "notFound" } };
  }
  await prisma.platformSetting.upsert({ where: { id: "platform" }, update: parsed.data, create: { id: "platform", ...parsed.data } });
  refresh();
  return { ok: true };
}

/**
 * Permanently deletes a shop and all of its data, after removing its web address (Vercel domain + the
 * Cloudflare record we created). The admin must type the slug to confirm.
 */
export async function deleteShop(shopId: string, confirmSlug: string): Promise<AdminResult<{ domain: DomainResult }>> {
  await requireSuperAdmin();
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, slug: true } });
  if (!shop) return { ok: false, error: "notFound" };
  if (confirmSlug.trim().toLowerCase() !== shop.slug) return { ok: false, error: "invalid", fieldErrors: { confirm: "slugMismatch" } };
  const platform = await prisma.platformSetting.findUnique({ where: { id: "platform" }, select: { showcaseShopSlug: true } });
  if (platform?.showcaseShopSlug === shop.slug) return { ok: false, error: "showcaseShop" };

  const domain = await removeShopDomain(shop.slug);
  await deleteShopData(shop.id);
  refresh();
  return { ok: true, domain };
}
