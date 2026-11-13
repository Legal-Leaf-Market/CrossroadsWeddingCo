// STUB from the expense-capture branch. The main session's real audit log
// (append-only, hash chained) replaces this file at merge; keep the signature.
export async function audit(
  _ex: unknown | null,
  e: {
    tenantId: string;
    actor: string;
    action: string;
    entityType: string;
    entityId: string | null;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
    cause?: string | null;
  },
): Promise<void> {
  console.log("[audit]", e.action, e.entityType, e.entityId, "by", e.actor);
}
