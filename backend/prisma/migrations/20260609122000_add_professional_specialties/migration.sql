CREATE TABLE "professional_specialties" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "subcategory_id" UUID NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "professional_specialties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_specialties_professional_id_category_id_subcategory_id_key"
ON "professional_specialties"("professional_id", "category_id", "subcategory_id");

CREATE INDEX "professional_specialties_professional_id_idx"
ON "professional_specialties"("professional_id");

CREATE INDEX "professional_specialties_category_id_idx"
ON "professional_specialties"("category_id");

CREATE INDEX "professional_specialties_subcategory_id_idx"
ON "professional_specialties"("subcategory_id");

ALTER TABLE "professional_specialties"
ADD CONSTRAINT "professional_specialties_professional_id_fkey"
FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_specialties"
ADD CONSTRAINT "professional_specialties_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_specialties"
ADD CONSTRAINT "professional_specialties_subcategory_id_fkey"
FOREIGN KEY ("subcategory_id") REFERENCES "service_subcategories"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
