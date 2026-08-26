// Applies scripts/phase1-schema.sql. Runs at the front of `pnpm build`, so the
// schema deploys itself with the code that needs it. The SQL is idempotent and
// additive-only, which is what makes running it on every build safe.
//
// No DATABASE_URL (local dev, CI sandboxes): skip quietly.
// Real SQL error: fail the build. Deploying code against a half-applied
// schema is worse than a red deploy.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const CANDIDATES = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "NEON_DATABASE_URL"];
// Case-insensitive: production had the variable saved as Database_URL.
const wanted = new Set(CANDIDATES.map((n) => n.toLowerCase()));
const found = Object.entries(process.env).find(([name, v]) => v && wanted.has(name.toLowerCase()));
if (!found) {
  // Names only, never values: which env keys even look database-related here?
  const visible = Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|NEON|PG/i.test(k)).sort();
  console.log(`[migrate] No connection string found. Checked: ${CANDIDATES.join(", ")}.`);
  console.log(`[migrate] Database-looking env var NAMES visible to this build: ${visible.length ? visible.join(", ") : "(none)"}.`);
  console.log("[migrate] Skipping schema apply.");
  process.exit(0);
}
const [urlName, url] = found;
console.log(`[migrate] Using connection string from ${urlName}.`);

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "phase1-schema.sql"), "utf8");
const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  // A hung database should fail the build visibly, not stall it.
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
});

try {
  await pool.query(sql);
  console.log("[migrate] phase1-schema.sql applied.");
} catch (err) {
  console.error("[migrate] FAILED:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
