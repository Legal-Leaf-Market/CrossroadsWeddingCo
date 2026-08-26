// One place decides which env var holds the Postgres connection string.
// Vercel's Neon integration writes DATABASE_URL, but manual setups and other
// integrations use POSTGRES_URL or POSTGRES_PRISMA_URL; accept the common
// names so an env-var naming mismatch can't silently disable the database.
export const DB_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
] as const;

export function resolveDatabaseUrl(): { name: string; url: string } | null {
  for (const name of DB_URL_CANDIDATES) {
    const url = process.env[name];
    if (url) return { name, url };
  }
  return null;
}

/** Env var NAMES (never values) that look database-related, for diagnostics. */
export function databaseishEnvNames(): string[] {
  return Object.keys(process.env)
    .filter((k) => /DATABASE|POSTGRES|NEON|PG/i.test(k))
    .sort();
}
