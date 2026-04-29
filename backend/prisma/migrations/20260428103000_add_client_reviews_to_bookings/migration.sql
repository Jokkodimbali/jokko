ALTER TABLE "bookings"
ADD COLUMN "client_rating" SMALLINT,
ADD COLUMN "client_review" TEXT,
ADD COLUMN "client_reviewed_at" TIMESTAMP(3);

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_client_rating_range_chk"
CHECK (
  "client_rating" IS NULL
  OR "client_rating" BETWEEN 1 AND 5
);

ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_client_review_payload_chk"
CHECK (
  (
    "client_rating" IS NULL
    AND "client_review" IS NULL
    AND "client_reviewed_at" IS NULL
  )
  OR (
    "client_rating" IS NOT NULL
    AND "client_reviewed_at" IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS "bookings_professional_reviewed_at_idx"
ON "bookings"("professional_id", "client_reviewed_at");
