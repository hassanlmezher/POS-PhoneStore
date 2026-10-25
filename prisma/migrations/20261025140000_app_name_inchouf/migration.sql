-- Product name: RepairPOS → InChouf (default and the existing platform row, unless already renamed).
ALTER TABLE "PlatformSetting" ALTER COLUMN "appName" SET DEFAULT 'InChouf';
UPDATE "PlatformSetting" SET "appName" = 'InChouf' WHERE "appName" = 'RepairPOS';
