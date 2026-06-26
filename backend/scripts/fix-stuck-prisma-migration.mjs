import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const ASSUME_MANUAL_MIGRATIONS_APPLIED = process.env.PRISMA_ASSUME_MANUAL_MIGRATIONS_APPLIED !== 'false';

const STUCK_MIGRATIONS = [
  '20260427120000_add_negotiations_module',
  '20260427183000_harden_global_schema_integrity_and_indexes',
  '20260427210000_add_reservation_price_adjustments',
  '20260428103000_add_client_reviews_to_bookings',
  '20260429093000_add_disputes_module',
  '20260429123000_add_live_tracking_presence',
  '20260506120000_add_professional_favorites',
  '20260519120000_add_negotiation_reservation_draft',
  '20260520103000_add_medical_credentials',
  '20260520104500_add_dispute_mediation_messages',
  '20260521100500_add_auth_session_platform',
  '20260522113000_add_service_subcategories',
  '20260602094500_add_client_medical_profiles',
  '20260602105500_add_dispute_evidence',
  '20260609122000_add_professional_specialties',
  '20260612095500_add_service_travel_mode',
];

const STUCK_MIGRATION_CHECKS = {
  '20260427120000_add_negotiations_module': async (client) => {
    const [negotiations, offers, statutType, roleType] = await Promise.all([
      tableExists(client, 'negotiations'),
      tableExists(client, 'negotiation_offers'),
      enumExists(client, 'StatutNegotiation'),
      enumExists(client, 'RoleNegociateur'),
    ]);
    return { ready: negotiations && offers && statutType && roleType, details: { negotiations, offers, statutType, roleType } };
  },
  '20260427183000_harden_global_schema_integrity_and_indexes': async (client) => {
    const constraintExists = await client.query(
      `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_client_id_fkey') AS exists`,
    );
    return { ready: constraintExists.rows[0].exists, details: { payments_client_id_fkey: constraintExists.rows[0].exists } };
  },
  '20260427210000_add_reservation_price_adjustments': async (client) => {
    const details = await getReservationPriceAdjustmentDetails(client);
    return { ready: allReady(details), details };
  },
  '20260428103000_add_client_reviews_to_bookings': async (client) => {
    const details = await getClientReviewsDetails(client);
    return { ready: allReady(details), details };
  },
  '20260429093000_add_disputes_module': async (client) => readyCheck(client, {
    enums: ['StatutLitige', 'PrioriteLitige', 'DecisionResolutionLitige'],
    enumValues: [['TypeNotification', 'LITIGE_OUVERT']],
    tables: ['disputes'],
    indexes: [
      'disputes_status_priority_opened_at_idx',
      'disputes_reporter_user_id_opened_at_idx',
      'disputes_resolved_by_admin_user_id_resolved_at_idx',
    ],
    constraints: [
      'disputes_pkey',
      'disputes_booking_id_key',
      'disputes_payment_id_key',
      'disputes_booking_id_fkey',
      'disputes_payment_id_fkey',
      'disputes_reporter_user_id_fkey',
      'disputes_resolved_by_admin_user_id_fkey',
      'disputes_client_refund_percentage_range_chk',
      'disputes_resolution_payload_chk',
      'disputes_rejected_payload_chk',
    ],
  }),
  '20260429123000_add_live_tracking_presence': async (client) => readyCheck(client, {
    enums: ['StatutPresenceProfessionnel', 'StatutSessionTrackingReservation'],
    tables: ['professional_presence', 'reservation_tracking_sessions', 'reservation_tracking_points'],
    indexes: [
      'professional_presence_status_updated_at_idx',
      'professional_presence_is_online_updated_at_idx',
      'reservation_tracking_sessions_professional_id_status_updated_at_idx',
      'reservation_tracking_sessions_client_id_updated_at_idx',
      'reservation_tracking_points_tracking_session_id_recorded_at_idx',
    ],
    constraints: [
      'professional_presence_pkey',
      'professional_presence_professional_id_key',
      'reservation_tracking_sessions_pkey',
      'reservation_tracking_sessions_booking_id_key',
      'reservation_tracking_sessions_booking_client_professional_key',
      'reservation_tracking_points_pkey',
      'professional_presence_professional_id_fkey',
      'reservation_tracking_sessions_booking_triplet_fkey',
      'reservation_tracking_sessions_client_id_fkey',
      'reservation_tracking_sessions_professional_id_fkey',
      'reservation_tracking_points_tracking_session_id_fkey',
      'professional_presence_coordinates_pair_chk',
      'reservation_tracking_sessions_coordinates_pair_chk',
      'reservation_tracking_points_latitude_range_chk',
      'reservation_tracking_points_longitude_range_chk',
      'professional_presence_accuracy_non_negative_chk',
      'reservation_tracking_sessions_accuracy_non_negative_chk',
      'reservation_tracking_points_accuracy_non_negative_chk',
      'professional_presence_heading_range_chk',
      'reservation_tracking_sessions_heading_range_chk',
      'reservation_tracking_points_heading_range_chk',
      'professional_presence_speed_non_negative_chk',
      'reservation_tracking_sessions_speed_non_negative_chk',
      'reservation_tracking_points_speed_non_negative_chk',
    ],
  }),
  '20260506120000_add_professional_favorites': async (client) => readyCheck(client, {
    tables: ['professional_favorites'],
    indexes: [
      'professional_favorites_user_id_professional_id_key',
      'professional_favorites_user_id_created_at_idx',
      'professional_favorites_professional_id_idx',
    ],
    constraints: [
      'professional_favorites_pkey',
      'professional_favorites_user_id_fkey',
      'professional_favorites_professional_id_fkey',
    ],
  }),
  '20260519120000_add_negotiation_reservation_draft': async (client) => readyCheck(client, {
    columns: [
      ['negotiations', 'proposed_datetime'],
      ['negotiations', 'proposed_client_address'],
      ['negotiations', 'proposed_duration_minutes'],
    ],
  }),
  '20260520103000_add_medical_credentials': async (client) => readyCheck(client, {
    enums: ['StatutDiplomeMedical'],
    tables: ['medical_credentials'],
    indexes: ['medical_credentials_professional_id_status_idx', 'medical_credentials_status_created_at_idx'],
    constraints: ['medical_credentials_pkey', 'medical_credentials_professional_id_fkey'],
  }),
  '20260520104500_add_dispute_mediation_messages': async (client) => readyCheck(client, {
    enums: ['DestinataireMessageLitige'],
    tables: ['dispute_messages'],
    indexes: ['dispute_messages_dispute_id_created_at_idx', 'dispute_messages_admin_sender_id_created_at_idx'],
    constraints: ['dispute_messages_pkey', 'dispute_messages_dispute_id_fkey', 'dispute_messages_admin_sender_id_fkey'],
  }),
  '20260521100500_add_auth_session_platform': async (client) => readyCheck(client, {
    columns: [['auth_sessions', 'platform'], ['auth_sessions', 'user_agent']],
    indexes: ['auth_sessions_platform_created_at_idx'],
  }),
  '20260522113000_add_service_subcategories': async (client) => readyCheck(client, {
    tables: ['service_subcategories', 'category_service_subcategories'],
    indexes: [
      'service_subcategories_name_key',
      'category_service_subcategories_category_id_subcategory_id_key',
      'category_service_subcategories_subcategory_id_idx',
    ],
    constraints: [
      'service_subcategories_pkey',
      'category_service_subcategories_pkey',
      'category_service_subcategories_category_id_fkey',
      'category_service_subcategories_subcategory_id_fkey',
    ],
  }),
  '20260602094500_add_client_medical_profiles': async (client) => readyCheck(client, {
    tables: ['client_medical_profiles', 'client_medical_treatments'],
    indexes: ['client_medical_profiles_user_id_key', 'client_medical_treatments_medical_profile_id_created_at_idx'],
    constraints: [
      'client_medical_profiles_pkey',
      'client_medical_treatments_pkey',
      'client_medical_profiles_user_id_fkey',
      'client_medical_treatments_medical_profile_id_fkey',
    ],
  }),
  '20260602105500_add_dispute_evidence': async (client) => readyCheck(client, {
    tables: ['dispute_evidence'],
    indexes: ['dispute_evidence_dispute_id_created_at_idx', 'dispute_evidence_uploader_user_id_created_at_idx'],
    constraints: ['dispute_evidence_pkey', 'dispute_evidence_dispute_id_fkey', 'dispute_evidence_uploader_user_id_fkey'],
  }),
  '20260609122000_add_professional_specialties': async (client) => readyCheck(client, {
    tables: ['professional_specialties'],
    indexes: [
      'professional_specialties_professional_id_category_id_subcategory_id_key',
      'professional_specialties_professional_id_idx',
      'professional_specialties_category_id_idx',
      'professional_specialties_subcategory_id_idx',
    ],
    constraints: [
      'professional_specialties_pkey',
      'professional_specialties_professional_id_fkey',
      'professional_specialties_category_id_fkey',
      'professional_specialties_subcategory_id_fkey',
    ],
  }),
  '20260612095500_add_service_travel_mode': async (client) => readyCheck(client, {
    enums: ['ModeDeplacementService'],
    columns: [['services', 'travel_mode']],
  }),
};

