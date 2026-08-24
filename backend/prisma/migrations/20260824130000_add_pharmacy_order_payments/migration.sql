ALTER TYPE "TypeTransactionPortefeuille" ADD VALUE IF NOT EXISTS 'CREDIT_PHARMACIE';

CREATE TABLE "pharmacy_order_payments" (
    "id" UUID NOT NULL,
    "pharmacy_order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "pharmacy_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "MethodePaiement" NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "idempotency_key" VARCHAR(160) NOT NULL,
    "transaction_ref" VARCHAR(200) NOT NULL,
    "gateway_ref" VARCHAR(200),
    "payment_url" TEXT,
    "erreur" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pharmacy_order_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pharmacy_order_payments_pharmacy_order_id_key" ON "pharmacy_order_payments"("pharmacy_order_id");
CREATE UNIQUE INDEX "pharmacy_order_payments_idempotency_key_key" ON "pharmacy_order_payments"("idempotency_key");
CREATE UNIQUE INDEX "pharmacy_order_payments_transaction_ref_key" ON "pharmacy_order_payments"("transaction_ref");
CREATE UNIQUE INDEX "pharmacy_order_payments_gateway_ref_key" ON "pharmacy_order_payments"("gateway_ref");
CREATE INDEX "pharmacy_order_payments_client_id_created_at_idx" ON "pharmacy_order_payments"("client_id", "created_at");
CREATE INDEX "pharmacy_order_payments_pharmacy_id_created_at_idx" ON "pharmacy_order_payments"("pharmacy_id", "created_at");
CREATE INDEX "pharmacy_order_payments_statut_created_at_idx" ON "pharmacy_order_payments"("statut", "created_at");

ALTER TABLE "pharmacy_order_payments"
  ADD CONSTRAINT "pharmacy_order_payments_pharmacy_order_id_fkey"
  FOREIGN KEY ("pharmacy_order_id") REFERENCES "pharmacy_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pharmacy_order_payments"
  ADD CONSTRAINT "pharmacy_order_payments_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pharmacy_order_payments"
  ADD CONSTRAINT "pharmacy_order_payments_pharmacy_id_fkey"
  FOREIGN KEY ("pharmacy_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
