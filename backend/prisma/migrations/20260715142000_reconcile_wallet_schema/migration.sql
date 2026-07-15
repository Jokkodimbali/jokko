-- Reconcile wallet schema objects required by /payments/wallet.

DO $$ BEGIN
  CREATE TYPE "StatutRetrait" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ECHEC', 'ANNULE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EscrowStatus" AS ENUM ('LOCKED', 'RELEASED', 'DISPUTED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "client_id" UUID,
  ADD COLUMN IF NOT EXISTS "professional_id" UUID,
  ADD COLUMN IF NOT EXISTS "transaction_ref" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "gateway_ref" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escrowStatus" "EscrowStatus" NOT NULL DEFAULT 'LOCKED',
  ADD COLUMN IF NOT EXISTS "escrow_released_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disputed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "payments" AS p
SET
  "client_id" = b."client_id",
  "professional_id" = b."professional_id"
FROM "bookings" AS b
WHERE p."booking_id" = b."id"
  AND (p."client_id" IS NULL OR p."professional_id" IS NULL);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "payments" WHERE "client_id" IS NULL OR "professional_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot reconcile payments actors: some payments are not linked to a valid booking actor';
  END IF;
END $$;

ALTER TABLE "payments"
  ALTER COLUMN "client_id" SET NOT NULL,
  ALTER COLUMN "professional_id" SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_client_id_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_professional_id_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_professional_id_fkey"
      FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "MethodePaiement" NOT NULL,
  "statut" "StatutRetrait" NOT NULL DEFAULT 'EN_ATTENTE',
  "provider_ref" VARCHAR(200),
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_professional_id_fkey'
  ) THEN
    ALTER TABLE "withdrawal_requests"
      ADD CONSTRAINT "withdrawal_requests_professional_id_fkey"
      FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payments_client_id_created_at_idx"
ON "payments"("client_id", "created_at");

CREATE INDEX IF NOT EXISTS "payments_professional_id_created_at_idx"
ON "payments"("professional_id", "created_at");

CREATE INDEX IF NOT EXISTS "payments_status_escrowStatus_idx"
ON "payments"("statut", "escrowStatus");

CREATE INDEX IF NOT EXISTS "payments_transaction_ref_idx"
ON "payments"("transaction_ref");

CREATE INDEX IF NOT EXISTS "payments_gateway_ref_idx"
ON "payments"("gateway_ref");

CREATE INDEX IF NOT EXISTS "withdrawal_requests_professional_id_requested_at_idx"
ON "withdrawal_requests"("professional_id", "requested_at");

CREATE INDEX IF NOT EXISTS "withdrawal_requests_status_requested_at_idx"
ON "withdrawal_requests"("statut", "requested_at");
