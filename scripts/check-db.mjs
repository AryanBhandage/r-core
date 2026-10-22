import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/app_db';
const client = new Client({ connectionString });

try {
  await client.connect();
  const result = await client.query("select current_database(), count(*) from information_schema.tables where table_schema = 'public'");
  console.log(JSON.stringify({ connectionString, row: result.rows[0] }, null, 2));
} finally {
  await client.end();
}