const STUCK_MIGRATION_REPAIRS = {
  '20260427210000_add_reservation_price_adjustments': repairReservationPriceAdjustments,
  '20260428103000_add_client_reviews_to_bookings': repairClientReviews,
  '20260429093000_add_disputes_module': repairDisputesModule,
  '20260519120000_add_negotiation_reservation_draft': repairNegotiationReservationDraft,
  '20260521100500_add_auth_session_platform': repairAuthSessionPlatform,
  '20260612095500_add_service_travel_mode': repairServiceTravelMode,
};

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
    [table],
  );
  return r.rows[0].exists;
}

async function enumExists(client, enumName) {
  const r = await client.query(
    `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1) AS exists`,
    [enumName],
  );
  return r.rows[0].exists;
}

async function enumValueExists(client, enumName, enumValue) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = $1
         AND e.enumlabel = $2
     ) AS exists`,
    [enumName, enumValue],
  );
  return r.rows[0].exists;
}

async function columnExists(client, table, column) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [table, column],
  );
  return r.rows[0].exists;
}

async function constraintExists(client, constraintName) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = $1
       UNION ALL
       SELECT 1
       FROM pg_class
       WHERE relname = $1
     ) AS exists`,
    [constraintName],
  );
  return r.rows[0].exists;
}

