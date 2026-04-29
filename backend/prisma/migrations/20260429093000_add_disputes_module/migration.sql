ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'LITIGE_OUVERT';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutLitige') THEN
    CREATE TYPE "StatutLitige" AS ENUM ('OUVERT', 'EN_REVUE', 'RESOLU', 'REJETE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrioriteLitige') THEN
    CREATE TYPE "PrioriteLitige" AS ENUM ('BASSE', 'MOYENNE', 'HAUTE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DecisionResolutionLitige') THEN
    CREATE TYPE "DecisionResolutionLitige" AS ENUM ('REMBOURSER_CLIENT', 'CREDITER_PRESTATAIRE', 'PARTAGER');
  END IF;
END $$;

CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "payment_id" UUID,
    "reporter_user_id" UUID NOT NULL,
    "resolved_by_admin_user_id" UUID,
    "status" "StatutLitige" NOT NULL DEFAULT 'OUVERT',
    "priority" "PrioriteLitige" NOT NULL DEFAULT 'MOYENNE',
    "raison" TEXT NOT NULL,
    "internal_notes" TEXT,
    "resolution_decision" "DecisionResolutionLitige",
    "client_refund_percentage" INTEGER,
    "client_refund_amount" DECIMAL(12,2),
    "professional_payout_amount" DECIMAL(12,2),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_started_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "disputes_booking_id_key" UNIQUE ("booking_id"),
    CONSTRAINT "disputes_payment_id_key" UNIQUE ("payment_id")
);

ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_reporter_user_id_fkey"
    FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_resolved_by_admin_user_id_fkey"
    FOREIGN KEY ("resolved_by_admin_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "disputes_status_priority_opened_at_idx"
    ON "disputes"("status", "priority", "opened_at");

CREATE INDEX "disputes_reporter_user_id_opened_at_idx"
    ON "disputes"("reporter_user_id", "opened_at");

CREATE INDEX "disputes_resolved_by_admin_user_id_resolved_at_idx"
    ON "disputes"("resolved_by_admin_user_id", "resolved_at");

ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_client_refund_percentage_range_chk"
    CHECK (
      "client_refund_percentage" IS NULL
      OR ("client_refund_percentage" >= 0 AND "client_refund_percentage" <= 100)
    );

ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_resolution_payload_chk"
    CHECK (
      (
        "status" = 'RESOLU'
        AND "resolved_at" IS NOT NULL
        AND "resolution_decision" IS NOT NULL
      )
      OR (
        "status" <> 'RESOLU'
        AND "resolution_decision" IS NULL
      )
    );

ALTER TABLE "disputes"
    ADD CONSTRAINT "disputes_rejected_payload_chk"
    CHECK (
      (
        "status" = 'REJETE'
        AND "rejected_at" IS NOT NULL
      )
      OR (
        "status" <> 'REJETE'
        AND "rejected_at" IS NULL
      )
    );
