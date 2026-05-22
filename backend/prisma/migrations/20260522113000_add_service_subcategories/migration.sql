CREATE TABLE "service_subcategories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_subcategories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "category_service_subcategories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "subcategory_id" UUID NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_service_subcategories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_subcategories_name_key" ON "service_subcategories"("name");
CREATE UNIQUE INDEX "category_service_subcategories_category_id_subcategory_id_key" ON "category_service_subcategories"("category_id", "subcategory_id");
CREATE INDEX "category_service_subcategories_subcategory_id_idx" ON "category_service_subcategories"("subcategory_id");

ALTER TABLE "category_service_subcategories"
ADD CONSTRAINT "category_service_subcategories_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_service_subcategories"
ADD CONSTRAINT "category_service_subcategories_subcategory_id_fkey"
FOREIGN KEY ("subcategory_id") REFERENCES "service_subcategories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
