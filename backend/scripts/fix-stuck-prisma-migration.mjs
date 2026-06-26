import pg from 'pg';

const { Client } = pg;

const STUCK_MIGRATION = '20260427120000_add_negotiations_module';

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

    const row = await client.query(
      `SELECT id, finished_at, rolled_back_at, started_at, applied_steps_count
       FROM "_prisma_migrations"
       WHERE migration_name = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [STUCK_MIGRATION],
    );

    if (row.rows.length === 0) {
      console.log(`Migration ${STUCK_MIGRATION} not found, nothing to repair.`);
      return;
    }

    const m = row.rows[0];

    if (m.finished_at && !m.rolled_back_at) {
      console.log(`Migration ${STUCK_MIGRATION} is already marked as applied.`);
      return;
    }

    const [negotiations, offers, statutType, roleType] = await Promise.all([
      tableExists(client, 'negotiations'),
      tableExists(client, 'negotiation_offers'),
      enumExists(client, 'StatutNegotiation'),
      enumExists(client, 'RoleNegociateur'),
    ]);

    console.log(`negotiations table exists: ${negotiations}`);
    console.log(`negotiation_offers table exists: ${offers}`);
    console.log(`StatutNegotiation enum exists: ${statutType}`);
    console.log(`RoleNegociateur enum exists: ${roleType}`);

    if (negotiations && offers && statutType && roleType) {
      console.log('Objects already exist. Marking migration as applied...');
      await client.query(
        `UPDATE "_prisma_migrations"
         SET finished_at = NOW(),
             rolled_back_at = NULL,
             applied_steps_count = 1
         WHERE migration_name = $1
           AND id = $2`,
        [STUCK_MIGRATION, m.id],
      );
      console.log(`Migration ${STUCK_MIGRATION} marked as applied.`);
    } else {
      console.log('Objects missing or incomplete. Resetting migration so it can be re-applied...');
      await client.query(
        `DELETE FROM "_prisma_migrations"
         WHERE migration_name = $1
           AND id = $2`,
        [STUCK_MIGRATION, m.id],
      );
      console.log(`Migration ${STUCK_MIGRATION} removed from _prisma_migrations. It will be re-applied on next deploy.`);
    }
  } catch (err) {
    console.error('Repair failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
