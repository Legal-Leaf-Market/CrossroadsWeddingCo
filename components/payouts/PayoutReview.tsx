"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseRequestAmount, PAYOUT_KIND_LABEL, REQUEST_STATUS_LABEL, type PayoutKind, type RequestAction, type RequestStatus } from "@/lib/payout-logic";

export type ReviewRequest = {
  id: string;
  kind: string;
  payeeName: string;
  amountCents: number;
  purpose: string;
  categoryName: string | null;
  status: string;
  requestedBy: string;
  requestedOn: string;
  decidedBy: string | null;
  decisionNote: string;
  voidedBy: string | null;
  voidNote: string;
  paid: boolean;
  paidLine: string | null;
  linkedBy: string | null;
  vetoFinal: boolean;
  /** What the signed-in person may do, from the same rules the server applies. */
  allowed: RequestAction[];
};

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const btn = "rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta-dark disabled:opacity-50";
const primary = "rounded-full bg-terracotta px-4 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50";
const field = "w-full rounded-lg border border-parchment bg-cream/40 px-2.5 py-1.5 text-sm text-ink focus:border-terracotta focus:outline-none";

const NEEDS_NOTE: RequestAction[] = ["veto", "void", "escalate"];
const ACTION_LABEL: Partial<Record<RequestAction, string>> = {
  approve: "Approve payout",
  veto: "Veto",
  escalate: "Escalate to tiebreaker",
  void: "Void",
};

type Stage = "decide" | "pay" | "paid" | "closed";
function stageOf(r: ReviewRequest): Stage {
  if (r.paid) return "paid";
  if (r.status === "approved") return "pay";
  if (r.status === "requested" || r.status === "escalated" || (r.status === "vetoed" && !r.vetoFinal)) return "decide";
  return "closed";
}

const SECTIONS: { key: Stage; title: string; empty: string }[] = [
  { key: "decide", title: "Waiting for a decision", empty: "Nothing waiting." },
  { key: "pay", title: "Approved to pay", empty: "Nothing approved to pay right now." },
  { key: "paid", title: "Paid and matched to the bank", empty: "Nothing paid yet." },
  { key: "closed", title: "Vetoed for good or voided", empty: "None." },
];

