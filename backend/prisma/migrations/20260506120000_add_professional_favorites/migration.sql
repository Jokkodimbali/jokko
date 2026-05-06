CREATE TABLE "professional_favorites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "professional_favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_favorites_user_id_professional_id_key"
  ON "professional_favorites"("user_id", "professional_id");

CREATE INDEX "professional_favorites_user_id_created_at_idx"
  ON "professional_favorites"("user_id", "created_at");

CREATE INDEX "professional_favorites_professional_id_idx"
  ON "professional_favorites"("professional_id");

ALTER TABLE "professional_favorites"
  ADD CONSTRAINT "professional_favorites_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_favorites"
  ADD CONSTRAINT "professional_favorites_professional_id_fkey"
  FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
