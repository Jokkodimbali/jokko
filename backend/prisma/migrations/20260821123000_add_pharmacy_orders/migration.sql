CREATE TYPE "StatutCommandePharmacie" AS ENUM (
  'EN_ATTENTE_PHARMACIE',
  'PARTIELLEMENT_DISPONIBLE',
  'INDISPONIBLE',
  'EN_ATTENTE_PAIEMENT',
  'PAYEE_PHARMACIE',
  'EN_ATTENTE_TRANSPORTEUR',
  'TRANSPORTEUR_ASSIGNE',
  'EN_LIVRAISON',
  'LIVREE',
  'ANNULEE'
);

CREATE TABLE "pharmacy_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "medical_booking_id" UUID NOT NULL,
  "delivery_booking_id" UUID,
  "client_id" UUID NOT NULL,
  "pharmacy_id" UUID NOT NULL,
  "statut" "StatutCommandePharmacie" NOT NULL DEFAULT 'EN_ATTENTE_PHARMACIE',
  "medicine_amount" DECIMAL(12,2),
  "pharmacy_note" TEXT,
  "indisponibilites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "validated_by_pharmacy_at" TIMESTAMP(3),
  "paid_to_pharmacy_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pharmacy_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pharmacy_orders_delivery_booking_id_key" ON "pharmacy_orders"("delivery_booking_id");
CREATE INDEX "pharmacy_orders_client_id_statut_created_at_idx" ON "pharmacy_orders"("client_id", "statut", "created_at");
CREATE INDEX "pharmacy_orders_pharmacy_id_statut_created_at_idx" ON "pharmacy_orders"("pharmacy_id", "statut", "created_at");
CREATE INDEX "pharmacy_orders_medical_booking_id_created_at_idx" ON "pharmacy_orders"("medical_booking_id", "created_at");

ALTER TABLE "pharmacy_orders"
  ADD CONSTRAINT "pharmacy_orders_medical_booking_id_fkey"
  FOREIGN KEY ("medical_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pharmacy_orders_delivery_booking_id_fkey"
  FOREIGN KEY ("delivery_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "pharmacy_orders_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "pharmacy_orders_pharmacy_id_fkey"
  FOREIGN KEY ("pharmacy_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
