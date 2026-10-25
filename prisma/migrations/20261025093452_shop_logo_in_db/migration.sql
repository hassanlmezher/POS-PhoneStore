-- CreateTable
CREATE TABLE "ShopLogo" (
    "shopId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopLogo_pkey" PRIMARY KEY ("shopId")
);

-- AddForeignKey
ALTER TABLE "ShopLogo" ADD CONSTRAINT "ShopLogo_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Locked behind RLS like every other table.
ALTER TABLE "ShopLogo" ENABLE ROW LEVEL SECURITY;
-- Logos used to live on local disk; shops without a stored logo fall back to their initials.
UPDATE "Shop" SET "logoUrl" = NULL WHERE "logoUrl" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ShopLogo" l WHERE l."shopId" = "Shop".id);
