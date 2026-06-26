import pg from 'pg';

const { Client } = pg;

const STUCK_MIGRATIONS = [
  '20260427120000_add_negotiations_module',
  '20260427183000_harden_global_schema_integrity_and_indexes',
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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('DATABASE_URL is not set, skipping Prisma migration repair.');
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
