-- AlterTable
ALTER TABLE "audit_logs"
ADD COLUMN "user_name" VARCHAR(100),
ADD COLUMN "latitude" DECIMAL(10, 7),
ADD COLUMN "longitude" DECIMAL(10, 7),
ADD COLUMN "location_label" VARCHAR(255);
