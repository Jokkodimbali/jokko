-- Existing EN_COURS bookings were started before the explicit timestamp existed.
UPDATE "bookings"
SET "work_started_at" = "updated_at"
WHERE "statut" = 'EN_COURS' AND "work_started_at" IS NULL;
