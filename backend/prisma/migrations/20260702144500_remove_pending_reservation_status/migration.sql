-- Convert legacy pending reservations before removing the enum value.
UPDATE "bookings"
SET "statut" = 'CONFIRMEE', "updated_at" = NOW()
WHERE "statut" = 'EN_ATTENTE';

ALTER TABLE "bookings"
ALTER COLUMN "statut" SET DEFAULT 'CONFIRMEE';

ALTER TYPE "StatutReservation" RENAME TO "StatutReservation_old";

CREATE TYPE "StatutReservation" AS ENUM (
  'CONFIRMEE',
  'PAYEE_SEQUESTRE',
  'EN_COURS',
  'TERMINEE',
  'ANNULEE',
  'NO_SHOW',
  'LITIGE'
);

ALTER TABLE "bookings"
ALTER COLUMN "statut" DROP DEFAULT;

ALTER TABLE "bookings"
ALTER COLUMN "statut" TYPE "StatutReservation"
USING "statut"::text::"StatutReservation";

ALTER TABLE "bookings"
ALTER COLUMN "statut" SET DEFAULT 'CONFIRMEE';

DROP TYPE "StatutReservation_old";
