// Seed: super admin, device catalog, a "demo" shop with staff and rich demo data (prisma/seed-demo.ts),
// and a second empty shop for isolation tests.
// Dev logins (all use DEV_PASSWORD):
//   admin@inchouf.local   → admin.localhost:3000
//   owner@demo.local, tech@demo.local, tech2@demo.local, cashier@demo.local → demo.localhost:3000
//   owner@other.local       → other.localhost:3000
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Role } from "../lib/generated/prisma/client";
import { DEFAULT_PRESETS, DEFAULT_TEMPLATES } from "./seed-defaults";
import { applyShopDefaults } from "../lib/shop-defaults";
import { seedDemoData } from "./seed-demo";
import { pgConfig } from "../lib/pg-config";

// Dev: everyone uses "password123". Production: SEED_PASSWORD is required (no default passwords on a
// public server), the admin e-mail comes from SEED_ADMIN_EMAIL, and the isolation-test shop is skipped.
const isProd = process.env.NODE_ENV === "production";
const DEV_PASSWORD = process.env.SEED_PASSWORD ?? (isProd ? "" : "password123");
if (DEV_PASSWORD.length < 10 && isProd) {
  console.error("Set SEED_PASSWORD (10+ characters) to seed a production database.");
  process.exit(1);
}
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@inchouf.local";

const prisma = new PrismaClient({
  adapter: new PrismaPg(pgConfig()),
});

const CATALOG: Record<string, string[]> = {
  Apple: [
    "iPhone 11", "iPhone 12", "iPhone 12 Pro", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
    "iPhone 14", "iPhone 14 Pro", "iPhone 14 Pro Max", "iPhone 15", "iPhone 15 Pro", "iPhone 15 Pro Max",
    "iPhone 16", "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone SE (2022)",
  ],
  Samsung: [
    "Galaxy A14", "Galaxy A15", "Galaxy A24", "Galaxy A34", "Galaxy A54", "Galaxy A55",
    "Galaxy S22", "Galaxy S23", "Galaxy S23 Ultra", "Galaxy S24", "Galaxy S24 Ultra", "Galaxy Note 20",
  ],
  Xiaomi: ["Redmi Note 12", "Redmi Note 13", "Redmi Note 13 Pro", "Redmi 13C", "Poco X6", "Xiaomi 13T"],
  Huawei: ["P30", "P40", "Nova 11", "Y9 Prime"],
  Oppo: ["A78", "Reno 10"],
  Infinix: ["Hot 40", "Note 30"],
  Tecno: ["Spark 20", "Camon 20"],
  Google: ["Pixel 7", "Pixel 8"],
};

async function upsertUser(email: string, name: string, opts: { shopId?: string; role?: Role; isSuperAdmin?: boolean }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email,
      name,
      emailVerified: true,
      shopId: opts.shopId,
      role: opts.role ?? "CASHIER",
      isSuperAdmin: opts.isSuperAdmin ?? false,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(DEV_PASSWORD) },
      },
    },
  });
}

async function upsertShop(slug: string, name: string) {
  const shop = await prisma.shop.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name,
      phone: "+9611234567",
      address: "Hamra Street, Beirut",
      subscriptionStatus: "TRIAL",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      termsText: "Devices not collected within 60 days may be disposed of. We are not responsible for data loss.",
      termsTextAr: "الأجهزة غير المستلمة خلال 60 يوماً قد يتم التخلص منها. نحن غير مسؤولين عن فقدان البيانات.",
      receiptFooter: "Thank you for your visit!",
      receiptFooterAr: "شكراً لزيارتكم!",
    },
  });
  await prisma.$transaction((tx) => applyShopDefaults(tx, shop.id));
  return shop;
}

async function main() {
  // Platform settings: product name, landing contact, showcase shop, defaults for new shops.
  await prisma.platformSetting.upsert({
    where: { id: "platform" },
    update: {},
    create: {
      id: "platform",
      appName: process.env.APP_NAME || "InChouf",
      contactWhatsapp: process.env.CONTACT_WHATSAPP || null,
      contactEmail: process.env.CONTACT_EMAIL || null,
      showcaseShopSlug: "demo",
      defaultTemplates: DEFAULT_TEMPLATES,
      defaultPresets: DEFAULT_PRESETS,
    },
  });
  await prisma.plan.upsert({
    where: { id: "plan_basic" },
    update: {},
    create: { id: "plan_basic", name: "Basic", priceUsdCents: 2500, maxStaff: 5 },
  });

  for (const [brandName, models] of Object.entries(CATALOG)) {
    const brand =
      (await prisma.deviceBrand.findFirst({ where: { shopId: null, name: brandName } })) ??
      (await prisma.deviceBrand.create({ data: { name: brandName } }));
    for (const name of models) {
      await prisma.deviceModel.upsert({
        where: { brandId_name: { brandId: brand.id, name } },
        update: {},
        create: { brandId: brand.id, name },
      });
    }
  }

  await upsertUser(ADMIN_EMAIL, "Platform Admin", { isSuperAdmin: true });

  const demo = await upsertShop("demo", "FixIt Mobile");
  const owner = await upsertUser("owner@demo.local", "Rami Haddad", { shopId: demo.id, role: "OWNER" });
  await upsertUser("tech@demo.local", "Karim Nassar", { shopId: demo.id, role: "TECHNICIAN" });
  await upsertUser("cashier@demo.local", "Maya Khoury", { shopId: demo.id, role: "CASHIER" });
  if (!(await prisma.exchangeRate.findFirst({ where: { shopId: demo.id } }))) {
    await prisma.exchangeRate.create({ data: { shopId: demo.id, rate: demo.exchangeRate, setById: owner.id } });
  }

  const tech2 = await upsertUser("tech2@demo.local", "Ali Fawaz", { shopId: demo.id, role: "TECHNICIAN" });
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: "tech@demo.local" } });
  const cashier = await prisma.user.findUniqueOrThrow({ where: { email: "cashier@demo.local" } });

  // Demo shop is a paying customer so every feature is unlocked during demos.
  await prisma.shop.update({
    where: { id: demo.id },
    data: { planId: "plan_basic", subscriptionStatus: "ACTIVE", paidUntil: new Date(Date.now() + 365 * 86_400_000), address: "Hamra Street, near Wimpy, Beirut", phone: "+9611345678" },
  });

  // Rich demo data only on a fresh database (run `pnpm db:reset` to regenerate).
  if ((await prisma.ticket.count({ where: { shopId: demo.id } })) === 0) {
    const stats = await seedDemoData({
      prisma,
      shopId: demo.id,
      rate: 89500,
      ownerId: owner.id,
      techIds: [tech.id, tech2.id],
      cashierId: cashier.id,
    });
    console.log("Demo data:", stats);
  } else {
    console.log("Demo shop already has data; skipping demo generation.");
  }

  if (!isProd) {
    const other = await upsertShop("other", "Phone Doctor");
    await upsertUser("owner@other.local", "Other Owner", { shopId: other.id, role: "OWNER" });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
