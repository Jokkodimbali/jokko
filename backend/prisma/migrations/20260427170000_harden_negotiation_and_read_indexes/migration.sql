-- Reservation read/query indexes for production workloads
CREATE INDEX IF NOT EXISTS "bookings_client_id_date_time_idx"
ON "bookings"("client_id", "date_time");

CREATE INDEX IF NOT EXISTS "bookings_professional_id_date_time_idx"
ON "bookings"("professional_id", "date_time");

CREATE INDEX IF NOT EXISTS "bookings_service_id_date_time_idx"
ON "bookings"("service_id", "date_time");

CREATE INDEX IF NOT EXISTS "bookings_status_date_time_idx"
ON "bookings"("statut", "date_time");

-- Notifications read/update indexes
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
ON "notifications"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx"
ON "notifications"("user_id", "is_read", "created_at");

-- Outbox polling/filtering index
CREATE INDEX IF NOT EXISTS "outbox_events_event_type_status_created_at_idx"
ON "outbox_events"("event_type", "status", "created_at");

-- Native database protection against duplicate active negotiations
CREATE UNIQUE INDEX IF NOT EXISTS "negotiations_active_client_service_unique_idx"
ON "negotiations"("client_id", "service_id")
WHERE "statut" IN ('EN_ATTENTE_PRESTATAIRE', 'EN_ATTENTE_CLIENT', 'ACCEPTEE');
