ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'ANNONCE_ADMIN';

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "commission_rate" DECIMAL(5, 2) NOT NULL DEFAULT 10.00;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_commission_rate_range_chk'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_commission_rate_range_chk"
      CHECK ("commission_rate" >= 0 AND "commission_rate" <= 100);
  END IF;
END $$;
