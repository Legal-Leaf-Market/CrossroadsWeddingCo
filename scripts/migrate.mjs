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

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping schema apply.");
  process.exit(0);
}

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
