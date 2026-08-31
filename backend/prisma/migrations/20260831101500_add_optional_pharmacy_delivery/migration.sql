ALTER TABLE "pharmacy_orders"
  ADD COLUMN "delivery_requested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "delivery_amount" DECIMAL(12, 2),
  ADD COLUMN "delivery_distance_km" DECIMAL(8, 2),
  ADD COLUMN "delivery_address" TEXT;
