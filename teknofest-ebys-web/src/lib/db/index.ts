import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL ayarlanmamış (bkz. .env.local / .env.example).");
}

// prepare: false is required for Supabase's pooled connection (port 6543,
// PgBouncer in transaction mode) — that mode hands each statement to a
// possibly different backend connection, so server-side prepared statements
// (which are pinned to one backend) can't be used. Also safe against a
// direct (non-pooled) connection, so this isn't conditional on which URL is
// configured.
const sql = postgres(DATABASE_URL, { prepare: false, ssl: "require" });

export const db = drizzle(sql, { schema });
export { schema };