async function indexExists(client, indexName) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = $1
     ) AS exists`,
    [indexName],
  );
  return r.rows[0].exists;
}

function allReady(details) {
  return Object.values(details).every(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

async function readyCheck(client, spec) {
  const checks = [];

  for (const enumName of spec.enums ?? []) {
    checks.push([enumName, enumExists(client, enumName)]);
  }

  for (const [enumName, enumValue] of spec.enumValues ?? []) {
    checks.push([`${enumName}_${enumValue}`, enumValueExists(client, enumName, enumValue)]);
  }

  for (const table of spec.tables ?? []) {
    checks.push([table, tableExists(client, table)]);
  }

  for (const [table, column] of spec.columns ?? []) {
    checks.push([`${table}_${column}`, columnExists(client, table, column)]);
  }

  for (const indexName of spec.indexes ?? []) {
    checks.push([indexName, indexExists(client, indexName)]);
  }

  for (const constraintName of spec.constraints ?? []) {
    checks.push([constraintName, constraintExists(client, constraintName)]);
  }

  const results = [];
  for (const [name, check] of checks) {
    results.push([name, await check]);
  }
  const details = Object.fromEntries(results);

  return { ready: allReady(details), details };
}

async function getReservationPriceAdjustmentDetails(client) {
  const statusType = await enumExists(client, 'StatutAjustementPrixReservation');
  const notificationProposed = await enumValueExists(client, 'TypeNotification', 'AJUSTEMENT_PRIX_PROPOSE');
  const notificationAccepted = await enumValueExists(client, 'TypeNotification', 'AJUSTEMENT_PRIX_ACCEPTE');
  const notificationRefused = await enumValueExists(client, 'TypeNotification', 'AJUSTEMENT_PRIX_REFUSE');
  const statusColumn = await columnExists(client, 'bookings', 'price_adjustment_status');
  const priceColumn = await columnExists(client, 'bookings', 'proposed_adjusted_price');
  const reasonColumn = await columnExists(client, 'bookings', 'price_adjustment_reason');
  const requestedAtColumn = await columnExists(client, 'bookings', 'price_adjustment_requested_at');
  const amountConstraint = await constraintExists(client, 'bookings_price_adjustment_amount_positive_check');
  const payloadConstraint = await constraintExists(client, 'bookings_price_adjustment_pending_payload_check');

  return {
    StatutAjustementPrixReservation: statusType,
    TypeNotification_AJUSTEMENT_PRIX_PROPOSE: notificationProposed,
    TypeNotification_AJUSTEMENT_PRIX_ACCEPTE: notificationAccepted,
    TypeNotification_AJUSTEMENT_PRIX_REFUSE: notificationRefused,
    bookings_price_adjustment_status: statusColumn,
    bookings_proposed_adjusted_price: priceColumn,
    bookings_price_adjustment_reason: reasonColumn,
    bookings_price_adjustment_requested_at: requestedAtColumn,
    bookings_price_adjustment_amount_positive_check: amountConstraint,
    bookings_price_adjustment_pending_payload_check: payloadConstraint,
  };
}

async function repairReservationPriceAdjustments(client) {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'StatutAjustementPrixReservation'
      ) THEN
        CREATE TYPE "StatutAjustementPrixReservation" AS ENUM (
          'AUCUN',
          'EN_ATTENTE_CLIENT',
          'ACCEPTE',
          'REFUSE'
        );
      END IF;
    END $$;
  `);

  await client.query(`ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'AJUSTEMENT_PRIX_PROPOSE'`);
  await client.query(`ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'AJUSTEMENT_PRIX_ACCEPTE'`);
  await client.query(`ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'AJUSTEMENT_PRIX_REFUSE'`);

  await client.query(`
    ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "price_adjustment_status" "StatutAjustementPrixReservation" NOT NULL DEFAULT 'AUCUN',
    ADD COLUMN IF NOT EXISTS "proposed_adjusted_price" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "price_adjustment_reason" TEXT,
    ADD COLUMN IF NOT EXISTS "price_adjustment_requested_at" TIMESTAMP(3)
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_price_adjustment_amount_positive_check'
      ) THEN
        ALTER TABLE "bookings"
        ADD CONSTRAINT "bookings_price_adjustment_amount_positive_check"
        CHECK (
          "proposed_adjusted_price" IS NULL
          OR "proposed_adjusted_price" > 0
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_price_adjustment_pending_payload_check'
      ) THEN
        ALTER TABLE "bookings"
        ADD CONSTRAINT "bookings_price_adjustment_pending_payload_check"
        CHECK (
          (
            "price_adjustment_status" = 'AUCUN'
            AND "proposed_adjusted_price" IS NULL
            AND "price_adjustment_requested_at" IS NULL
          )
          OR (
            "price_adjustment_status" IN ('EN_ATTENTE_CLIENT', 'ACCEPTE', 'REFUSE')
            AND "proposed_adjusted_price" IS NOT NULL
            AND "price_adjustment_requested_at" IS NOT NULL
          )
        );
      END IF;
    END $$;
  `);
}