export default function PayoutReview({
  requests,
  mayRequest,
  people,
  categories,
  commissions,
  presetCrew,
  payoutLines,
}: {
  requests: ReviewRequest[];
  mayRequest: boolean;
  people: { id: string; name: string; readyCents: number }[];
  categories: { id: string; name: string }[];
  commissions: boolean;
  presetCrew: string | null;
  payoutLines: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [line, setLine] = useState("");

  const preset = presetCrew ? people.find((p) => p.id === presetCrew) : undefined;
  const [kind, setKind] = useState<PayoutKind>(commissions ? "commission" : "other");
  const [crewId, setCrewId] = useState(preset?.id ?? "");
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState(preset && preset.readyCents > 0 ? (preset.readyCents / 100).toFixed(2) : "");
  const [purpose, setPurpose] = useState(preset ? "Commissions ready to pay" : "");
  const [categoryId, setCategoryId] = useState("");

  async function post(url: string, body: unknown, key: string): Promise<boolean> {
    setBusy(key);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
    setBusy("");
    if (!res || !res.ok) {
      setMsg({ id: key, text: json.error ?? "That didn't save." });
      return false;
    }
    router.refresh();
    return true;
  }

  async function submit() {
    const cents = parseRequestAmount(amount);
    if (!cents) return setMsg({ id: "new", text: "Enter the amount in dollars." });
    const ok = await post(
      "/api/app/payouts",
      { kind, crewMemberId: crewId || null, payeeName, amountCents: cents, purpose, categoryId: kind === "other" ? categoryId || null : null },
      "new",
    );
    if (ok) {
      setAmount("");
      setPurpose("");
      setPayeeName("");
    }
  }

  async function act(r: ReviewRequest, action: RequestAction) {
    const note = notes[r.id] ?? "";
    if (NEEDS_NOTE.includes(action) && note.trim().length < 3) return setMsg({ id: r.id, text: "Write a short reason in the note box first." });
    await post(`/api/app/payouts/${r.id}`, { action, note }, r.id);
  }

  async function link(bankTransactionId: string | null, ids: string[]) {
    const ok = await post("/api/app/payouts/link", { requestIds: ids, bankTransactionId }, bankTransactionId ? "link" : ids[0]);
    if (ok) {
      setPicked(new Set());
      setLine("");
    }
  }

  const readyFor = people.find((p) => p.id === crewId)?.readyCents ?? 0;
  const payable = requests.filter((r) => stageOf(r) === "pay" && r.allowed.includes("link"));
  const pickedTotal = requests.filter((r) => picked.has(r.id)).reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="mt-8 space-y-10">
      {mayRequest && (
        <section className="rounded-2xl border border-parchment bg-white p-4 text-sm">
          <h2 className="text-lg font-semibold text-charcoal">Request a payout</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs text-ink/60">What kind</span>
              <select className={field} value={kind} onChange={(e) => setKind(e.target.value as PayoutKind)}>
                {(commissions ? (["commission", "other"] as const) : (["other"] as const)).map((k) => (
                  <option key={k} value={k}>
                    {PAYOUT_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-ink/60">Who gets it</span>
              <select className={field} value={crewId} onChange={(e) => setCrewId(e.target.value)}>
                <option value="">{kind === "commission" ? "Pick a person..." : "Someone not on the crew"}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {kind === "commission" ? ` (${usd(p.readyCents)} ready)` : ""}
                  </option>
                ))}
              </select>
            </label>
            {kind === "other" && !crewId && (
              <label className="grid gap-1">
                <span className="text-xs text-ink/60">Their name</span>
                <input className={field} maxLength={160} value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
              </label>
            )}
            {kind === "other" && (
              <label className="grid gap-1">
                <span className="text-xs text-ink/60">What it pays for</span>
                <select className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Pick a category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="grid gap-1">
              <span className="text-xs text-ink/60">Amount{kind === "commission" && crewId ? ` (up to ${usd(readyFor)})` : ""}</span>
              <input className={field} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-ink/60">What it&apos;s for</span>
              <input className={field} maxLength={1000} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={primary} disabled={busy !== ""} onClick={submit}>
              {busy === "new" ? "Saving..." : "Send for approval"}
            </button>
            {msg?.id === "new" && <span className="font-semibold text-terracotta-dark">{msg.text}</span>}
          </div>
        </section>
      )}

      {SECTIONS.map((sec) => {
        const list = requests.filter((r) => stageOf(r) === sec.key);
        if (sec.key === "closed" && list.length === 0) return null;
        return (
          <section key={sec.key}>
            <h2 className="text-lg font-semibold text-charcoal">
              {sec.title} <span className="text-sm font-normal text-ink/55">{list.length}</span>
            </h2>
            {sec.key === "pay" && payable.length > 0 && (
              <div className="mt-3 grid gap-2 rounded-2xl border border-parchment bg-white p-4 text-sm sm:flex sm:flex-wrap sm:items-center">
                <span className="text-ink/70">Tick the requests one bank payment covered ({usd(pickedTotal)} picked), then pick that payment:</span>
                <select className={`${field} sm:w-96`} value={line} onChange={(e) => setLine(e.target.value)} aria-label="Bank payment">
                  <option value="">Pick the money-out line...</option>
                  {payoutLines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <button type="button" className={primary} disabled={!line || picked.size === 0 || busy !== ""} onClick={() => link(line, [...picked])}>
                  {busy === "link" ? "Saving..." : "Record payout"}
                </button>
                {msg?.id === "link" && <span className="font-semibold text-terracotta-dark">{msg.text}</span>}
              </div>
            )}
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">{sec.empty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-parchment rounded-2xl border border-parchment bg-white">
                {list.map((r) => {
                  const buttons = r.allowed.filter((a) => a !== "link" && a !== "unlink");
                  return (
                    <li key={r.id} className="grid gap-2 p-4 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                        <div className="flex min-w-0 items-start gap-3">
                          {sec.key === "pay" && r.allowed.includes("link") && (
                            <input
                              type="checkbox"
                              className="mt-1"
                              aria-label={`Include ${r.payeeName}'s ${usd(r.amountCents)}`}
                              checked={picked.has(r.id)}
                              onChange={(e) =>
                                setPicked((p) => {
                                  const n = new Set(p);
                                  if (e.target.checked) n.add(r.id);
                                  else n.delete(r.id);
                                  return n;
                                })
                              }
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-charcoal">
                              {r.payeeName} · {PAYOUT_KIND_LABEL[r.kind as PayoutKind] ?? r.kind}
                              {r.categoryName ? ` · ${r.categoryName}` : ""}
                            </p>
                            <p className="break-words text-ink/70">{r.purpose}</p>
                            <p className="text-xs text-ink/55">
                              Requested {r.requestedOn} by {r.requestedBy}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold tabular-nums text-charcoal">{usd(r.amountCents)}</p>
                          <p className="text-xs text-ink/60">
                            {r.paid ? "Paid" : REQUEST_STATUS_LABEL[r.status as RequestStatus]}
                            {r.vetoFinal && " (final)"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
                        {r.decidedBy && (
                          <span className="break-words">
                            Last decision by {r.decidedBy}
                            {r.decisionNote ? `: "${r.decisionNote}"` : ""}
                          </span>
                        )}
                        {r.voidedBy && (
                          <span className="break-words">
                            Voided by {r.voidedBy}
                            {r.voidNote ? `: "${r.voidNote}"` : ""}
                          </span>
                        )}
                        {r.paidLine && (
                          <span className="break-words">
                            Paid by {r.paidLine}
                            {r.linkedBy ? `, matched by ${r.linkedBy}` : ""}
                          </span>
                        )}
                      </div>
                      {buttons.length > 0 && (
                        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                          {buttons.some((b) => NEEDS_NOTE.includes(b)) && (
                            <input
                              className={`${field} sm:w-72`}
                              placeholder="Note (needed to veto, void or escalate)"
                              maxLength={1000}
                              value={notes[r.id] ?? ""}
                              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                            />
                          )}
                          <div className="flex flex-wrap gap-2">
                            {buttons.map((a) => (
                              <button key={a} type="button" disabled={busy !== ""} className={a === "approve" ? primary : btn} onClick={() => act(r, a)}>
                                {busy === r.id ? "Saving..." : ACTION_LABEL[a]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {r.paid && r.allowed.includes("unlink") && (
                        <div>
                          <button type="button" className={btn} disabled={busy !== ""} onClick={() => link(null, [r.id])}>
                            Unmatch bank line
                          </button>
                        </div>
                      )}
                      {msg?.id === r.id && <p className="font-semibold text-terracotta-dark">{msg.text}</p>}
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
