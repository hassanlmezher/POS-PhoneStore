import "server-only";
import { prisma } from "@/lib/db";

export async function listStaff(shopId: string) {
  return prisma.user.findMany({
    where: { shopId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
  });
}

export async function exchangeRateHistory(shopId: string, take = 30) {
  return prisma.exchangeRate.findMany({
    where: { shopId },
    include: { setBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function listTemplates(shopId: string) {
  return prisma.messageTemplate.findMany({ where: { shopId }, orderBy: [{ key: "asc" }, { locale: "asc" }] });
}

export async function shopPlan(planId: string | null) {
  return planId ? prisma.plan.findUnique({ where: { id: planId } }) : null;
}
