"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLAIM_STATUS_LABEL, PAYOUT_STATUS_LABEL, type ClaimAction, type ClaimStatus, type PayoutStatus } from "@/lib/expense-logic";

export type ReviewClaim = {
  id: string;
  claimantName: string;
  merchant: string;
  description: string;
  amountCents: number;
  spentOn: string;
  categoryName: string | null;
  jobName: string | null;
  jobDate: string | null;
  hasReceipt: boolean;
  status: string;
  payoutStatus: string;
  decidedBy: string | null;
  decisionNote: string;
  payoutDecidedBy: string | null;
  payoutNote: string;
  vetoFinal: boolean;
  reimbursed: boolean;
  /** What the signed-in person may do, from the same rules the server applies. */
  allowed: ClaimAction[];
};

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const btn = "rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta-dark disabled:opacity-50";
const primary = "rounded-full bg-terracotta px-4 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50";
const field = "w-full rounded-lg border border-parchment bg-cream/40 px-2.5 py-1.5 text-sm text-ink focus:border-terracotta focus:outline-none";

const NEEDS_NOTE: ClaimAction[] = ["reject", "void", "payout_veto", "payout_escalate"];
const ACTION_LABEL: Partial<Record<ClaimAction, string>> = {
  approve: "Approve report",
  reject: "Don't approve",
  void: "Void",
  payout_approve: "Approve payout",
  payout_veto: "Veto payout",
  payout_escalate: "Escalate to tiebreaker",
};

function stageOf(c: ReviewClaim): "report" | "payout" | "pay" | "paid" | "closed" {
  if (c.status === "submitted") return "report";
  if (c.status !== "approved") return "closed";
  if (c.reimbursed) return "paid";
  return c.payoutStatus === "approved" ? "pay" : "payout";
}

const SECTIONS: { key: ReturnType<typeof stageOf>; title: string; empty: string }[] = [
  { key: "report", title: "Reports waiting for approval", empty: "No reports waiting." },
  { key: "payout", title: "Payouts waiting for a decision", empty: "No payouts waiting." },
  { key: "pay", title: "Approved to pay back", empty: "Nothing approved to pay right now." },
  { key: "paid", title: "Paid back", empty: "Nothing paid back yet." },
  { key: "closed", title: "Not approved or voided", empty: "None." },
];

