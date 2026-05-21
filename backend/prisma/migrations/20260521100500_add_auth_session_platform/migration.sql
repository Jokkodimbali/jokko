ALTER TABLE "auth_sessions"
  ADD COLUMN "platform" VARCHAR(20),
  ADD COLUMN "user_agent" TEXT;

CREATE INDEX "auth_sessions_platform_created_at_idx"
  ON "auth_sessions"("platform", "created_at");
