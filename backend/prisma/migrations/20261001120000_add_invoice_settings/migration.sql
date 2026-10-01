CREATE TABLE "invoice_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "template" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_settings_singleton" CHECK ("id" = 1)
);
