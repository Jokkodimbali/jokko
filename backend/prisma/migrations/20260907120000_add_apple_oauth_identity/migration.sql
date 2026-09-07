ALTER TABLE "users" ADD COLUMN "apple_oauth_id" VARCHAR(200);

CREATE UNIQUE INDEX "users_apple_oauth_id_key" ON "users"("apple_oauth_id");
