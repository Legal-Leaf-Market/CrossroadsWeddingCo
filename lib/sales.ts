import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { crewMembers, crmAccounts, weddings } from "@/lib/db/schema";
import { auditQuietly } from "@/lib/audit";
import { ledgerToday, postBankLedgerQuietly } from "@/lib/books/ledger";
import { creditFor } from "@/lib/books/logic";
import { subId, tieOut } from "@/lib/books/subledger-logic";
import { accountsMeta, subSums } from "@/lib/books/subledger";
import { nameSlug } from "@/lib/hub-constants";
import { CORPORATE_PACKAGE } from "@/lib/invoice";
import { commissionPayable, commissionsFor, CRM_KINDS, stageOf, termsForSale, type CrmKind, type Stage } from "@/lib/sales-logic";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";

// The sales pipeline (2026-11-13): playbook lead -> CRM account -> sales order
// (a booking with its closer, account manager and commission terms) ->
// invoice -> payments -> revenue and commissions in the books. House account
// only, behind the owner dashboard key. Rules are pure in lib/sales-logic.ts.

const T = HOUSE_TENANT_ID;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const toCents = (v: string | number | null | undefined) => Math.round(Number(v ?? 0) * 100) || 0;

export async function activeCrew() {
  return db
    .select({ id: crewMembers.id, name: crewMembers.name, payMethod: crewMembers.payMethod, retiredAt: crewMembers.retiredAt })
    .from(crewMembers)
    .where(and(eq(crewMembers.tenantId, T), isNull(crewMembers.retiredAt)))
    .orderBy(asc(crewMembers.sort), asc(crewMembers.createdAt));
}

export async function listAccounts() {
  const rows = await db.select().from(crmAccounts).where(and(eq(crmAccounts.tenantId, T), isNull(crmAccounts.archivedAt))).orderBy(asc(crmAccounts.name));
  const counts = (
    await db.execute(sql`
      select crm_account_id::text as id, count(*)::int as n, coalesce(sum(total_amount),0)::text as total
      from weddings where tenant_id = ${T} and crm_account_id is not null and books_excluded_at is null and status <> 'cancelled'
      group by crm_account_id`)
  ).rows as { id: string; n: number; total: string }[];
  const by = new Map(counts.map((c) => [c.id, c]));
  return rows.map((a) => ({ ...a, bookings: by.get(a.id)?.n ?? 0, bookedCents: toCents(by.get(a.id)?.total) }));
}

export type AccountInput = {
  name: string;
  kind: CrmKind;
  managerCrewId: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  playbookLeadId: string | null;
};

async function crewOk(id: string | null): Promise<boolean> {
  if (!id) return true;
  if (!UUID_RE.test(id)) return false;
  const [c] = await db.select({ id: crewMembers.id }).from(crewMembers).where(and(eq(crewMembers.id, id), eq(crewMembers.tenantId, T), isNull(crewMembers.retiredAt))).limit(1);
  return !!c;
}

/** Add an account, or return the one already made from the same playbook lead. */
export async function createAccount(input: AccountInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!CRM_KINDS.includes(input.kind)) return { ok: false, error: "Pick what kind of account it is." };
  if (!(await crewOk(input.managerCrewId))) return { ok: false, error: "Pick someone on the crew as the account manager." };
  if (input.playbookLeadId) {
    const [found] = await db.select({ id: crmAccounts.id }).from(crmAccounts).where(and(eq(crmAccounts.tenantId, T), eq(crmAccounts.playbookLeadId, input.playbookLeadId))).limit(1);
    if (found) return { ok: true, id: found.id };
  }
  const [row] = await db
    .insert(crmAccounts)
    .values({ tenantId: T, ...input, name: input.name.slice(0, 160) })
    .onConflictDoNothing()
    .returning({ id: crmAccounts.id });
  if (!row) {
    const [again] = await db.select({ id: crmAccounts.id }).from(crmAccounts).where(and(eq(crmAccounts.tenantId, T), eq(crmAccounts.playbookLeadId, input.playbookLeadId ?? ""))).limit(1);
    if (again) return { ok: true, id: again.id };
    return { ok: false, error: "Couldn't save that account." };
  }
  await auditQuietly({ tenantId: T, actor: "owner dashboard", action: "crm.account_create", entityType: "crm_account", entityId: row.id, after: input });
  return { ok: true, id: row.id };
}

