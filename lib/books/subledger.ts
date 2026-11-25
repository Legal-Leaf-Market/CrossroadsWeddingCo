import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  CONTROL_ACCOUNTS,
  isControlKey,
  jobBalances,
  natural,
  register,
  subId,
  subKind,
  tieOut,
  type AccountMeta,
  type RegisterLine,
  type SubSum,
  type TieOutRow,
} from "@/lib/books/subledger-logic";

// The drill-down (2026-11-13, docs/handoff task 3): report line -> account
// register with a running balance -> subledger for control accounts -> journal
// entry -> its lines -> the source record -> that source's audit history. The
// arithmetic is pure in lib/books/subledger-logic.ts; this file only reads.
// Every query is scoped by the caller's tenant.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Row = Record<string, unknown>;
const rows = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

export async function accountsMeta(tenantId: string): Promise<AccountMeta[]> {
  return rows<AccountMeta>(sql`
    select id::text, code, name, type, system_key as "systemKey"
    from ledger_accounts where tenant_id = ${tenantId} order by code`);
}

/** Posted debits and credits per account and subledger key, optionally through a date. */
export async function subSums(tenantId: string, asOf?: string): Promise<SubSum[]> {
  const r = await rows<{ accountId: string; sub: string | null; debit: string; credit: string }>(sql`
    select l.account_id::text as "accountId", l.sub_ref as sub,
           coalesce(sum(l.debit_cents),0)::bigint::text as debit, coalesce(sum(l.credit_cents),0)::bigint::text as credit
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where l.tenant_id = ${tenantId} and e.tenant_id = ${tenantId} and e.status = 'posted'
      ${asOf ? sql`and e.entry_date <= ${asOf}` : sql``}
    group by l.account_id, l.sub_ref`);
  return r.map((x) => ({ accountId: x.accountId, sub: x.sub, debit: Number(x.debit), credit: Number(x.credit) }));
}

/** Readable names for subledger keys: the booking's names and date, the crew member's name. */
export async function subLabels(tenantId: string, subs: (string | null)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const jobIds = [...new Set(subs.filter((s): s is string => subKind(s) === "job").map(subId).filter((x) => UUID_RE.test(x)))];
  const crewIds = [...new Set(subs.filter((s): s is string => subKind(s) === "crew").map(subId).filter((x) => UUID_RE.test(x)))];
  if (jobIds.length) {
    const r = await rows<{ id: string; names: string; date: string }>(sql`
      select id::text, couple_names as names, event_date::text as date from weddings
      where tenant_id = ${tenantId} and id in (${sql.join(jobIds.map((i) => sql`${i}::uuid`), sql`, `)})`);
    for (const j of r) out.set(`job:${j.id}`, `${j.names} (${j.date})`);
  }
  if (crewIds.length) {
    const r = await rows<{ id: string; name: string }>(sql`
      select id::text, name from crew_members
      where tenant_id = ${tenantId} and id in (${sql.join(crewIds.map((i) => sql`${i}::uuid`), sql`, `)})`);
    for (const c of r) out.set(`crew:${c.id}`, c.name);
  }
  for (const s of subs) if (s && !out.has(s)) out.set(s, `Unknown ${subKind(s) ?? "key"} ${subId(s).slice(0, 8)}`);
  return out;
}

/** Every control account against its subledger, as of a date (default: everything posted). */
export async function tieOutReport(tenantId: string, asOf?: string): Promise<{ rows: TieOutRow[]; labels: Map<string, string> }> {
  const [sums, accounts] = await Promise.all([subSums(tenantId, asOf), accountsMeta(tenantId)]);
  const tie = tieOut(sums, accounts);
  const labels = await subLabels(tenantId, tie.flatMap((t) => t.parties.map((p) => p.sub)));
  return { rows: tie, labels };
}

/** Every job's balances from the ledger, with the tie-out they must agree with. */
export async function jobLedgerBalances(tenantId: string) {
  const [sums, accounts] = await Promise.all([subSums(tenantId), accountsMeta(tenantId)]);
  return { balances: jobBalances(sums, accounts), tie: tieOut(sums, accounts) };
}

