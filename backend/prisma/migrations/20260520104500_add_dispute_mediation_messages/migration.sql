CREATE TYPE "DestinataireMessageLitige" AS ENUM ('CLIENT', 'PRESTATAIRE', 'TOUS');

CREATE TABLE "dispute_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dispute_id" UUID NOT NULL,
  "admin_sender_id" UUID NOT NULL,
  "recipient" "DestinataireMessageLitige" NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dispute_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dispute_messages_dispute_id_created_at_idx" ON "dispute_messages"("dispute_id", "created_at");
CREATE INDEX "dispute_messages_admin_sender_id_created_at_idx" ON "dispute_messages"("admin_sender_id", "created_at");

ALTER TABLE "dispute_messages"
  ADD CONSTRAINT "dispute_messages_dispute_id_fkey"
  FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dispute_messages"
  ADD CONSTRAINT "dispute_messages_admin_sender_id_fkey"
  FOREIGN KEY ("admin_sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
