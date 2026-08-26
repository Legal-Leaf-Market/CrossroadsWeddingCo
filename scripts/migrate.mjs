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
// Case-insensitive: production had the variable saved as Database_URL. The
// value is sanitized because pastes arrive quoted, prefixed, or as a psql
// command; extract the first postgres:// URL from whatever is there.
const wanted = new Set(CANDIDATES.map((n) => n.toLowerCase()));
const entry = Object.entries(process.env).find(([name, v]) => v && wanted.has(name.toLowerCase()));
const sanitized = entry ? entry[1].match(/postgres(?:ql)?:\/\/[^\s"']+/)?.[0] : undefined;
if (entry && !sanitized) {
  console.error(`[migrate] FAILED: env var ${entry[0]} exists but contains no postgres:// URL. Re-paste the plain connection string from the Neon dashboard.`);
  process.exit(1);
}
const found = entry && sanitized ? [entry[0], sanitized] : undefined;
if (!found) {
  // Names only, never values: which env keys even look database-related here?
  const visible = Object.keys(process.env).filter((k) => /DATABASE|POSTGRES|NEON|PG/i.test(k)).sort();
  console.log(`[migrate] No connection string found. Checked: ${CANDIDATES.join(", ")}.`);
  console.log(`[migrate] Database-looking env var NAMES visible to this build: ${visible.length ? visible.join(", ") : "(none)"}.`);
  console.log("[migrate] Skipping schema apply.");
  process.exit(0);
}
const [urlName, url] = found;
let host = "unparseable";
try { host = new URL(url).hostname; } catch {}
console.log(`[migrate] Using connection string from ${urlName} (host: ${host}).`);

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
