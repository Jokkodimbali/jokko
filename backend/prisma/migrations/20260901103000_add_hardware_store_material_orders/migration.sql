CREATE TYPE "StatutCommandeMateriel" AS ENUM (
  'EN_ATTENTE_QUINCAILLERIE',
  'PARTIELLEMENT_DISPONIBLE',
  'INDISPONIBLE',
  'EN_ATTENTE_PAIEMENT',
  'PAYEE_QUINCAILLERIE',
  'EN_ATTENTE_TRANSPORTEUR',
  'TRANSPORTEUR_ASSIGNE',
  'EN_LIVRAISON',
  'LIVREE',
  'ANNULEE'
);

ALTER TYPE "TypeTransactionPortefeuille"
  ADD VALUE IF NOT EXISTS 'CREDIT_QUINCAILLERIE';

ALTER TABLE "professional_profiles"
  ADD COLUMN "is_hardware_store" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "material_orders" (
  "id" UUID NOT NULL,
  "source_booking_id" UUID NOT NULL,
  "delivery_booking_id" UUID,
  "client_id" UUID NOT NULL,
  "hardware_store_id" UUID NOT NULL,
  "statut" "StatutCommandeMateriel" NOT NULL DEFAULT 'EN_ATTENTE_QUINCAILLERIE',
  "material_amount" DECIMAL(12,2),
  "delivery_requested" BOOLEAN NOT NULL DEFAULT false,
  "delivery_amount" DECIMAL(12,2),
  "delivery_distance_km" DECIMAL(8,2),
  "delivery_address" TEXT,
  "material_items" JSONB NOT NULL DEFAULT '[]',
  "hardware_store_note" TEXT,
  "indisponibilites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "validated_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_order_payments" (
  "id" UUID NOT NULL,
  "material_order_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "hardware_store_id" UUID NOT NULL,
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
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_order_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "material_orders_source_booking_id_hardware_store_id_key"
  ON "material_orders"("source_booking_id", "hardware_store_id");
CREATE UNIQUE INDEX "material_orders_delivery_booking_id_key"
  ON "material_orders"("delivery_booking_id");
CREATE INDEX "material_orders_client_id_statut_created_at_idx"
  ON "material_orders"("client_id", "statut", "created_at");
CREATE INDEX "material_orders_hardware_store_id_statut_created_at_idx"
  ON "material_orders"("hardware_store_id", "statut", "created_at");
CREATE INDEX "material_orders_source_booking_id_created_at_idx"
  ON "material_orders"("source_booking_id", "created_at");

CREATE UNIQUE INDEX "material_order_payments_material_order_id_key"
  ON "material_order_payments"("material_order_id");
CREATE UNIQUE INDEX "material_order_payments_idempotency_key_key"
  ON "material_order_payments"("idempotency_key");
CREATE UNIQUE INDEX "material_order_payments_transaction_ref_key"
  ON "material_order_payments"("transaction_ref");
CREATE UNIQUE INDEX "material_order_payments_gateway_ref_key"
  ON "material_order_payments"("gateway_ref");
CREATE INDEX "material_order_payments_client_id_created_at_idx"
  ON "material_order_payments"("client_id", "created_at");
CREATE INDEX "material_order_payments_hardware_store_id_created_at_idx"
  ON "material_order_payments"("hardware_store_id", "created_at");
CREATE INDEX "material_order_payments_statut_created_at_idx"
  ON "material_order_payments"("statut", "created_at");

ALTER TABLE "material_orders"
  ADD CONSTRAINT "material_orders_source_booking_id_fkey"
  FOREIGN KEY ("source_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_orders_delivery_booking_id_fkey"
  FOREIGN KEY ("delivery_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "material_orders_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "material_orders_hardware_store_id_fkey"
  FOREIGN KEY ("hardware_store_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_order_payments"
  ADD CONSTRAINT "material_order_payments_material_order_id_fkey"
  FOREIGN KEY ("material_order_id") REFERENCES "material_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_order_payments_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_order_payments_hardware_store_id_fkey"
  FOREIGN KEY ("hardware_store_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "professional_profiles" AS profile
SET "is_hardware_store" = true
FROM "professional_specialties" AS specialty
INNER JOIN "service_subcategories" AS subcategory
  ON subcategory."id" = specialty."subcategory_id"
WHERE specialty."professional_id" = profile."id"
  AND subcategory."name" ILIKE '%quincailler%';
