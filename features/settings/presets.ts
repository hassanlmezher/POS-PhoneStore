import "server-only";
import { prisma } from "@/lib/db";
import type { PresetKind } from "@/lib/generated/prisma/client";

/** Shop quick picks in display order; `label` is resolved for the UI locale. */
export async function listPresets(shopId: string, kind?: PresetKind) {
  return prisma.shopPreset.findMany({
    where: { shopId, ...(kind && { kind }) },
    orderBy: [{ kind: "asc" }, { sort: "asc" }, { createdAt: "asc" }],
    select: { id: true, kind: true, labelEn: true, labelAr: true, sort: true },
  });
}
export type Preset = Awaited<ReturnType<typeof listPresets>>[number];

export function presetLabel(p: { labelEn: string; labelAr: string }, locale: string) {
  return (locale === "ar" ? p.labelAr : p.labelEn) || p.labelEn || p.labelAr;
}
