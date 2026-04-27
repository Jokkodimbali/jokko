-- Harden payments with idempotency, webhook journal and wallet ledger.

DO $$ BEGIN
  CREATE TYPE "StatutIdempotence" AS ENUM ('EN_COURS', 'TERMINE', 'ECHEC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatutWebhookPaiement" AS ENUM ('RECU', 'TRAITE', 'ECHEC', 'IGNORE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TypeTransactionPortefeuille" AS ENUM ('CREDIT_ESCROW', 'DEBIT_RETRAIT', 'REMBOURSEMENT', 'COMMISSION', 'AJUSTEMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(160) NOT NULL,
  "scope" VARCHAR(100) NOT NULL,
  "request_hash" VARCHAR(128) NOT NULL,
  "status" "StatutIdempotence" NOT NULL DEFAULT 'EN_COURS',
  "response" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_key_key" ON "idempotency_keys"("key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_scope_expires_at_idx" ON "idempotency_keys"("scope", "expires_at");
CREATE INDEX IF NOT EXISTS "idempotency_keys_status_expires_at_idx" ON "idempotency_keys"("status", "expires_at");

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_key" VARCHAR(220) NOT NULL,
  "provider" VARCHAR(80) NOT NULL,
  "provider_ref" VARCHAR(200) NOT NULL,
  "provider_status" VARCHAR(80) NOT NULL,
  "signature_valid" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "status" "StatutWebhookPaiement" NOT NULL DEFAULT 'RECU',
  "error" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_event_key_key" ON "payment_webhook_events"("event_key");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_provider_ref_idx" ON "payment_webhook_events"("provider_ref");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_status_received_at_idx" ON "payment_webhook_events"("status", "received_at");

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_id" UUID NOT NULL,
  "payment_id" UUID,
  "type" "TypeTransactionPortefeuille" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balance_after" DECIMAL(12,2) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" VARCHAR(220) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_transactions_reference_key" ON "wallet_transactions"("reference");
CREATE INDEX IF NOT EXISTS "wallet_transactions_professional_id_created_at_idx" ON "wallet_transactions"("professional_id", "created_at");
CREATE INDEX IF NOT EXISTS "wallet_transactions_payment_id_idx" ON "wallet_transactions"("payment_id");

CREATE INDEX IF NOT EXISTS "payments_status_escrowStatus_idx" ON "payments"("statut", "escrowStatus");
CREATE INDEX IF NOT EXISTS "payments_transaction_ref_idx" ON "payments"("transaction_ref");
CREATE INDEX IF NOT EXISTS "payments_provider_ref_idx" ON "payments"("provider_ref");
CREATE INDEX IF NOT EXISTS "payments_gateway_ref_idx" ON "payments"("gateway_ref");

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_professional_id_fkey"
  FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
