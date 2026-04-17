ALTER TABLE "professional_profiles"
  RENAME COLUMN "id_card_url" TO "id_card_url_recto";

ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "id_card_url_verso" VARCHAR(500);

ALTER TABLE "bookings"
  RENAME COLUMN "scheduled_at" TO "date_time";

ALTER TABLE "bookings"
  RENAME COLUMN "client_notes" TO "notes";

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "professional_id" UUID;

UPDATE "bookings" AS b
SET "professional_id" = s."professional_id"
FROM "services" AS s
WHERE b."service_id" = s."id"
  AND b."professional_id" IS NULL;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "bookings"
SET "updated_at" = "created_at"
WHERE "updated_at" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_professional_id_fkey'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_professional_id_fkey"
      FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
