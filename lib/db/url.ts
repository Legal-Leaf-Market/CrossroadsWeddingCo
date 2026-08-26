// One place decides which env var holds the Postgres connection string.
// Vercel's Neon integration writes DATABASE_URL, manual setups use POSTGRES_URL
// or their own casing (production had Database_URL on 2026-08-26), so match the
// candidate names case-insensitively. The value is sanitized too: real-world
// pastes arrive wrapped in quotes, prefixed with DATABASE_URL=, or inside a
// psql command, and none of that should silently disable the database.
export const DB_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
] as const;

/** Pull the first postgres:// or postgresql:// URL out of whatever got pasted. */
export function sanitizeDatabaseUrl(raw: string): string | null {
  const match = raw.match(/postgres(?:ql)?:\/\/[^\s"']+/);
  return match ? match[0] : null;
}

export function resolveDatabaseUrl(): { name: string; url: string } | null {
  const wanted = new Set(DB_URL_CANDIDATES.map((n) => n.toLowerCase()));
  for (const [name, value] of Object.entries(process.env)) {
    if (value && wanted.has(name.toLowerCase())) {
      const url = sanitizeDatabaseUrl(value);
      if (url) return { name, url };
    }
  }
  return null;
}