/** Change who manages an account (affects sales made from now on; earlier deals keep their terms). */
export async function setAccountManager(accountId: string, managerCrewId: string | null): Promise<boolean> {
  if (!UUID_RE.test(accountId) || !(await crewOk(managerCrewId))) return false;
  const [before] = await db.select().from(crmAccounts).where(and(eq(crmAccounts.id, accountId), eq(crmAccounts.tenantId, T))).limit(1);
  if (!before) return false;
  await db.update(crmAccounts).set({ managerCrewId, updatedAt: new Date() }).where(and(eq(crmAccounts.id, accountId), eq(crmAccounts.tenantId, T)));
  await auditQuietly({ tenantId: T, actor: "owner dashboard", action: "crm.account_manager", entityType: "crm_account", entityId: accountId, before: { managerCrewId: before.managerCrewId }, after: { managerCrewId } });
  return true;
}

export type OrderInput = {
  accountId: string | null;
  type: "wedding" | "corporate";
  clientNames: string;
  email: string;
  phone: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  totalUsd: number;
  depositUsd: number;
  depositReceived: boolean;
  closerCrewId: string | null;
  playbookLeadId: string | null;
  notes: string;
};

/**
 * A sales order: a booking tied to its account and closer, with the
 * commission terms copied on at sale time. Mints the same hub and share
 * tokens as any booking, emails nobody, and its invoice works unchanged.
 */
export async function createSalesOrder(input: OrderInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (input.accountId && !UUID_RE.test(input.accountId)) return { ok: false, error: "Pick an account." };
  if (!(await crewOk(input.closerCrewId))) return { ok: false, error: "Pick who closed it from the crew." };
  const crew = await activeCrew();
  const person = (id: string | null) => {
    const c = id ? crew.find((x) => x.id === id) : undefined;
    return c ? { id: c.id, name: c.name, payMethod: c.payMethod, retired: !!c.retiredAt } : null;
  };
  let manager = null;
  let earlier = false;
  if (input.accountId) {
    const [acct] = await db.select().from(crmAccounts).where(and(eq(crmAccounts.id, input.accountId), eq(crmAccounts.tenantId, T))).limit(1);
    if (!acct) return { ok: false, error: "That account isn't on file." };
    manager = person(acct.managerCrewId);
    const [n] = (
      await db.execute(sql`select count(*)::int as n from weddings where tenant_id = ${T} and crm_account_id = ${input.accountId}::uuid and books_excluded_at is null and status <> 'cancelled'`)
    ).rows as { n: number }[];
    earlier = (n?.n ?? 0) > 0;
  }
  const terms = termsForSale({ closer: person(input.closerCrewId), manager, accountHasEarlierBooking: earlier });
  const total = Math.max(0, input.totalUsd);
  const [row] = await db
    .insert(weddings)
    .values({
      tenantId: T,
      accessToken: `${nameSlug(input.clientNames)}-${randomBytes(8).toString("hex")}`,
      shareToken: randomBytes(24).toString("hex"),
      coupleNames: input.clientNames.slice(0, 255),
      contactEmail: input.email || null,
      contactPhone: input.phone || null,
      eventDate: input.eventDate,
      venueName: input.venueName.slice(0, 255),
      venueAddress: input.venueAddress || null,
      packageType: input.type === "corporate" ? CORPORATE_PACKAGE : "standard_dj_mc",
      addons: [],
      totalAmount: total.toFixed(2),
      depositAmount: Math.min(Math.max(0, input.depositUsd), total).toFixed(2),
      isDepositPaid: input.depositReceived,
      depositPaidOn: input.depositReceived ? ledgerToday() : null,
      status: input.depositReceived ? "deposit_paid" : "inquiry",
      notes: input.notes || null,
      crmAccountId: input.accountId,
      closerCrewId: terms.closerId,
      accountManagerCrewId: terms.managerId,
      commissionDirectCents: terms.directCents,
      commissionMgmtBps: terms.mgmtBps,
      playbookLeadId: input.playbookLeadId,
    })
    .returning({ id: weddings.id });
  await auditQuietly({ tenantId: T, actor: "owner dashboard", action: "sales.order_create", entityType: "job", entityId: row.id, after: { ...input, terms } });
  await postBankLedgerQuietly(T, { actor: "owner dashboard", cause: "sales order created" });
  return { ok: true, id: row.id };
}

export type PipelineRow = {
  id: string;
  name: string;
  eventDate: string;
  type: "wedding" | "corporate";
  accountId: string | null;
  accountName: string | null;
  closer: string | null;
  manager: string | null;
  contractCents: number;
  creditedCents: number;
  stage: Stage;
  commissions: { role: "closer" | "account_manager"; person: string; cents: number; earned: boolean; payable: boolean }[];
};

