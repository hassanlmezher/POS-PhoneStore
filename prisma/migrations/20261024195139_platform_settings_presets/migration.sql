-- CreateEnum
CREATE TYPE "PresetKind" AS ENUM ('PROBLEM', 'PAY_IN', 'PAY_OUT');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "countryCode" TEXT NOT NULL DEFAULT '961',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Beirut';

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "appName" TEXT NOT NULL DEFAULT 'RepairPOS',
    "contactWhatsapp" TEXT,
    "contactEmail" TEXT,
    "showcaseShopSlug" TEXT,
    "defaultTemplates" JSONB,
    "defaultPresets" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPreset" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" "PresetKind" NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopPreset_shopId_kind_sort_idx" ON "ShopPreset"("shopId", "kind", "sort");

-- AddForeignKey
ALTER TABLE "ShopPreset" ADD CONSTRAINT "ShopPreset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New tables are locked behind RLS like all others (see 20261024180000_enable_rls).
ALTER TABLE "PlatformSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShopPreset" ENABLE ROW LEVEL SECURITY;
