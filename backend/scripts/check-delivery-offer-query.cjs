// Read-only schema validation for the delivery-offer listing query.
try {
  process.loadEnvFile('.env');
} catch {}
require('ts-node/register/transpile-only');
const { Client } = require('pg');
const {
  NotificationsRepository,
} = require('../src/notifications/infrastructure/repositories/notifications.repository');
(async () => {
  let query;
  const repository = new NotificationsRepository({
    $queryRaw: async (input) => {
      query = input;
      return [];
    },
  });
  await repository.listDeliveryOffers('00000000-0000-0000-0000-000000000000');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL unavailable');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query('EXPLAIN ' + query.text, query.values);
    await client.query('ROLLBACK');
    console.log(
      'Delivery-offer SELECT validated against the database schema (read-only EXPLAIN).',
    );
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error('Read-only query validation failed:', error.code || error.name);
  process.exitCode = 1;
});
