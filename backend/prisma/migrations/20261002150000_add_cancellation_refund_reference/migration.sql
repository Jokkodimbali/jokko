ALTER TABLE "payment_refunds"
  ALTER COLUMN "dispute_id" DROP NOT NULL,
  ADD COLUMN "cancellation_reservation_id" UUID;

CREATE UNIQUE INDEX "payment_refunds_cancellation_reservation_id_key"
  ON "payment_refunds"("cancellation_reservation_id");
