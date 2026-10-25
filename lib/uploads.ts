import "server-only";
import { prisma } from "@/lib/db";

// Shop logos are stored in the database (ShopLogo), so the app needs no disk storage and runs the
// same on serverless hosts (Vercel) and in Docker.
export const MAX_LOGO_BYTES = 1024 * 1024;

const TYPES = {
  png: { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  jpg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  webp: { mime: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] }, // "RIFF" (+ "WEBP" at 8)
} as const;
type Ext = keyof typeof TYPES;

/** Detect the image type from its bytes, never from the client-sent name or MIME. */
function sniff(buf: Buffer): Ext | null {
  for (const [ext, t] of Object.entries(TYPES) as [Ext, (typeof TYPES)[Ext]][]) {
    if (t.magic.every((b, i) => buf[i] === b)) {
      if (ext === "webp" && buf.subarray(8, 12).toString("ascii") !== "WEBP") continue;
      return ext;
    }
  }
  return null;
}

export type SaveLogoResult = { ok: true; version: number } | { ok: false; error: "tooLarge" | "badType" };

/** Validates and stores the logo; `version` busts caches in the logo URL. */
export async function saveShopLogo(shopId: string, file: File): Promise<SaveLogoResult> {
  if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "tooLarge" };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return { ok: false, error: "badType" };
  const data = new Uint8Array(buf);
  const mime = TYPES[ext].mime;
  const logo = await prisma.shopLogo.upsert({
    where: { shopId },
    update: { mime, data },
    create: { shopId, mime, data },
    select: { updatedAt: true },
  });
  return { ok: true, version: logo.updatedAt.getTime() };
}

export async function deleteShopLogo(shopId: string) {
  await prisma.shopLogo.deleteMany({ where: { shopId } });
}

/** Current logo bytes + MIME, or null. */
export async function readShopLogo(shopId: string): Promise<{ data: Buffer; mime: string } | null> {
  const logo = await prisma.shopLogo.findUnique({ where: { shopId }, select: { data: true, mime: true } });
  return logo ? { data: Buffer.from(logo.data), mime: logo.mime } : null;
}
