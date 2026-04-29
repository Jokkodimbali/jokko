-- Composite uniqueness required for stronger cross-table integrity
CREATE UNIQUE INDEX IF NOT EXISTS "services_id_professional_id_key"
ON "services"("id", "professional_id");

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_id_client_id_professional_id_key"
ON "bookings"("id", "client_id", "professional_id");

-- Ensure the service referenced by a booking belongs to the same professional
ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_service_professional_consistency_fkey"
FOREIGN KEY ("service_id", "professional_id")
REFERENCES "services"("id", "professional_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure the service referenced by a negotiation belongs to the same professional
ALTER TABLE "negotiations"
ADD CONSTRAINT "negotiations_service_professional_consistency_fkey"
FOREIGN KEY ("service_id", "professional_id")
REFERENCES "services"("id", "professional_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure payment actors match the linked booking exactly
ALTER TABLE "payments"
ADD CONSTRAINT "payments_booking_actor_consistency_fkey"
FOREIGN KEY ("booking_id", "client_id", "professional_id")
REFERENCES "bookings"("id", "client_id", "professional_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Functional check constraints for high-integrity data
ALTER TABLE "services"
ADD CONSTRAINT "services_price_non_negative_chk"
CHECK ("price" >= 0);

ALTER TABLE "availabilities"
ADD CONSTRAINT "availabilities_day_of_week_chk"
CHECK ("day_of_week" BETWEEN 0 AND 6);

ALTER TABLE "availabilities"
ADD CONSTRAINT "availabilities_time_order_chk"
CHECK ("start_time" < "end_time");

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_duration_positive_chk"
CHECK ("duration_minutes" > 0);

ALTER TABLE "negotiations"
ADD CONSTRAINT "negotiations_amounts_positive_chk"
CHECK (
  "initial_amount" > 0
  AND "current_amount" > 0
  AND ("accepted_amount" IS NULL OR "accepted_amount" > 0)
);

ALTER TABLE "professional_profiles"
ADD CONSTRAINT "professional_profiles_rating_range_chk"
CHECK ("global_rating" >= 0 AND "global_rating" <= 5);

ALTER TABLE "professional_profiles"
ADD CONSTRAINT "professional_profiles_total_reviews_non_negative_chk"
CHECK ("total_reviews" >= 0);

ALTER TABLE "professional_profiles"
ADD CONSTRAINT "professional_profiles_wallet_balance_non_negative_chk"
CHECK ("wallet_balance" >= 0);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_amounts_non_negative_chk"
CHECK (
  "amount" >= 0
  AND "commission_amount" >= 0
  AND "net_amount" >= 0
);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_amount_split_consistency_chk"
CHECK ("amount" = "commission_amount" + "net_amount");

ALTER TABLE "messages"
ADD CONSTRAINT "messages_content_or_media_required_chk"
CHECK ("content" IS NOT NULL OR "media_url" IS NOT NULL);

ALTER TABLE "withdrawal_requests"
ADD CONSTRAINT "withdrawal_requests_amount_positive_chk"
CHECK ("amount" > 0);
