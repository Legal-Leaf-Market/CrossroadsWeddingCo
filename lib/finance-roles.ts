// STUB from the expense-capture branch. The main session's real module (the
// finance_roles table) replaces this file at merge; keep the signature.
export type FinanceRole = "preparer" | "approver" | "tiebreaker";

const FIXED: Record<string, FinanceRole> = {
  "jake@crossroadsweddingco.shop": "preparer",
  "terry@crossroadsweddingco.shop": "approver",
  "nic@crossroadsweddingco.shop": "tiebreaker",
};

export async function rolesFor(_tenantId: string, email: string): Promise<Set<"preparer" | "approver" | "tiebreaker">> {
  const r = FIXED[(email ?? "").trim().toLowerCase()];
  return new Set(r ? [r] : []);
}
