CREATE TYPE "StatutAjustementPrixReservation" AS ENUM (
  'AUCUN',
  'EN_ATTENTE_CLIENT',
  'ACCEPTE',
  'REFUSE'
);

ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'AJUSTEMENT_PRIX_PROPOSE';
ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'AJUSTEMENT_PRIX_ACCEPTE';
ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'AJUSTEMENT_PRIX_REFUSE';

ALTER TABLE "bookings"
ADD COLUMN "price_adjustment_status" "StatutAjustementPrixReservation" NOT NULL DEFAULT 'AUCUN',
ADD COLUMN "proposed_adjusted_price" DECIMAL(10, 2),
ADD COLUMN "price_adjustment_reason" TEXT,
ADD COLUMN "price_adjustment_requested_at" TIMESTAMP(3);

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_price_adjustment_amount_positive_check"
CHECK (
  "proposed_adjusted_price" IS NULL
  OR "proposed_adjusted_price" > 0
);

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_price_adjustment_pending_payload_check"
CHECK (
  (
    "price_adjustment_status" = 'AUCUN'
    AND "proposed_adjusted_price" IS NULL
    AND "price_adjustment_requested_at" IS NULL
  )
  OR (
    "price_adjustment_status" IN ('EN_ATTENTE_CLIENT', 'ACCEPTE', 'REFUSE')
    AND "proposed_adjusted_price" IS NOT NULL
    AND "price_adjustment_requested_at" IS NOT NULL
  )
);
