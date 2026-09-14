ALTER TABLE "delivery_pricing_settings"
  ADD COLUMN "price_per_km" DECIMAL(12,2) NOT NULL DEFAULT 500;

UPDATE "delivery_pricing_settings"
SET "price_per_km" = "pharmacy_price_per_km";

ALTER TABLE "delivery_pricing_settings"
  DROP CONSTRAINT "delivery_pricing_settings_prices_nonnegative",
  DROP COLUMN "pharmacy_price_per_km",
  DROP COLUMN "material_price_per_km";

ALTER TABLE "delivery_pricing_settings"
  ADD CONSTRAINT "delivery_pricing_settings_price_nonnegative"
  CHECK ("price_per_km" >= 0);
