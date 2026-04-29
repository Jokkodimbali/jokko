DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutPresenceProfessionnel') THEN
    CREATE TYPE "StatutPresenceProfessionnel" AS ENUM ('HORS_LIGNE', 'EN_LIGNE', 'EN_ROUTE', 'EN_PRESTATION');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutSessionTrackingReservation') THEN
    CREATE TYPE "StatutSessionTrackingReservation" AS ENUM ('EN_ROUTE', 'TERMINEE', 'ANNULEE');
  END IF;
END $$;

CREATE TABLE "professional_presence" (
  "id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "is_online" BOOLEAN NOT NULL DEFAULT false,
  "status" "StatutPresenceProfessionnel" NOT NULL DEFAULT 'HORS_LIGNE',
  "last_latitude" DECIMAL(10,7),
  "last_longitude" DECIMAL(10,7),
  "last_accuracy_meters" DECIMAL(8,2),
  "last_heading_degrees" SMALLINT,
  "last_speed_kmh" DECIMAL(8,2),
  "last_location_label" VARCHAR(255),
  "last_position_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "professional_presence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_presence_professional_id_key" UNIQUE ("professional_id")
);

CREATE TABLE "reservation_tracking_sessions" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "status" "StatutSessionTrackingReservation" NOT NULL DEFAULT 'EN_ROUTE',
  "last_latitude" DECIMAL(10,7),
  "last_longitude" DECIMAL(10,7),
  "last_accuracy_meters" DECIMAL(8,2),
  "last_heading_degrees" SMALLINT,
  "last_speed_kmh" DECIMAL(8,2),
  "last_location_label" VARCHAR(255),
  "last_position_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reservation_tracking_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_tracking_sessions_booking_id_key" UNIQUE ("booking_id"),
  CONSTRAINT "reservation_tracking_sessions_booking_client_professional_key"
    UNIQUE ("booking_id", "client_id", "professional_id")
);

CREATE TABLE "reservation_tracking_points" (
  "id" UUID NOT NULL,
  "tracking_session_id" UUID NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "accuracy_meters" DECIMAL(8,2),
  "heading_degrees" SMALLINT,
  "speed_kmh" DECIMAL(8,2),
  "location_label" VARCHAR(255),
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reservation_tracking_points_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "professional_presence"
  ADD CONSTRAINT "professional_presence_professional_id_fkey"
  FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_tracking_sessions"
  ADD CONSTRAINT "reservation_tracking_sessions_booking_triplet_fkey"
  FOREIGN KEY ("booking_id", "client_id", "professional_id")
  REFERENCES "bookings"("id", "client_id", "professional_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_tracking_sessions"
  ADD CONSTRAINT "reservation_tracking_sessions_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_tracking_sessions"
  ADD CONSTRAINT "reservation_tracking_sessions_professional_id_fkey"
  FOREIGN KEY ("professional_id") REFERENCES "professional_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_tracking_points"
  ADD CONSTRAINT "reservation_tracking_points_tracking_session_id_fkey"
  FOREIGN KEY ("tracking_session_id") REFERENCES "reservation_tracking_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "professional_presence_status_updated_at_idx"
  ON "professional_presence"("status", "updated_at");

CREATE INDEX "professional_presence_is_online_updated_at_idx"
  ON "professional_presence"("is_online", "updated_at");

CREATE INDEX "reservation_tracking_sessions_professional_id_status_updated_at_idx"
  ON "reservation_tracking_sessions"("professional_id", "status", "updated_at");

CREATE INDEX "reservation_tracking_sessions_client_id_updated_at_idx"
  ON "reservation_tracking_sessions"("client_id", "updated_at");

CREATE INDEX "reservation_tracking_points_tracking_session_id_recorded_at_idx"
  ON "reservation_tracking_points"("tracking_session_id", "recorded_at");

ALTER TABLE "professional_presence"
  ADD CONSTRAINT "professional_presence_coordinates_pair_chk"
  CHECK (
    ("last_latitude" IS NULL AND "last_longitude" IS NULL)
    OR ("last_latitude" IS NOT NULL AND "last_longitude" IS NOT NULL)
  );

ALTER TABLE "reservation_tracking_sessions"
  ADD CONSTRAINT "reservation_tracking_sessions_coordinates_pair_chk"
  CHECK (
    ("last_latitude" IS NULL AND "last_longitude" IS NULL)
    OR ("last_latitude" IS NOT NULL AND "last_longitude" IS NOT NULL)
  );

ALTER TABLE "reservation_tracking_points"
  ADD CONSTRAINT "reservation_tracking_points_latitude_range_chk"
  CHECK ("latitude" >= -90 AND "latitude" <= 90);

ALTER TABLE "reservation_tracking_points"
  ADD CONSTRAINT "reservation_tracking_points_longitude_range_chk"
  CHECK ("longitude" >= -180 AND "longitude" <= 180);

ALTER TABLE "professional_presence"
  ADD CONSTRAINT "professional_presence_accuracy_non_negative_chk"
  CHECK ("last_accuracy_meters" IS NULL OR "last_accuracy_meters" >= 0);

ALTER TABLE "reservation_tracking_sessions"
  ADD CONSTRAINT "reservation_tracking_sessions_accuracy_non_negative_chk"
  CHECK ("last_accuracy_meters" IS NULL OR "last_accuracy_meters" >= 0);

ALTER TABLE "reservation_tracking_points"
  ADD CONSTRAINT "reservation_tracking_points_accuracy_non_negative_chk"
  CHECK ("accuracy_meters" IS NULL OR "accuracy_meters" >= 0);

ALTER TABLE "professional_presence"
  ADD CONSTRAINT "professional_presence_heading_range_chk"
  CHECK (
    "last_heading_degrees" IS NULL
    OR ("last_heading_degrees" >= 0 AND "last_heading_degrees" <= 360)
  );

ALTER TABLE "reservation_tracking_sessions"
  ADD CONSTRAINT "reservation_tracking_sessions_heading_range_chk"
  CHECK (
    "last_heading_degrees" IS NULL
    OR ("last_heading_degrees" >= 0 AND "last_heading_degrees" <= 360)
  );

ALTER TABLE "reservation_tracking_points"
  ADD CONSTRAINT "reservation_tracking_points_heading_range_chk"
  CHECK (
    "heading_degrees" IS NULL
    OR ("heading_degrees" >= 0 AND "heading_degrees" <= 360)
  );

ALTER TABLE "professional_presence"
  ADD CONSTRAINT "professional_presence_speed_non_negative_chk"
  CHECK ("last_speed_kmh" IS NULL OR "last_speed_kmh" >= 0);

ALTER TABLE "reservation_tracking_sessions"
  ADD CONSTRAINT "reservation_tracking_sessions_speed_non_negative_chk"
  CHECK ("last_speed_kmh" IS NULL OR "last_speed_kmh" >= 0);

ALTER TABLE "reservation_tracking_points"
  ADD CONSTRAINT "reservation_tracking_points_speed_non_negative_chk"
  CHECK ("speed_kmh" IS NULL OR "speed_kmh" >= 0);
