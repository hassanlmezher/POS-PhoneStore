-- "Approve the new price" requests sent to customers as a WhatsApp link.
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PriceApproval" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amountUsdCents" INTEGER NOT NULL,
    "previousUsdCents" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "PriceApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceApproval_token_key" ON "PriceApproval"("token");

-- CreateIndex
CREATE INDEX "PriceApproval_shopId_ticketId_idx" ON "PriceApproval"("shopId", "ticketId");

-- CreateIndex
CREATE INDEX "PriceApproval_shopId_status_idx" ON "PriceApproval"("shopId", "status");

-- AddForeignKey
ALTER TABLE "PriceApproval" ADD CONSTRAINT "PriceApproval_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceApproval" ADD CONSTRAINT "PriceApproval_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceApproval" ADD CONSTRAINT "PriceApproval_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Not reachable through Supabase's public REST API; the app connects as the table owner.
ALTER TABLE "PriceApproval" ENABLE ROW LEVEL SECURITY;
