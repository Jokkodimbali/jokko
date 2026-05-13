CREATE TABLE IF NOT EXISTS "saved_payment_methods" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "label" VARCHAR(80),
  "masked_value" VARCHAR(80) NOT NULL,
  "holder_name" VARCHAR(100),
  "expiry_month" INTEGER,
  "expiry_year" INTEGER,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_payment_methods_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_payment_methods_type_check"
    CHECK ("type" IN ('CARD', 'WAVE', 'OTHER')),
  CONSTRAINT "saved_payment_methods_expiry_month_check"
    CHECK ("expiry_month" IS NULL OR ("expiry_month" >= 1 AND "expiry_month" <= 12))
);

CREATE INDEX IF NOT EXISTS "saved_payment_methods_user_id_type_idx"
  ON "saved_payment_methods"("user_id", "type");
