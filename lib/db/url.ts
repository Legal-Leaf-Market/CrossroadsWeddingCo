// One place decides which env var holds the Postgres connection string.
// Matching is case-insensitive (production had Database_URL), values are
// sanitized (pastes arrive quoted, prefixed, or as psql commands), and when
// several matching variables exist, the first one that actually contains a
// postgres:// URL wins, so a broken leftover variable can't shadow a good one.
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
  for (const candidate of DB_URL_CANDIDATES) {
    for (const [name, value] of Object.entries(process.env)) {
      if (value && name.toLowerCase() === candidate.toLowerCase()) {
        const url = sanitizeDatabaseUrl(value);
        if (url) return { name, url };
      }
    }
  }
  return null;
}
