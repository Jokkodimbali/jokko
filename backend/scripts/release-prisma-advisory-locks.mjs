import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const result = await client.query(`
    select pg_terminate_backend(activity.pid) as terminated, activity.pid
    from pg_locks lock
    join pg_stat_activity activity on activity.pid = lock.pid
    where lock.locktype = 'advisory'
      and lock.granted = true
      and activity.pid <> pg_backend_pid()
  `);

  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
