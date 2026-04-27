CREATE TYPE "StatutNegotiation" AS ENUM (
  'EN_ATTENTE_PRESTATAIRE',
  'EN_ATTENTE_CLIENT',
  'ACCEPTEE',
  'REFUSEE',
  'ANNULEE',
  'CONVERTIE_EN_RESERVATION'
);

CREATE TYPE "RoleNegociateur" AS ENUM ('CLIENT', 'PRESTATAIRE');

CREATE TABLE "negotiations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "statut" "StatutNegotiation" NOT NULL DEFAULT 'EN_ATTENTE_PRESTATAIRE',
  "initial_amount" DECIMAL(10, 2) NOT NULL,
  "current_amount" DECIMAL(10, 2) NOT NULL,
  "accepted_amount" DECIMAL(10, 2),
  "last_proposed_by" "RoleNegociateur" NOT NULL,
  "current_message" TEXT,
  "close_reason" TEXT,
  "booking_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "negotiation_offers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "negotiation_id" UUID NOT NULL,
  "proposed_by" "RoleNegociateur" NOT NULL,
  "montant" DECIMAL(10, 2) NOT NULL,
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "negotiation_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "negotiations_booking_id_key" ON "negotiations"("booking_id");
CREATE INDEX "negotiations_client_id_statut_created_at_idx" ON "negotiations"("client_id", "statut", "created_at");
CREATE INDEX "negotiations_professional_id_statut_created_at_idx" ON "negotiations"("professional_id", "statut", "created_at");
CREATE INDEX "negotiations_service_id_created_at_idx" ON "negotiations"("service_id", "created_at");
CREATE INDEX "negotiation_offers_negotiation_id_created_at_idx" ON "negotiation_offers"("negotiation_id", "created_at");

ALTER TABLE "negotiations"
ADD CONSTRAINT "negotiations_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "negotiations"
ADD CONSTRAINT "negotiations_professional_id_fkey"
FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "negotiations"
ADD CONSTRAINT "negotiations_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "negotiations"
ADD CONSTRAINT "negotiations_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "negotiation_offers"
ADD CONSTRAINT "negotiation_offers_negotiation_id_fkey"
FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
