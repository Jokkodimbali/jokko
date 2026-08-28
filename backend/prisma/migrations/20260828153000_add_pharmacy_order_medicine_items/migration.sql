ALTER TABLE "pharmacy_orders"
  ADD COLUMN "medicine_items" JSONB NOT NULL DEFAULT '[]'::jsonb;
