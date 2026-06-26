import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const migrationsTable = await client.query(`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = '_prisma_migrations'
    ) as exists
  `);

  const migrations = migrationsTable.rows[0].exists
    ? await client.query(`
        select migration_name, finished_at, rolled_back_at
        from "_prisma_migrations"
        order by started_at, migration_name
      `)
    : { rows: [] };

  const locks = await client.query(`
    select
      activity.pid,
      activity.usename,
      activity.application_name,
      activity.state,
      activity.query,
      activity.query_start
    from pg_locks lock
    join pg_stat_activity activity on activity.pid = lock.pid
    where lock.locktype = 'advisory'
      and lock.granted = true
  `);

  console.log(
    JSON.stringify(
      {
        migrationsTableExists: migrationsTable.rows[0].exists,
        appliedMigrations: migrations.rows.length,
        advisoryLocks: locks.rows,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
