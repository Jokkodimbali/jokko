-- Payment ownership integrity and read indexes
ALTER TABLE "payments"
ADD CONSTRAINT "payments_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_professional_id_fkey"
FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "payments_client_id_created_at_idx"
ON "payments"("client_id", "created_at");

CREATE INDEX IF NOT EXISTS "payments_professional_id_created_at_idx"
ON "payments"("professional_id", "created_at");

-- Conversation and message read indexes
CREATE INDEX IF NOT EXISTS "conversations_booking_id_idx"
ON "conversations"("booking_id");

CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx"
ON "conversations"("last_message_at");

CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx"
ON "messages"("conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "messages_sender_id_created_at_idx"
ON "messages"("sender_id", "created_at");

-- Withdrawal read indexes
CREATE INDEX IF NOT EXISTS "withdrawal_requests_professional_id_requested_at_idx"
ON "withdrawal_requests"("professional_id", "requested_at");

CREATE INDEX IF NOT EXISTS "withdrawal_requests_status_requested_at_idx"
ON "withdrawal_requests"("statut", "requested_at");
