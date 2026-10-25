import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/** Platform-wide settings row (app name, contact, showcase shop, defaults for new shops). */
export const getPlatformSettings = cache(async () => {
  return (
    (await prisma.platformSetting.findUnique({ where: { id: "platform" } })) ??
    // First boot before seeding: create the row from the schema defaults.
    (await prisma.platformSetting.create({ data: { id: "platform" } }))
  );
});

export type PlatformSettings = Awaited<ReturnType<typeof getPlatformSettings>>;
