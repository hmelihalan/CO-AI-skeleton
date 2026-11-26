import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const globalForDatabase = globalThis as unknown as {
  coaiPool?: Pool;
};

export const pool =
  globalForDatabase.coaiPool ??
  new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.coaiPool = pool;
}

export const db = drizzle(pool, { schema });