/** The trial balance: every account with activity, debits, credits and its natural balance. */
export async function trialBalance(tenantId: string, asOf?: string) {
  const [sums, accounts] = await Promise.all([subSums(tenantId, asOf), accountsMeta(tenantId)]);
  return accounts
    .map((a) => {
      const mine = sums.filter((s) => s.accountId === a.id);
      const debit = mine.reduce((x, s) => x + s.debit, 0);
      const credit = mine.reduce((x, s) => x + s.credit, 0);
      return { ...a, debit, credit, balance: natural(a.type, debit, credit) };
    })
    .filter((a) => a.debit || a.credit);
}

export type RegisterView = {
  account: AccountMeta;
  from: string | null;
  to: string | null;
  sub: string | null;
  broughtForward: number;
  lines: (RegisterLine & { balance: number; sourceRef: string | null })[];
  truncated: boolean;
  /** For a control account: its subledger, party by party, as of `to`. */
  parties: { sub: string; label: string; balance: number }[] | null;
  labels: Map<string, string>;
};

const MAX_LINES = 2000;

/** One account's register between two dates, optionally for one subledger key. */
export async function accountRegister(tenantId: string, accountId: string, opts: { from?: string | null; to?: string | null; sub?: string | null }): Promise<RegisterView | null> {
  if (!UUID_RE.test(accountId)) return null;
  const [account] = await rows<AccountMeta>(sql`
    select id::text, code, name, type, system_key as "systemKey" from ledger_accounts where id = ${accountId}::uuid and tenant_id = ${tenantId}`);
  if (!account) return null;
  const from = opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from) ? opts.from : null;
  const to = opts.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.to) ? opts.to : null;
  const sub = opts.sub ? opts.sub.slice(0, 80) : null;
  const by = isControlKey(account.systemKey) ? CONTROL_ACCOUNTS[account.systemKey] : null;
  // "none": the lines the tie-out counts as a difference (no key, or the wrong kind of key).
  const subCond =
    sub === "none"
      ? by
        ? sql`and (l.sub_ref is null or l.sub_ref not like ${`${by}:%`})`
        : sql`and l.sub_ref is null`
      : sub
        ? sql`and l.sub_ref = ${sub}`
        : sql``;
  const [bf] = from
    ? await rows<{ d: string; c: string }>(sql`
        select coalesce(sum(l.debit_cents),0)::bigint::text as d, coalesce(sum(l.credit_cents),0)::bigint::text as c
        from journal_lines l join journal_entries e on e.id = l.entry_id
        where l.tenant_id = ${tenantId} and l.account_id = ${accountId}::uuid and e.status = 'posted' and e.entry_date < ${from} ${subCond}`)
    : [{ d: "0", c: "0" }];
  const broughtForward = natural(account.type, Number(bf.d), Number(bf.c));
  const raw = await rows<{ entryId: string; date: string; memo: string; sub: string | null; debit: string; credit: string; createdAt: string; sourceRef: string | null }>(sql`
    select e.id::text as "entryId", e.entry_date::text as date, e.memo, l.sub_ref as sub, l.debit_cents::text as debit, l.credit_cents::text as credit,
           to_char(e.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US') as "createdAt", e.source_ref as "sourceRef"
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where l.tenant_id = ${tenantId} and l.account_id = ${accountId}::uuid and e.status = 'posted'
      ${from ? sql`and e.entry_date >= ${from}` : sql``} ${to ? sql`and e.entry_date <= ${to}` : sql``} ${subCond}
    order by e.entry_date, e.created_at, e.id
    limit ${MAX_LINES + 1}`);
  const truncated = raw.length > MAX_LINES;
  const refOf = new Map(raw.map((r) => [r.entryId, r.sourceRef]));
  const reg = register(
    account.type,
    broughtForward,
    raw.slice(0, MAX_LINES).map((r) => ({ entryId: r.entryId, date: r.date, memo: r.memo, sub: r.sub, debit: Number(r.debit), credit: Number(r.credit), createdAt: r.createdAt })),
  );
  const subs = new Set<string | null>(reg.map((l) => l.sub));
  let tie: TieOutRow | undefined;
  if (by) {
    tie = tieOut(await subSums(tenantId, to ?? undefined), [account])[0];
    for (const p of tie?.parties ?? []) subs.add(p.sub);
  }
  if (sub && sub !== "none") subs.add(sub);
  const labels = await subLabels(tenantId, [...subs]);
  let parties: RegisterView["parties"] = null;
  if (by) {
    parties = (tie?.parties ?? []).map((p) => ({ ...p, label: labels.get(p.sub) ?? p.sub }));
    if (tie && tie.unkeyed !== 0) parties.push({ sub: "none", label: "No subledger key (a tie-out difference)", balance: tie.unkeyed });
  }
  return { account, from, to, sub, broughtForward, lines: reg.map((l) => ({ ...l, sourceRef: refOf.get(l.entryId) ?? null })), truncated, parties, labels };
}

