import type { Config } from "drizzle-kit";

// drizzle-kit's own dotenv loading only reads ".env", and this project keeps
// real values in ".env.local" (see .env.example) — load it explicitly so
// `npm run db:generate` / `db:push` see DATABASE_URL without needing it
// duplicated into a second file.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Missing in CI or a fresh checkout — DATABASE_URL may still arrive via
  // real environment variables, so this isn't fatal.
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
} satisfies Config;