export default function ClaimReview({ claims, payoutLines }: { claims: ReviewClaim[]; payoutLines: { id: string; label: string }[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [payout, setPayout] = useState("");

  async function act(c: ReviewClaim, action: ClaimAction) {
    const note = notes[c.id] ?? "";
    if (NEEDS_NOTE.includes(action) && note.trim().length < 3) {
      setMsg({ id: c.id, text: "Write a short reason in the note box first." });
      return;
    }
    setBusy(c.id);
    setMsg(null);
    const res = await fetch(`/api/app/expenses/${c.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
    setBusy("");
    if (!res || !res.ok) {
      setMsg({ id: c.id, text: json.error ?? "That didn't save." });
      return;
    }
    router.refresh();
  }

  async function link(bankTransactionId: string | null, ids: string[]) {
    setBusy("link");
    setMsg(null);
    const res = await fetch("/api/app/expenses/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimIds: ids, bankTransactionId }),
    }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
    setBusy("");
    if (!res || !res.ok) {
      setMsg({ id: "link", text: json.error ?? "That didn't save." });
      return;
    }
    setPicked(new Set());
    setPayout("");
    router.refresh();
  }

  const payable = claims.filter((c) => stageOf(c) === "pay" && c.allowed.includes("link"));
  const pickedTotal = claims.filter((c) => picked.has(c.id)).reduce((s, c) => s + c.amountCents, 0);

  return (
    <div className="mt-8 space-y-10">
      {SECTIONS.map((sec) => {
        const list = claims.filter((c) => stageOf(c) === sec.key);
        if (sec.key === "closed" && list.length === 0) return null;
        return (
          <section key={sec.key}>
            <h2 className="text-lg font-semibold text-charcoal">
              {sec.title} <span className="text-sm font-normal text-ink/55">{list.length}</span>
            </h2>
            {sec.key === "pay" && payable.length > 0 && (
              <div className="mt-3 grid gap-2 rounded-2xl border border-parchment bg-white p-4 text-sm sm:flex sm:flex-wrap sm:items-center">
                <span className="text-ink/70">
                  Tick the reports one bank payout covered ({usd(pickedTotal)} picked), then pick that payout:
                </span>
                <select className={`${field} sm:w-96`} value={payout} onChange={(e) => setPayout(e.target.value)} aria-label="Bank payout">
                  <option value="">Pick the money-out line...</option>
                  {payoutLines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button type="button" className={primary} disabled={!payout || picked.size === 0 || busy !== ""} onClick={() => link(payout, [...picked])}>
                  {busy === "link" ? "Saving..." : "Record payout"}
                </button>
                {msg?.id === "link" && <span className="font-semibold text-terracotta-dark">{msg.text}</span>}
              </div>
            )}
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">{sec.empty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-parchment rounded-2xl border border-parchment bg-white">
                {list.map((c) => {
                  const buttons = c.allowed.filter((a) => a !== "link" && a !== "unlink");
                  return (
                    <li key={c.id} className="grid gap-2 p-4 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <div className="flex min-w-0 items-start gap-3">
                          {sec.key === "pay" && c.allowed.includes("link") && (
                            <input
                              type="checkbox"
                              className="mt-1"
                              aria-label={`Include ${c.claimantName}'s ${usd(c.amountCents)}`}
                              checked={picked.has(c.id)}
                              onChange={(e) =>
                                setPicked((p) => {
                                  const n = new Set(p);
                                  if (e.target.checked) n.add(c.id);
                                  else n.delete(c.id);
                                  return n;
                                })
                              }
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-charcoal">
                              {c.claimantName} · {c.merchant || "Expense"}
                            </p>
                            <p className="break-words text-ink/70">{c.description}</p>
                            <p className="text-xs text-ink/55">
                              Paid {c.spentOn}
                              {c.jobName ? ` · for ${c.jobName}${c.jobDate ? ` (${c.jobDate})` : ""}` : " · not tied to an event"}
                              {c.categoryName ? ` · ${c.categoryName}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold tabular-nums text-charcoal">{usd(c.amountCents)}</p>
                          <p className="text-xs text-ink/60">
                            {c.status === "approved"
                              ? c.reimbursed
                                ? "Paid back"
                                : PAYOUT_STATUS_LABEL[c.payoutStatus as PayoutStatus]
                              : CLAIM_STATUS_LABEL[c.status as ClaimStatus]}
                            {c.vetoFinal && " (final)"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
                        {c.hasReceipt ? (
                          <a href={`/api/app/expenses/${c.id}/receipt`} target="_blank" rel="noopener" className="font-semibold text-terracotta underline decoration-parchment underline-offset-2">
                            View receipt
                          </a>
                        ) : (
                          <span className="font-semibold text-terracotta-dark">No receipt attached</span>
                        )}
                        {c.decidedBy && (
                          <span>
                            Report {c.status === "approved" ? "approved" : c.status} by {c.decidedBy}
                            {c.decisionNote ? `: "${c.decisionNote}"` : ""}
                          </span>
                        )}
                        {c.payoutDecidedBy && (
                          <span>
                            Payout {c.payoutStatus} by {c.payoutDecidedBy}
                            {c.payoutNote ? `: "${c.payoutNote}"` : ""}
                          </span>
                        )}
                      </div>
                      {c.vetoFinal && (
                        <p className="text-xs font-semibold text-terracotta-dark">
                          The payout veto is final. The preparer should void this report so it stops counting as owed back.
                        </p>
                      )}
                      {buttons.length > 0 && (
                        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                          {buttons.some((b) => NEEDS_NOTE.includes(b)) && (
                            <input
                              className={`${field} sm:w-72`}
                              placeholder="Note (needed to decline, veto, void or escalate)"
                              maxLength={1000}
                              value={notes[c.id] ?? ""}
                              onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                            />
                          )}
                          <div className="flex flex-wrap gap-2">
                            {buttons.map((a) => (
                              <button
                                key={a}
                                type="button"
                                disabled={busy !== ""}
                                className={a === "approve" || a === "payout_approve" ? primary : btn}
                                onClick={() => act(c, a)}
                              >
                                {busy === c.id ? "Saving..." : ACTION_LABEL[a]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {c.reimbursed && c.allowed.includes("unlink") && (
                        <div>
                          <button type="button" className={btn} disabled={busy !== ""} onClick={() => link(null, [c.id])}>
                            Unlink payout
                          </button>
                        </div>
                      )}
                      {msg?.id === c.id && <p className="font-semibold text-terracotta-dark">{msg.text}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
