-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "storageFeeUsdCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageFreeDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "pickupRemindedAt" TIMESTAMP(3),
ADD COLUMN     "pickupReminders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storageItemId" TEXT;

