CREATE TYPE "StatutRemboursementPaiement" AS ENUM ('EN_COURS', 'TERMINE', 'ECHEC');

CREATE TABLE "payment_refunds" (
  "id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "dispute_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "statut" "StatutRemboursementPaiement" NOT NULL DEFAULT 'EN_COURS',
  "provider_ref" VARCHAR(200),
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_refunds_dispute_id_key" ON "payment_refunds"("dispute_id");
CREATE UNIQUE INDEX "payment_refunds_idempotency_key_key" ON "payment_refunds"("idempotency_key");
CREATE INDEX "payment_refunds_payment_id_statut_idx" ON "payment_refunds"("payment_id", "statut");

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