export type SourceView =
  | { kind: "bank_transaction"; id: string; row: Row | null }
  | { kind: "job"; id: string; row: Row | null; which: "revenue" | "cost" | "hand" }
  | { kind: "expense_claim"; id: string; row: Row | null }
  | { kind: "opening_balance"; id: string; row: Row | null }
  | { kind: "other"; ref: string };

async function sourceRecord(tenantId: string, ref: string | null): Promise<SourceView> {
  if (!ref) return { kind: "other", ref: "" };
  const [type, id] = [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)];
  if (!UUID_RE.test(id)) return { kind: "other", ref };
  if (type === "bank_transaction") {
    const [row] = await rows<Row>(sql`
      select t.id::text, t.posted_date::text as "postedDate", t.amount_cents as "amountCents", t.merchant, t.description, t.pending,
             t.review_status as "reviewStatus", t.removed_at as "removedAt", t.payment_kind as "paymentKind",
             a.name as "bankName", a.mask, c.name as "categoryName", w.id::text as "bookingId", w.couple_names as "bookingName", w.event_date::text as "eventDate"
      from bank_transactions t join bank_accounts a on a.id = t.bank_account_id
      left join ledger_categories c on c.id = t.category_id
      left join weddings w on w.id = t.booking_id
      where t.id = ${id}::uuid and t.tenant_id = ${tenantId}`);
    return { kind: "bank_transaction", id, row: row ?? null };
  }
  if (type === "job_revenue" || type === "job_cost" || type === "hand_deposit" || type === "hand_balance") {
    const [row] = await rows<Row>(sql`
      select id::text, couple_names as names, event_date::text as "eventDate", total_amount::text as total, status,
             cancelled_at as "cancelledAt", archived_at as "archivedAt", package_type as "packageType",
             deposit_amount::text as deposit, is_deposit_paid as "depositPaid", is_balance_paid as "balancePaid",
             deposit_paid_on::text as "depositPaidOn", balance_paid_on::text as "balancePaidOn", books_excluded_at as "excludedAt"
      from weddings where id = ${id}::uuid and tenant_id = ${tenantId}`);
    return { kind: "job", id, row: row ?? null, which: type === "job_revenue" ? "revenue" : type === "job_cost" ? "cost" : "hand" };
  }
  if (type === "expense_claim") {
    const [row] = await rows<Row>(sql`
      select c.id::text, c.claimant_name as claimant, c.merchant, c.description, c.amount_cents as "amountCents", c.spent_on::text as "spentOn",
             c.status, c.payout_status as "payoutStatus", c.decided_by as "decidedBy", c.receipt_id::text as "receiptId",
             w.couple_names as "jobName", w.event_date::text as "eventDate"
      from expense_claims c left join weddings w on w.id = c.wedding_id
      where c.id = ${id}::uuid and c.tenant_id = ${tenantId}`);
    return { kind: "expense_claim", id, row: row ?? null };
  }
  if (type === "opening_balance") {
    const [row] = await rows<Row>(sql`select id::text, name, mask, type from bank_accounts where id = ${id}::uuid and tenant_id = ${tenantId}`);
    return { kind: "opening_balance", id, row: row ?? null };
  }
  return { kind: "other", ref };
}