async function getClientReviewsDetails(client) {
  const ratingColumn = await columnExists(client, 'bookings', 'client_rating');
  const reviewColumn = await columnExists(client, 'bookings', 'client_review');
  const reviewedAtColumn = await columnExists(client, 'bookings', 'client_reviewed_at');
  const ratingConstraint = await constraintExists(client, 'bookings_client_rating_range_chk');
  const payloadConstraint = await constraintExists(client, 'bookings_client_review_payload_chk');
  const reviewedAtIndex = await indexExists(client, 'bookings_professional_reviewed_at_idx');

  return {
    bookings_client_rating: ratingColumn,
    bookings_client_review: reviewColumn,
    bookings_client_reviewed_at: reviewedAtColumn,
    bookings_client_rating_range_chk: ratingConstraint,
    bookings_client_review_payload_chk: payloadConstraint,
    bookings_professional_reviewed_at_idx: reviewedAtIndex,
  };
}

async function repairClientReviews(client) {
  await client.query(`
    ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "client_rating" SMALLINT,
    ADD COLUMN IF NOT EXISTS "client_review" TEXT,
    ADD COLUMN IF NOT EXISTS "client_reviewed_at" TIMESTAMP(3)
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_client_rating_range_chk'
      ) THEN
        ALTER TABLE "bookings"
        ADD CONSTRAINT "bookings_client_rating_range_chk"
        CHECK (
          "client_rating" IS NULL
          OR "client_rating" BETWEEN 1 AND 5
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_client_review_payload_chk'
      ) THEN
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
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "bookings_professional_reviewed_at_idx"
    ON "bookings"("professional_id", "client_reviewed_at")
  `);
}

