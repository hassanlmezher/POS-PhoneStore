import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { effectiveStatus } from "@/lib/subscription";

export async function listShops(q = "") {
  const term = q.trim();
  const where: Prisma.ShopWhereInput = term
    ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { slug: { contains: term, mode: "insensitive" } }] }
    : {};
  const shops = await prisma.shop.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      phone: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      paidUntil: true,
      createdAt: true,
      plan: { select: { name: true } },
      _count: { select: { users: true, tickets: true, sales: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return shops.map((s) => ({ ...s, effectiveStatus: effectiveStatus(s) }));
}

export async function getShopForAdmin(id: string) {
  const shop = await prisma.shop.findUnique({
    where: { id },
    include: {
      plan: true,
      users: {
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      },
      subscriptionPayments: { orderBy: { createdAt: "desc" } },
      _count: { select: { tickets: true, sales: true, customers: true, products: true } },
    },
  });
  if (!shop) return null;
  const lastActivity = await prisma.ticket.findFirst({
    where: { shopId: id },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return { ...shop, effectiveStatus: effectiveStatus(shop), lastActivityAt: lastActivity?.updatedAt ?? null };
}

export async function listPlans() {
  return prisma.plan.findMany({
    orderBy: [{ active: "desc" }, { priceUsdCents: "asc" }],
    include: { _count: { select: { shops: true } } },
  });
}

/** Headline numbers for the admin home. */
export async function platformStats() {
  const shops = await prisma.shop.findMany({
    select: { subscriptionStatus: true, trialEndsAt: true, paidUntil: true, plan: { select: { priceUsdCents: true } } },
  });
  const byStatus = { TRIAL: 0, ACTIVE: 0, EXPIRED: 0, SUSPENDED: 0 };
  let mrrUsdCents = 0;
  const soon = Date.now() + 7 * 86_400_000;
  let expiringSoon = 0;
  for (const s of shops) {
    const st = effectiveStatus(s);
    byStatus[st] += 1;
    if (st === "ACTIVE") mrrUsdCents += s.plan?.priceUsdCents ?? 0;
    const end = st === "ACTIVE" ? s.paidUntil : st === "TRIAL" ? s.trialEndsAt : null;
    if (end && end.getTime() < soon) expiringSoon += 1;
  }
  return { total: shops.length, byStatus, mrrUsdCents, expiringSoon };
}
