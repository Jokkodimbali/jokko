-- Reconcile the physical conversations table with the direct-message model.
-- Direct conversations are allowed without a booking, but historical migrations
-- could leave booking_id as NOT NULL on deployed databases.

ALTER TABLE "conversations"
  ALTER COLUMN "booking_id" DROP NOT NULL;

-- The Prisma schema expects ids to be generated when callers do not provide one.
-- Older initial migrations created these UUID columns without a database default.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "conversations"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "messages"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Keep one conversation per booking and one direct thread per client/provider.
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_booking_id_key"
  ON "conversations"("booking_id")
  WHERE "booking_id" IS NOT NULL;

DROP INDEX IF EXISTS "conversations_client_id_professional_id_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_client_professional_unique"
  ON "conversations"("client_id", "professional_id");
