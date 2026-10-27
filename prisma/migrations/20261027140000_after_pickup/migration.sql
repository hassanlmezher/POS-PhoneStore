-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "googleReviewUrl" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "checkSentAt" TIMESTAMP(3),
ADD COLUMN     "reviewAskedAt" TIMESTAMP(3);