/** The audit entity a source's own changes are logged under. */
function auditEntityFor(ref: string | null): { type: string; id: string }[] {
  if (!ref) return [];
  const type = ref.slice(0, ref.indexOf(":"));
  const id = ref.slice(ref.indexOf(":") + 1);
  if (type === "bank_transaction") return [{ type: "bank_transaction", id }];
  if (type === "job_revenue" || type === "job_cost" || type === "hand_deposit" || type === "hand_balance") return [{ type: "job", id }];
  if (type === "expense_claim") return [{ type: "expense_claim", id }];
  return [];
}

/** One journal entry: its lines, every version of it, its source record and the audit history of both. */
export async function entryDetail(tenantId: string, entryId: string) {
  if (!UUID_RE.test(entryId)) return null;
  const [entry] = await rows<{
    id: string; date: string; memo: string; status: string; voidReason: string | null; voidedAt: string | null; sourceType: string;
    sourceRef: string | null; adjustsPeriod: string | null; createdAt: string;
  }>(sql`
    select id::text, entry_date::text as date, memo, status, void_reason as "voidReason", voided_at::text as "voidedAt", source_type as "sourceType",
           source_ref as "sourceRef", adjusts_period::text as "adjustsPeriod", created_at::text as "createdAt"
    from journal_entries where id = ${entryId}::uuid and tenant_id = ${tenantId}`);
  if (!entry) return null;
  const lines = await rows<{ accountId: string; code: string; name: string; type: string; sub: string | null; debit: string; credit: string }>(sql`
    select a.id::text as "accountId", a.code, a.name, a.type, l.sub_ref as sub, l.debit_cents::text as debit, l.credit_cents::text as credit
    from journal_lines l join ledger_accounts a on a.id = l.account_id
    where l.entry_id = ${entryId}::uuid and l.tenant_id = ${tenantId}
    order by l.debit_cents desc, a.code`);
  const versions = entry.sourceRef
    ? await rows<{ id: string; date: string; status: string; memo: string; voidReason: string | null; adjustsPeriod: string | null; createdAt: string }>(sql`
        select id::text, entry_date::text as date, status, memo, void_reason as "voidReason", adjusts_period::text as "adjustsPeriod", created_at::text as "createdAt"
        from journal_entries where tenant_id = ${tenantId} and source_ref = ${entry.sourceRef} order by created_at, id`)
    : [];
  const source = await sourceRecord(tenantId, entry.sourceRef);
  const entities = auditEntityFor(entry.sourceRef);
  if (source.kind === "bank_transaction" && source.row?.bookingId) entities.push({ type: "job", id: String(source.row.bookingId) });
  const entityConds = [
    sql`(entity_type = 'journal_entry' and entity_id = ${entry.id})`,
    ...(entry.sourceRef ? [sql`(entity_type = 'journal_entry' and cause like ${`%source ${entry.sourceRef}`})`] : []),
    ...entities.map((e) => sql`(entity_type = ${e.type} and entity_id = ${e.id})`),
  ];
  const history = await rows<{ id: string; at: string; actor: string; action: string; entityType: string; entityId: string | null; reason: string | null; cause: string | null; before: unknown; after: unknown }>(sql`
    select id::text, at::text, actor, action, entity_type as "entityType", entity_id as "entityId", reason, cause, before, after
    from audit_log where tenant_id = ${tenantId} and (${sql.join(entityConds, sql` or `)})
    order by id desc limit 200`);
  const labels = await subLabels(tenantId, lines.map((l) => l.sub));
  return {
    entry,
    lines: lines.map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit), subLabel: l.sub ? labels.get(l.sub) ?? l.sub : null })),
    versions,
    source,
    history,
  };
}

/** The live journal entry ids for some sources (e.g. a vendor's bank payments). */
export async function liveEntriesFor(tenantId: string, refs: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = refs.filter((r) => /^[a-z_]+:[0-9a-f-]{36}$/.test(r)).slice(0, 500);
  if (!clean.length) return out;
  const r = await rows<{ ref: string; id: string }>(sql`
    select source_ref as ref, id::text from journal_entries
    where tenant_id = ${tenantId} and status = 'posted' and source_type <> 'adjustment'
      and source_ref in (${sql.join(clean.map((x) => sql`${x}`), sql`, `)})`);
  for (const x of r) out.set(x.ref, x.id);
  return out;
}