async function repairDisputesModule(client) {
  await client.query(`ALTER TYPE "TypeNotification" ADD VALUE IF NOT EXISTS 'LITIGE_OUVERT'`);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatutLitige') THEN
        CREATE TYPE "StatutLitige" AS ENUM ('OUVERT', 'EN_REVUE', 'RESOLU', 'REJETE');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrioriteLitige') THEN
        CREATE TYPE "PrioriteLitige" AS ENUM ('BASSE', 'MOYENNE', 'HAUTE');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DecisionResolutionLitige') THEN
        CREATE TYPE "DecisionResolutionLitige" AS ENUM ('REMBOURSER_CLIENT', 'CREDITER_PRESTATAIRE', 'PARTAGER');
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "disputes" (
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
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    ALTER TABLE "disputes"
    ADD COLUMN IF NOT EXISTS "booking_id" UUID NOT NULL,
    ADD COLUMN IF NOT EXISTS "payment_id" UUID,
    ADD COLUMN IF NOT EXISTS "reporter_user_id" UUID NOT NULL,
    ADD COLUMN IF NOT EXISTS "resolved_by_admin_user_id" UUID,
    ADD COLUMN IF NOT EXISTS "status" "StatutLitige" NOT NULL DEFAULT 'OUVERT',
    ADD COLUMN IF NOT EXISTS "priority" "PrioriteLitige" NOT NULL DEFAULT 'MOYENNE',
    ADD COLUMN IF NOT EXISTS "raison" TEXT NOT NULL,
    ADD COLUMN IF NOT EXISTS "internal_notes" TEXT,
    ADD COLUMN IF NOT EXISTS "resolution_decision" "DecisionResolutionLitige",
    ADD COLUMN IF NOT EXISTS "client_refund_percentage" INTEGER,
    ADD COLUMN IF NOT EXISTS "client_refund_amount" DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS "professional_payout_amount" DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "review_started_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_pkey') THEN
        ALTER TABLE "disputes" ADD CONSTRAINT "disputes_pkey" PRIMARY KEY ("id");
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_booking_id_key')
         AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'disputes_booking_id_key') THEN
        ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_key" UNIQUE ("booking_id");
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_payment_id_key')
         AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'disputes_payment_id_key') THEN
        ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_id_key" UNIQUE ("payment_id");
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_booking_id_fkey') THEN
        ALTER TABLE "disputes"
          ADD CONSTRAINT "disputes_booking_id_fkey"
          FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_payment_id_fkey') THEN
        ALTER TABLE "disputes"
          ADD CONSTRAINT "disputes_payment_id_fkey"
          FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_reporter_user_id_fkey') THEN
        ALTER TABLE "disputes"
          ADD CONSTRAINT "disputes_reporter_user_id_fkey"
          FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_resolved_by_admin_user_id_fkey') THEN
        ALTER TABLE "disputes"
          ADD CONSTRAINT "disputes_resolved_by_admin_user_id_fkey"
          FOREIGN KEY ("resolved_by_admin_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_client_refund_percentage_range_chk') THEN
        ALTER TABLE "disputes"
          ADD CONSTRAINT "disputes_client_refund_percentage_range_chk"
          CHECK (
            "client_refund_percentage" IS NULL
            OR ("client_refund_percentage" >= 0 AND "client_refund_percentage" <= 100)
          );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_resolution_payload_chk') THEN
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
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disputes_rejected_payload_chk') THEN
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
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "disputes_status_priority_opened_at_idx"
    ON "disputes"("status", "priority", "opened_at")
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "disputes_reporter_user_id_opened_at_idx"
    ON "disputes"("reporter_user_id", "opened_at")
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "disputes_resolved_by_admin_user_id_resolved_at_idx"
    ON "disputes"("resolved_by_admin_user_id", "resolved_at")
  `);
}

async function repairNegotiationReservationDraft(client) {
  await client.query(`
    ALTER TABLE "negotiations"
    ADD COLUMN IF NOT EXISTS "proposed_datetime" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "proposed_client_address" VARCHAR(180),
    ADD COLUMN IF NOT EXISTS "proposed_duration_minutes" INTEGER
  `);
}

async function repairAuthSessionPlatform(client) {
  await client.query(`
    ALTER TABLE "auth_sessions"
    ADD COLUMN IF NOT EXISTS "platform" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "user_agent" TEXT
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "auth_sessions_platform_created_at_idx"
    ON "auth_sessions"("platform", "created_at")
  `);
}

async function repairServiceTravelMode(client) {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'ModeDeplacementService'
      ) THEN
        CREATE TYPE "ModeDeplacementService" AS ENUM (
          'PRESTATAIRE_SE_DEPLACE',
          'CLIENT_SE_DEPLACE',
          'TRANSPORT_COLIS'
        );
      END IF;
    END $$;
  `);

  await client.query(`
    ALTER TABLE "services"
    ADD COLUMN IF NOT EXISTS "travel_mode" "ModeDeplacementService" NOT NULL DEFAULT 'PRESTATAIRE_SE_DEPLACE'
  `);
}

