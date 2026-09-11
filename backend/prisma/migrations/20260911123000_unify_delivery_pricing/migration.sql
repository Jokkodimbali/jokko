ALTER TABLE "delivery_pricing_settings"
  ADD COLUMN "price_per_km" DECIMAL(12,2) NOT NULL DEFAULT 500;

UPDATE "delivery_pricing_settings"
SET "price_per_km" = "pharmacy_price_per_km";

ALTER TABLE "delivery_pricing_settings"
  DROP COLUMN "pharmacy_price_per_km",
  DROP COLUMN "material_price_per_km";
