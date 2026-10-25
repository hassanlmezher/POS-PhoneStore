import type { Locale, Prisma, PresetKind, TemplateKey } from "@/lib/generated/prisma/client";

type DefaultTemplates = Partial<Record<TemplateKey, Partial<Record<Locale, string>>>>;
type DefaultPreset = { kind: PresetKind; labelEn: string; labelAr: string };

/**
 * Gives a new shop its starting WhatsApp templates and quick picks, copied from the platform
 * defaults stored in PlatformSetting (set by the seed, editable later). Call inside a transaction.
 */
export async function applyShopDefaults(tx: Prisma.TransactionClient, shopId: string) {
  const platform = await tx.platformSetting.findUnique({ where: { id: "platform" } });
  const templates = (platform?.defaultTemplates ?? {}) as DefaultTemplates;
  const presets = (platform?.defaultPresets ?? []) as DefaultPreset[];

  const templateRows = Object.entries(templates).flatMap(([key, bodies]) =>
    Object.entries(bodies ?? {}).map(([locale, body]) => ({
      shopId,
      key: key as TemplateKey,
      locale: locale as Locale,
      body: String(body),
    })),
  );
  if (templateRows.length) await tx.messageTemplate.createMany({ data: templateRows, skipDuplicates: true });

  const existing = await tx.shopPreset.count({ where: { shopId } });
  if (!existing && presets.length) {
    await tx.shopPreset.createMany({
      data: presets.map((p, i) => ({ shopId, kind: p.kind, labelEn: p.labelEn, labelAr: p.labelAr, sort: i })),
    });
  }
}
