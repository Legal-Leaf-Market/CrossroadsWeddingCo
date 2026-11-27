import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import PayoutReview, { type ReviewRequest } from "@/components/payouts/PayoutReview";
import { getBooksWorkspace } from "@/lib/auth";
import { rolesFor } from "@/lib/finance-roles";
import { canRequest, decideRequest, ROLE_LABEL_PAYOUT, type RequestAction, type Role } from "@/lib/payout-logic";
import { commissionsReady, listRequests, payees, payoutCategories, payoutLines } from "@/lib/payouts";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// Cash payout requests for whoever keeps the books (2026-11-27, finance task
// 9). The preparer requests, the approver approves or vetoes (the tiebreaker
// on the approver's own money or an escalated veto), and only then is the bank
// line matched to the payout. Buttons come from the same rules the server applies.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Payouts | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const ACTIONS: RequestAction[] = ["approve", "veto", "escalate", "void", "link", "unlink"];

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ crew?: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const tenantId = ws.tenant.id;
  const sp = await searchParams;
  const [requests, lines, people, categories, ready, myRoles] = await Promise.all([
    listRequests(tenantId),
    payoutLines(tenantId),
    payees(tenantId),
    payoutCategories(tenantId),
    commissionsReady(tenantId),
    rolesFor(tenantId, ws.user.email),
  ]);

  const emails = new Set<string>();
  for (const r of requests) {
    if (r.payeeEmail) emails.add(r.payeeEmail.toLowerCase());
    if (r.decidedBy) emails.add(r.decidedBy.toLowerCase());
  }
  const roleOf = new Map<string, Set<Role>>();
  await Promise.all([...emails].map(async (e) => roleOf.set(e, await rolesFor(tenantId, e))));
  const none = new Set<Role>();
  const actor = { email: ws.user.email, roles: myRoles };

  const rows: ReviewRequest[] = requests.map((r) => {
    const state = {
      status: r.status,
      paid: !!r.bankTransactionId,
      requestedBy: r.requestedBy,
      payeeEmail: r.payeeEmail,
      payeeRoles: (r.payeeEmail && roleOf.get(r.payeeEmail.toLowerCase())) || none,
      vetoFinal: r.status === "vetoed" && !!r.decidedBy && (roleOf.get(r.decidedBy.toLowerCase())?.has("tiebreaker") ?? false),
    };
    // "a reason" stands in for the note so the check is about who and when, not the text.
    const allowed = ACTIONS.filter((a) => decideRequest(actor, state, a, "a reason").ok);
    return {
      id: r.id,
      kind: r.kind,
      payeeName: r.payeeName,
      amountCents: r.amountCents,
      purpose: r.purpose,
      categoryName: r.categoryName,
      status: r.status,
      requestedBy: r.requestedBy,
      requestedOn: r.requestedAt.toISOString().slice(0, 10),
      decidedBy: r.decidedBy,
      decisionNote: r.decisionNote,
      voidedBy: r.voidedBy,
      voidNote: r.voidNote,
      paid: !!r.bankTransactionId,
      paidLine: r.bankTransactionId ? `${r.linePostedDate} · ${r.lineMerchant || r.lineDescription || "Bank line"}` : null,
      linkedBy: r.linkedBy,
      vetoFinal: state.vetoFinal,
      allowed,
    };
  });

  const readyList = [...ready.entries()].filter(([, v]) => v.readyCents > 0 || v.owedCents > 0);
  const mayRequest = canRequest(actor) === null;
  const presetCrew = sp.crew && people.some((p) => p.id === sp.crew) ? sp.crew : null;

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Books
      </Link>
      <h1 className="mt-3 text-3xl text-charcoal">Payouts</h1>
      <p className="mt-2 max-w-2xl text-ink/70">
        Money going out that isn&apos;t an expense report: commissions, owner draws, anyone paid outside a cost plan. The preparer asks, the
        approver approves or vetoes, and only then is the bank payment matched to it. Nobody decides money going to themselves.
      </p>
      <p className="mt-2 text-sm text-ink/60">
        You&apos;re signed in as {ws.user.email}
        {myRoles.size > 0 ? `, ${[...myRoles].map((r) => ROLE_LABEL_PAYOUT[r]).join(" and ")}.` : ", with no finance role here, so you can look but not decide."}
      </p>

      {readyList.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {readyList.map(([id, v]) => (
            <div key={id} className="rounded-2xl border border-parchment bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-ink/55">Commission ready for {v.name}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{usd(v.readyCents)}</p>
              <p className="text-xs text-ink/55">{usd(v.owedCents)} owed in the books (2600)</p>
            </div>
          ))}
        </div>
      )}

      <PayoutReview
        requests={rows}
        mayRequest={mayRequest}
        people={people.map((p) => ({ id: p.id, name: p.name, readyCents: ready.get(p.id)?.readyCents ?? 0 }))}
        categories={categories.map((c) => ({ id: c.id, name: c.kind === "equity" ? `${c.name} (owner)` : c.name }))}
        commissions={ws.tenant.kind === "house"}
        presetCrew={presetCrew}
        payoutLines={lines.map((l) => ({ id: l.id, label: `${l.postedDate} · ${usd(l.amountCents)} · ${l.merchant || l.description || "Bank line"} (${l.accountName})` }))}
      />
    </AccountShell>
  );
}
