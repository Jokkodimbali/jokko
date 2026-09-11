CREATE TABLE "delivery_pricing_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "pharmacy_price_per_km" DECIMAL(12,2) NOT NULL DEFAULT 500,
  "material_price_per_km" DECIMAL(12,2) NOT NULL DEFAULT 500,
  "courier_commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_pricing_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_pricing_settings_singleton" CHECK ("id" = 1),
  CONSTRAINT "delivery_pricing_settings_prices_nonnegative" CHECK ("pharmacy_price_per_km" >= 0 AND "material_price_per_km" >= 0),
  CONSTRAINT "delivery_pricing_settings_commission_range" CHECK ("courier_commission_rate" >= 0 AND "courier_commission_rate" <= 100)
);

INSERT INTO "delivery_pricing_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
