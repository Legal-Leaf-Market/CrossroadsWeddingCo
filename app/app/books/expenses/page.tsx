import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import ClaimReview, { type ReviewClaim } from "@/components/expenses/ClaimReview";
import { getBooksWorkspace } from "@/lib/auth";
import { decide, owedBackByPerson, ROLE_LABEL, type ClaimAction, type Role } from "@/lib/expense-logic";
import { listClaims, payoutCandidates } from "@/lib/expenses";
import { rolesFor } from "@/lib/finance-roles";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// Expense reports for whoever keeps the books (2026-11-13). Two approvals per
// report (lib/expense-logic.ts): the preparer approves the report, then the
// approver (or the tiebreaker, on the approver's own report or an escalated
// veto) approves the payout. Only then can the bank payout be linked. The
// buttons each person sees are computed from the same rules the server applies.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Expenses | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const ACTIONS: ClaimAction[] = ["approve", "reject", "void", "payout_approve", "payout_veto", "payout_escalate", "link", "unlink"];

export default async function ExpensesPage() {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const tenantId = ws.tenant.id;
  const [claims, lines, myRoles] = await Promise.all([listClaims(tenantId), payoutCandidates(tenantId), rolesFor(tenantId, ws.user.email)]);

  // Roles of everyone named on a claim, looked up once each.
  const emails = new Set<string>();
  for (const c of claims) {
    if (c.claimantEmail) emails.add(c.claimantEmail.toLowerCase());
    if (c.payoutDecidedBy) emails.add(c.payoutDecidedBy.toLowerCase());
  }
  const roleOf = new Map<string, Set<Role>>();
  await Promise.all([...emails].map(async (e) => roleOf.set(e, await rolesFor(tenantId, e))));
  const none = new Set<Role>();
  const actor = { email: ws.user.email, roles: myRoles };

  const rows: ReviewClaim[] = claims.map((c) => {
    const state = {
      kind: c.kind,
      status: c.status,
      payoutStatus: c.payoutStatus,
      reimbursed: !!c.reimbursedBankTransactionId,
      claimantEmail: c.claimantEmail,
      claimantRoles: (c.claimantEmail && roleOf.get(c.claimantEmail.toLowerCase())) || none,
      vetoFinal: c.payoutStatus === "vetoed" && !!c.payoutDecidedBy && (roleOf.get(c.payoutDecidedBy.toLowerCase())?.has("tiebreaker") ?? false),
    };
    // "a reason" stands in for the note so the check is about who and when, not the text.
    const allowed = ACTIONS.filter((a) => decide(actor, state, a, "a reason").ok);
    return {
      id: c.id,
      claimantName: c.claimantName,
      merchant: c.merchant,
      description: c.description,
      amountCents: c.amountCents,
      spentOn: c.spentOn,
      categoryName: c.categoryName,
      jobName: c.jobName,
      jobDate: c.jobDate,
      hasReceipt: !!c.receiptId,
      status: c.status,
      payoutStatus: c.payoutStatus,
      decidedBy: c.decidedBy,
      decisionNote: c.decisionNote,
      payoutDecidedBy: c.payoutDecidedBy,
      payoutNote: c.payoutNote,
      vetoFinal: state.vetoFinal,
      reimbursed: !!c.reimbursedBankTransactionId,
      allowed,
    };
  });
  const owed = owedBackByPerson(claims);

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Books
      </Link>
      <h1 className="mt-3 text-3xl text-charcoal">Expense reports</h1>
      <p className="mt-2 max-w-2xl text-ink/70">
        Staff send receipts from their own link. The preparer approves each report, then the payout is approved before anyone is
        paid back. Nobody decides a payout to themselves.
      </p>
      <p className="mt-2 text-sm text-ink/60">
        You&apos;re signed in as {ws.user.email}
        {myRoles.size > 0 ? `, ${[...myRoles].map((r) => ROLE_LABEL[r]).join(" and ")}.` : ", with no finance role here, so you can look but not decide."}
      </p>

      {owed.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {owed.map((o) => (
            <div key={o.name} className="rounded-2xl border border-parchment bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-ink/55">Owed back to {o.name}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{usd(o.cents)}</p>
              <p className="text-xs text-ink/55">
                {o.count} approved report{o.count === 1 ? "" : "s"} not yet paid
              </p>
            </div>
          ))}
        </div>
      )}

      <ClaimReview
        claims={rows}
        payoutLines={lines.map((l) => ({
          id: l.id,
          label: `${l.postedDate} · ${usd(l.amountCents)} · ${l.merchant || l.description || "Bank line"} (${l.accountName})`,
        }))}
      />
    </AccountShell>
  );
}
