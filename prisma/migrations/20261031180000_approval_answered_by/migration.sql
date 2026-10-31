-- AlterTable
ALTER TABLE "PriceApproval" ADD COLUMN     "answeredById" TEXT;

-- AddForeignKey
ALTER TABLE "PriceApproval" ADD CONSTRAINT "PriceApproval_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

