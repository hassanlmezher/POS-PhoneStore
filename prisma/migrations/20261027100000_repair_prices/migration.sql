-- CreateTable
CREATE TABLE "RepairPrice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "deviceModelId" TEXT,
    "service" TEXT NOT NULL,
    "priceUsdCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairPrice_shopId_deviceModelId_idx" ON "RepairPrice"("shopId", "deviceModelId");

-- AddForeignKey
ALTER TABLE "RepairPrice" ADD CONSTRAINT "RepairPrice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPrice" ADD CONSTRAINT "RepairPrice_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One price per model + service (case-insensitive); "any model" counts as its own model.
CREATE UNIQUE INDEX "RepairPrice_shop_model_service_key" ON "RepairPrice"("shopId", COALESCE("deviceModelId", ''), lower("service"));

-- Keep the Supabase REST API out (the app connects as table owner).
ALTER TABLE "RepairPrice" ENABLE ROW LEVEL SECURITY;
