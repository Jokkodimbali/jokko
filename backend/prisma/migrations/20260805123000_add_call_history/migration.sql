CREATE TYPE "TypeAppel" AS ENUM ('VOCAL', 'VIDEO');
CREATE TYPE "StatutAppel" AS ENUM ('SONNE', 'ACCEPTE', 'REFUSE', 'TERMINE', 'MANQUE', 'ECHEC');
ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'APPEL_ENTRANT';
ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'APPEL_MANQUE';

CREATE TABLE "calls" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "caller_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "type" "TypeAppel" NOT NULL,
  "statut" "StatutAppel" NOT NULL DEFAULT 'SONNE',
  "ringing_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "calls_caller_id_created_at_idx" ON "calls"("caller_id", "created_at");
CREATE INDEX "calls_recipient_id_created_at_idx" ON "calls"("recipient_id", "created_at");
CREATE INDEX "calls_statut_expires_at_idx" ON "calls"("statut", "expires_at");
ALTER TABLE "calls" ADD CONSTRAINT "calls_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calls" ADD CONSTRAINT "calls_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
