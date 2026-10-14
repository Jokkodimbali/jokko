-- A cancellation refund has no dispute. Some databases recorded the earlier
-- migration without actually dropping this NOT NULL constraint.
ALTER TABLE "payment_refunds"
  ALTER COLUMN "dispute_id" DROP NOT NULL;
