-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "comebackOfId" TEXT;

-- CreateIndex
CREATE INDEX "Ticket_shopId_comebackOfId_idx" ON "Ticket"("shopId", "comebackOfId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_comebackOfId_fkey" FOREIGN KEY ("comebackOfId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

