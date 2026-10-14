-- An earlier migration may be recorded as applied on databases where its
-- column was subsequently lost. Restore the column required by refundForCancellation.
ALTER TABLE "payment_refunds"
  ADD COLUMN IF NOT EXISTS "cancellation_reservation_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_cancellation_reservation_id_key"
  ON "payment_refunds"("cancellation_reservation_id");
