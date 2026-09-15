ALTER TABLE "messages"
  ADD COLUMN "dispute_id" UUID;

CREATE INDEX "messages_dispute_id_created_at_idx"
  ON "messages"("dispute_id", "created_at");
