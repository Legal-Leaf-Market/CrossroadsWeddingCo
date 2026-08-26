// One place decides which env var holds the Postgres connection string.
// Vercel's Neon integration writes DATABASE_URL, manual setups use POSTGRES_URL
// or their own casing (production had Database_URL on 2026-08-26), so match the
// candidate names case-insensitively; a naming or casing mismatch must never
// silently disable the database.
export const DB_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
] as const;

export function resolveDatabaseUrl(): { name: string; url: string } | null {
  const wanted = new Set(DB_URL_CANDIDATES.map((n) => n.toLowerCase()));
  for (const [name, url] of Object.entries(process.env)) {
    if (url && wanted.has(name.toLowerCase())) return { name, url };
  }
  return null;
}