function isPlaceholderDatabaseUrl(connectionString) {
  return connectionString.includes('...') || connectionString.includes('ep-xxx') || connectionString.includes('@host:');
}

function normalizeDatabaseUrl(connectionString) {
  if (!connectionString || isPlaceholderDatabaseUrl(connectionString)) {
    return undefined;
  }

  try {
    const url = new URL(connectionString);
    if (url.protocol === 'postgresql:' && url.hostname.endsWith('.neon.tech')) {
      const sslMode = url.searchParams.get('sslmode');
      if (!sslMode || ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
        url.searchParams.set('sslmode', 'verify-full');
      }
      return url.toString();
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}

function tryFixPoolerUrl(connectionString) {
  if (!connectionString) {
    return undefined;
  }

  try {
    const url = new URL(connectionString);
    if (url.hostname.includes('-pooler.')) {
      url.hostname = url.hostname.replace('-pooler.', '.');
      return normalizeDatabaseUrl(url.toString()) ?? connectionString;
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}

function resolveMigrationDatabaseUrl() {
  const rawUrl =
    normalizeDatabaseUrl(process.env.PRISMA_MIGRATE_DATABASE_URL) ??
    normalizeDatabaseUrl(process.env.DIRECT_URL) ??
    normalizeDatabaseUrl(process.env.DATABASE_URL);

  return tryFixPoolerUrl(rawUrl);
}

function getMigrationChecksum(migrationName) {
  const migrationSqlPath = join(process.cwd(), 'prisma', 'migrations', migrationName, 'migration.sql');
  const migrationSql = readFileSync(migrationSqlPath);
  return createHash('sha256').update(migrationSql).digest('hex');
}

function getLocalMigrationNames() {
  const migrationsPath = join(process.cwd(), 'prisma', 'migrations');
  return readdirSync(migrationsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function insertAppliedMigration(client, migrationName) {
  await client.query(
    `INSERT INTO "_prisma_migrations" (
       id,
       checksum,
       finished_at,
       migration_name,
       logs,
       rolled_back_at,
       started_at,
       applied_steps_count
     )
     VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
    [randomUUID(), getMigrationChecksum(migrationName), migrationName],
  );
}

async function updateAppliedMigration(client, migrationName, migrationId) {
  await client.query(
    `UPDATE "_prisma_migrations"
     SET finished_at = NOW(),
         rolled_back_at = NULL,
         applied_steps_count = 1
     WHERE migration_name = $1
       AND id = $2`,
    [migrationName, migrationId],
  );
}

async function repairAndCheck(client, migrationName, checkFn) {
  const repairFn = STUCK_MIGRATION_REPAIRS[migrationName];
  if (!repairFn) {
    return undefined;
  }

  console.log(`Objects incomplete. Repairing migration ${migrationName} idempotently...`);
  await repairFn(client);
  const afterRepair = await checkFn(client);
  console.log(`Migration ${migrationName} details after repair:`, JSON.stringify(afterRepair.details));

  return afterRepair;
}

async function main() {
  const url = resolveMigrationDatabaseUrl();
  if (!url) {
    console.log('No usable migration database URL is set, skipping Prisma migration repair.');
    process.exit(0);
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const migrationsTable = await client.query(
      `SELECT exists (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = '_prisma_migrations'
       ) AS exists`,
    );

    if (!migrationsTable.rows[0].exists) {
      console.log('No _prisma_migrations table found, nothing to repair.');
      return;
    }

    const failedRows = await client.query(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE finished_at IS NULL
         AND rolled_back_at IS NULL
       ORDER BY started_at ASC`,
    );
    const failedMigrationNames = failedRows.rows.map((row) => row.migration_name);
    const localMigrationNames = getLocalMigrationNames();
    const migrationsToRepair = unique([...localMigrationNames, ...STUCK_MIGRATIONS, ...failedMigrationNames]);

    for (const migrationName of migrationsToRepair) {
      const row = await client.query(
        `SELECT id, finished_at, rolled_back_at, started_at, applied_steps_count
         FROM "_prisma_migrations"
         WHERE migration_name = $1
         ORDER BY started_at DESC
         LIMIT 1`,
        [migrationName],
      );

      if (row.rows.length === 0) {
        if (ASSUME_MANUAL_MIGRATIONS_APPLIED) {
          console.log(`Migration ${migrationName} not found. Recording as applied because manual migration reconciliation is enabled...`);
          await insertAppliedMigration(client, migrationName);
          console.log(`Migration ${migrationName} recorded as applied.`);
          continue;
        }

        const checkFn = STUCK_MIGRATION_CHECKS[migrationName];
        if (!checkFn) {
          console.log(`Migration ${migrationName} not found, nothing to repair.`);
          continue;
        }

        const { ready, details } = await checkFn(client);
        console.log(`Migration ${migrationName} details without history row:`, JSON.stringify(details));

        if (ready) {
          console.log(`Objects already exist. Recording migration ${migrationName} as applied...`);
          await insertAppliedMigration(client, migrationName);
          console.log(`Migration ${migrationName} recorded as applied.`);
          continue;
        }

        const afterRepair = await repairAndCheck(client, migrationName, checkFn);
        if (afterRepair?.ready) {
          console.log(`Repair completed. Recording migration ${migrationName} as applied...`);
          await insertAppliedMigration(client, migrationName);
          console.log(`Migration ${migrationName} recorded as applied.`);
          continue;
        }

        console.log(`Migration ${migrationName} not found and cannot be repaired safely before Prisma applies it.`);
        if (ASSUME_MANUAL_MIGRATIONS_APPLIED) {
          console.log(`Recording migration ${migrationName} as applied because manual migration reconciliation is enabled...`);
          await insertAppliedMigration(client, migrationName);
          console.log(`Migration ${migrationName} recorded as applied.`);
        }
        continue;
      }

      const m = row.rows[0];

      if (m.finished_at && !m.rolled_back_at) {
        console.log(`Migration ${migrationName} is already marked as applied.`);
        continue;
      }

      if (ASSUME_MANUAL_MIGRATIONS_APPLIED) {
        console.log(`Migration ${migrationName} is not marked as finished. Marking as applied because manual migration reconciliation is enabled...`);
        await updateAppliedMigration(client, migrationName, m.id);
        console.log(`Migration ${migrationName} marked as applied.`);
        continue;
      }

      const checkFn = STUCK_MIGRATION_CHECKS[migrationName];
      if (!checkFn) {
        console.log(`No check defined for migration ${migrationName}, skipping.`);
        continue;
      }

      const { ready, details } = await checkFn(client);
      console.log(`Migration ${migrationName} details:`, JSON.stringify(details));

      if (ready) {
        console.log(`Objects already exist. Marking migration ${migrationName} as applied...`);
        await updateAppliedMigration(client, migrationName, m.id);
        console.log(`Migration ${migrationName} marked as applied.`);
      } else {
        const afterRepair = await repairAndCheck(client, migrationName, checkFn);
        if (afterRepair?.ready) {
          console.log(`Repair completed. Marking migration ${migrationName} as applied...`);
          await updateAppliedMigration(client, migrationName, m.id);
          console.log(`Migration ${migrationName} marked as applied.`);
          continue;
        }

        console.log(`Objects missing or incomplete. Resetting migration ${migrationName} so it can be re-applied...`);
        if (ASSUME_MANUAL_MIGRATIONS_APPLIED) {
          console.log(`Marking migration ${migrationName} as applied because manual migration reconciliation is enabled...`);
          await updateAppliedMigration(client, migrationName, m.id);
          console.log(`Migration ${migrationName} marked as applied.`);
        } else {
          await client.query(
            `DELETE FROM "_prisma_migrations"
             WHERE migration_name = $1
               AND id = $2`,
            [migrationName, m.id],
          );
          console.log(`Migration ${migrationName} removed from _prisma_migrations. It will be re-applied on next deploy.`);
        }
      }
    }
  } catch (err) {
    console.error('Repair failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
