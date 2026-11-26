import pg from "pg";

const adminUrl =
  process.env.POSTGRES_ADMIN_URL ??
  "postgresql://coai:coai_local_password@localhost:5432/postgres";
const testDatabase = "coai_test";
const client = new pg.Client({ connectionString: adminUrl });

try {
  await client.connect();
  const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    testDatabase,
  ]);
  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE ${testDatabase}`);
    console.log(`Created ${testDatabase}.`);
  } else {
    console.log(`${testDatabase} already exists.`);
  }
} finally {
  await client.end();
}