/** Every sales order (and every other live booking), newest event last, with stage and commissions. */
export async function pipeline(): Promise<PipelineRow[]> {
  const today = ledgerToday();
  const crew = new Map((await db.select({ id: crewMembers.id, name: crewMembers.name }).from(crewMembers).where(eq(crewMembers.tenantId, T))).map((c) => [c.id, c.name]));
  const accts = new Map((await db.select({ id: crmAccounts.id, name: crmAccounts.name }).from(crmAccounts).where(eq(crmAccounts.tenantId, T))).map((a) => [a.id, a.name]));
  const rows = await db
    .select()
    .from(weddings)
    .where(and(eq(weddings.tenantId, T), isNull(weddings.archivedAt), isNull(weddings.booksExcludedAt)))
    .orderBy(asc(weddings.eventDate));
  const bank = (
    await db.execute(sql`
      select booking_id::text as id, coalesce(sum(amount_cents),0)::bigint::text as cents,
             count(*) filter (where payment_kind = 'deposit')::int as deps
      from bank_transactions where tenant_id = ${T} and booking_id is not null and removed_at is null and not pending and amount_cents > 0
      group by booking_id`)
  ).rows as { id: string; cents: string; deps: number }[];
  const bankBy = new Map(bank.map((b) => [b.id, b]));
  return rows.map((w) => {
    const contract = toCents(w.totalAmount);
    const b = bankBy.get(w.id);
    const credit = creditFor({
      totalCents: contract,
      depositCents: toCents(w.depositAmount),
      isDepositPaid: !!w.isDepositPaid,
      isBalancePaid: !!w.isBalancePaid,
      bankCents: Number(b?.cents ?? 0),
      bankDepositLines: b?.deps ?? 0,
    });
    const paidInFull = commissionPayable({ contractCents: contract, creditedCents: credit.creditedCents, isBalancePaid: !!w.isBalancePaid });
    const cancelled = w.status === "cancelled";
    const comms = commissionsFor({
      contractCents: contract,
      cancelled,
      excluded: false,
      closerId: w.closerCrewId,
      managerId: w.accountManagerCrewId,
      directCents: w.commissionDirectCents,
      mgmtBps: w.commissionMgmtBps,
    });
    return {
      id: w.id,
      name: w.coupleNames,
      eventDate: w.eventDate,
      type: w.packageType === CORPORATE_PACKAGE ? "corporate" : "wedding",
      accountId: w.crmAccountId,
      accountName: w.crmAccountId ? accts.get(w.crmAccountId) ?? null : null,
      closer: w.closerCrewId ? crew.get(w.closerCrewId) ?? null : null,
      manager: w.accountManagerCrewId ? crew.get(w.accountManagerCrewId) ?? null : null,
      contractCents: contract,
      creditedCents: credit.creditedCents,
      stage: stageOf({ eventDate: w.eventDate, cancelled, isDepositPaid: !!w.isDepositPaid, paidInFull }, today),
      commissions: comms.map((c) => ({
        role: c.role,
        person: crew.get(c.crewId) ?? "Former crew",
        cents: c.cents,
        earned: w.eventDate <= today,
        payable: w.eventDate <= today && paidInFull,
      })),
    };
  });
}

/** Commissions per person: owed per the books (2600, by person), and how much of it is ready to pay. */
export async function commissionsByPerson() {
  const [sums, accounts, rows] = await Promise.all([subSums(T), accountsMeta(T), pipeline()]);
  const tie = tieOut(sums, accounts).find((t) => t.systemKey === "commissions_payable");
  const crew = new Map((await db.select({ id: crewMembers.id, name: crewMembers.name }).from(crewMembers).where(eq(crewMembers.tenantId, T))).map((c) => [c.id, c.name]));
  const ready = new Map<string, number>();
  const ahead = new Map<string, number>();
  for (const r of rows) {
    for (const c of r.commissions) {
      if (c.payable) ready.set(c.person, (ready.get(c.person) ?? 0) + c.cents);
      else if (!c.earned) ahead.set(c.person, (ahead.get(c.person) ?? 0) + c.cents);
    }
  }
  const people = new Set<string>([...ready.keys(), ...ahead.keys()]);
  const owed = new Map<string, number>();
  for (const p of tie?.parties ?? []) {
    const name = crew.get(subId(p.sub)) ?? "Former crew";
    owed.set(name, (owed.get(name) ?? 0) + p.balance);
    people.add(name);
  }
  return [...people].sort().map((name) => ({ name, owedCents: owed.get(name) ?? 0, readyCents: ready.get(name) ?? 0, aheadCents: ahead.get(name) ?? 0 }));
}
