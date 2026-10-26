-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'GENERATOR', 'ELECTRICITY', 'SALARIES', 'INTERNET', 'SUPPLIES', 'OTHER');

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "note" TEXT,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "usdCentsEquivalent" INTEGER NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "cashMovementId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Expense_cashMovementId_key" ON "Expense"("cashMovementId");

-- CreateIndex
CREATE INDEX "Expense_shopId_spentAt_idx" ON "Expense"("shopId", "spentAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Keep the Supabase REST API out (the app connects as table owner).
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
