-- CreateEnum
CREATE TYPE "PartOrderStatus" AS ENUM ('ORDERED', 'ARRIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PartOrder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "supplierName" TEXT NOT NULL,
    "supplierPhone" TEXT,
    "costUsdCents" INTEGER,
    "status" "PartOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "supplierSentAt" TIMESTAMP(3),
    "customerToldAt" TIMESTAMP(3),
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartOrder_shopId_status_expectedAt_idx" ON "PartOrder"("shopId", "status", "expectedAt");

-- CreateIndex
CREATE INDEX "PartOrder_shopId_ticketId_idx" ON "PartOrder"("shopId", "ticketId");

-- AddForeignKey
ALTER TABLE "PartOrder" ADD CONSTRAINT "PartOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOrder" ADD CONSTRAINT "PartOrder_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOrder" ADD CONSTRAINT "PartOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep the Supabase REST API out (the app connects as table owner).
ALTER TABLE "PartOrder" ENABLE ROW LEVEL SECURITY;
