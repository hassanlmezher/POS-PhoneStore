-- CreateEnum
CREATE TYPE "TicketMediaKind" AS ENUM ('PHOTO', 'SIGNATURE');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "checklist" JSONB;

-- CreateTable
CREATE TABLE "TicketMedia" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "kind" "TicketMediaKind" NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketMedia_shopId_ticketId_idx" ON "TicketMedia"("shopId", "ticketId");

-- AddForeignKey
ALTER TABLE "TicketMedia" ADD CONSTRAINT "TicketMedia_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMedia" ADD CONSTRAINT "TicketMedia_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMedia" ADD CONSTRAINT "TicketMedia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep the Supabase REST API out (the app connects as table owner).
ALTER TABLE "TicketMedia" ENABLE ROW LEVEL SECURITY;
