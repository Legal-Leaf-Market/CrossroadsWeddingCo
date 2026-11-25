import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// The audit log (2026-11-13, Jake: "a damn good audit log before and after
// the cutoff"). One row per change to anything that carries money: who, when,
// what it was, what it became, why, and what set it off. The database makes
// it append-only and chains every row's hash to the one before
// (scripts/phase1-schema.sql, audit_log_chain), so the app cannot rewrite it
// either. verifyAudit() re-walks the chain.

type Exec = { execute: typeof db.execute };

export type AuditEvent = {
  tenantId: string;
  /** An email for a person, "owner dashboard" for the key-gated admin, "system" for the live sync. */
  actor: string;
  /** Verb in dotted form: journal.post, period.approve, claim.approve, costing.save ... */
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  /** What set this change off, e.g. "bank line re-sorted by jake@...". */
  cause?: string | null;
};

const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

export async function audit(ex: Exec | null, e: AuditEvent): Promise<void> {
  await (ex ?? db).execute(sql`
    insert into audit_log (tenant_id, actor, action, entity_type, entity_id, before, after, reason, cause, hash)
    values (${e.tenantId}, ${e.actor.slice(0, 255)}, ${e.action.slice(0, 60)}, ${e.entityType.slice(0, 40)}, ${e.entityId?.slice(0, 80) ?? null},
            ${json(e.before)}::jsonb, ${json(e.after)}::jsonb, ${e.reason ?? null}, ${e.cause ?? null}, '')`);
}

/** Write an audit row and never throw: logged loudly if it fails. */
export async function auditQuietly(e: AuditEvent): Promise<void> {
  try {
    await audit(null, e);
  } catch (err) {
    console.error("[audit] could not write audit row", e.action, err instanceof Error ? err.message : err);
  }
}

/**
 * Re-walk one account's chain: every row's prev_hash must be the hash before
 * it, and every hash must recompute from the row. Returns the first row that
 * fails, or null when the whole chain holds.
 */
export async function verifyAudit(tenantId: string): Promise<{ rows: number; brokenAt: number | null; why: string | null }> {
  const res = await db.execute(sql`
    with chain as (
      select id, prev_hash, lag(hash) over (order by id) as previous_hash,
             hash = audit_digest(prev_hash, a) as intact
      from audit_log a where tenant_id = ${tenantId}
    ), first_issue as (
      select id, intact from chain
      where intact is not true or prev_hash is distinct from previous_hash
      order by id limit 1
    )
    select (select count(*) from chain) as rows, id as "brokenAt", intact
    from (select 1) summary left join first_issue on true`);
  const row = res.rows[0];
  const rows = Number(row?.rows ?? 0);
  if (row?.brokenAt == null) return { rows, brokenAt: null, why: null };
  const why = row.intact
    ? "A row before this one was changed or removed"
    : "This row was changed after it was written";
  return { rows, brokenAt: Number(row.brokenAt), why };
}
