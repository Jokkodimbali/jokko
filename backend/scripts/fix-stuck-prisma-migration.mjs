import pg from 'pg';

const { Client } = pg;

const STUCK_MIGRATIONS = [
  '20260427120000_add_negotiations_module',
  '20260427183000_harden_global_schema_integrity_and_indexes',
  '20260427210000_add_reservation_price_adjustments',
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
    return { ready: reservationPriceAdjustmentIsReady(details), details };
  },
};

const STUCK_MIGRATION_REPAIRS = {
  '20260427210000_add_reservation_price_adjustments': repairReservationPriceAdjustments,
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
     ) AS exists`,
    [constraintName],
  );
  return r.rows[0].exists;
}

async function getReservationPriceAdjustmentDetails(client) {
  const [
    statusType,
    notificationProposed,
    notificationAccepted,
    notificationRefused,
    statusColumn,
    priceColumn,
    reasonColumn,
    requestedAtColumn,
    amountConstraint,
    payloadConstraint,
  ] = await Promise.all([
    enumExists(client, 'StatutAjustementPrixReservation'),
    enumValueExists(client, 'TypeNotification', 'AJUSTEMENT_PRIX_PROPOSE'),
    enumValueExists(client, 'TypeNotification', 'AJUSTEMENT_PRIX_ACCEPTE'),
    enumValueExists(client, 'TypeNotification', 'AJUSTEMENT_PRIX_REFUSE'),
    columnExists(client, 'bookings', 'price_adjustment_status'),
    columnExists(client, 'bookings', 'proposed_adjusted_price'),
    columnExists(client, 'bookings', 'price_adjustment_reason'),
    columnExists(client, 'bookings', 'price_adjustment_requested_at'),
    constraintExists(client, 'bookings_price_adjustment_amount_positive_check'),
    constraintExists(client, 'bookings_price_adjustment_pending_payload_check'),
  ]);

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

function reservationPriceAdjustmentIsReady(details) {
  return Object.values(details).every(Boolean);
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

    for (const migrationName of STUCK_MIGRATIONS) {
      const row = await client.query(
        `SELECT id, finished_at, rolled_back_at, started_at, applied_steps_count
         FROM "_prisma_migrations"
         WHERE migration_name = $1
         ORDER BY started_at DESC
         LIMIT 1`,
        [migrationName],
      );

      if (row.rows.length === 0) {
        console.log(`Migration ${migrationName} not found, nothing to repair.`);
        continue;
      }

      const m = row.rows[0];

      if (m.finished_at && !m.rolled_back_at) {
        console.log(`Migration ${migrationName} is already marked as applied.`);
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
        await client.query(
          `UPDATE "_prisma_migrations"
           SET finished_at = NOW(),
               rolled_back_at = NULL,
               applied_steps_count = 1
           WHERE migration_name = $1
             AND id = $2`,
          [migrationName, m.id],
        );
        console.log(`Migration ${migrationName} marked as applied.`);
      } else {
        const repairFn = STUCK_MIGRATION_REPAIRS[migrationName];
        if (repairFn) {
          console.log(`Objects incomplete. Repairing migration ${migrationName} idempotently...`);
          await repairFn(client);
          const afterRepair = await checkFn(client);
          console.log(`Migration ${migrationName} details after repair:`, JSON.stringify(afterRepair.details));

          if (afterRepair.ready) {
            console.log(`Repair completed. Marking migration ${migrationName} as applied...`);
            await client.query(
              `UPDATE "_prisma_migrations"
               SET finished_at = NOW(),
                   rolled_back_at = NULL,
                   applied_steps_count = 1
               WHERE migration_name = $1
                 AND id = $2`,
              [migrationName, m.id],
            );
            console.log(`Migration ${migrationName} marked as applied.`);
            continue;
          }
        }

        console.log(`Objects missing or incomplete. Resetting migration ${migrationName} so it can be re-applied...`);
        await client.query(
          `DELETE FROM "_prisma_migrations"
           WHERE migration_name = $1
             AND id = $2`,
          [migrationName, m.id],
        );
        console.log(`Migration ${migrationName} removed from _prisma_migrations. It will be re-applied on next deploy.`);
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
