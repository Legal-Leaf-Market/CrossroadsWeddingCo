"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CRM_KIND_LABEL, CRM_KINDS, type CrmKind } from "@/lib/sales-logic";

type Option = { id: string; name: string };

/**
 * A sales order: the booking, its account, who closed it, and the deposit.
 * The commission terms are set by the server from the account and closer
 * (lib/sales-logic.ts), never typed here. Opened straight from the playbook
 * with the deal's details filled in (?name=&type=&date=&by=&lead=&account=).
 */
export default function SalesOrderForm({
  adminKey,
  accounts,
  crew,
  prefill,
}: {
  adminKey: string;
  accounts: (Option & { manager: string | null })[];
  crew: Option[];
  prefill: { name: string; type: "wedding" | "corporate"; date: string; closerId: string; lead: string; accountName: string; accountId: string };
}) {
  const router = useRouter();
  const known = prefill.accountId || accounts.find((a) => a.name.toLowerCase() === prefill.accountName.toLowerCase())?.id || "";
  const [accountId, setAccountId] = useState(known || (prefill.accountName ? "new" : ""));
  const [newName, setNewName] = useState(prefill.accountName);
  const [newKind, setNewKind] = useState<CrmKind>("venue");
  const [newManager, setNewManager] = useState(prefill.closerId);
  const [type, setType] = useState<"wedding" | "corporate">(prefill.type);
  const [clientNames, setClientNames] = useState(prefill.name);
  const [eventDate, setEventDate] = useState(prefill.date);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [total, setTotal] = useState(type === "corporate" ? "1500" : "1000");
  const [deposit, setDeposit] = useState(type === "corporate" ? "1000" : "500");
  const [depositReceived, setDepositReceived] = useState(false);
  const [closer, setCloser] = useState(prefill.closerId);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; id?: string } | null>(null);

  function pickType(t: "wedding" | "corporate") {
    setType(t);
    setTotal(t === "corporate" ? "1500" : "1000");
    setDeposit(t === "corporate" ? "1000" : "500");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: accountId && accountId !== "new" ? accountId : null,
        newAccount: accountId === "new" && newName.trim() ? { name: newName.trim(), kind: newKind, managerCrewId: newManager || null } : null,
        type,
        clientNames,
        email,
        phone,
        eventDate,
        venueName,
        venueAddress,
        totalUsd: Number(total) || 0,
        depositUsd: Number(deposit) || 0,
        depositReceived,
        closerCrewId: closer || null,
        playbookLeadId: prefill.lead || null,
        notes,
      }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string } | undefined;
    setBusy(false);
    if (!res?.ok || !json?.id) {
      setMsg({ ok: false, text: json?.error ?? "That didn't save. Try again." });
      return;
    }
    setMsg({ ok: true, text: "Sales order saved.", id: json.id });
    router.refresh();
  }

  const input = "mt-1 w-full rounded-lg border border-parchment bg-white px-3 py-2 text-sm text-charcoal";
  const label = "block text-xs font-medium text-ink/60";
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-parchment bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Account (who sent it)
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={input}>
            <option value="">None: came to us directly</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.manager ? ` (managed by ${a.manager})` : ""}
              </option>
            ))}
            <option value="new">New account...</option>
          </select>
        </label>
        <label className={label}>
          Closed by (earns the $100)
          <select value={closer} onChange={(e) => setCloser(e.target.value)} className={input}>
            <option value="">Nobody: no closing commission</option>
            {crew.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {accountId === "new" && (
        <div className="grid gap-4 rounded-xl bg-cream/60 p-3 sm:grid-cols-3">
          <label className={label}>
            Account name
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={160} className={input} required />
          </label>
          <label className={label}>
            Kind
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as CrmKind)} className={input}>
              {CRM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CRM_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Account manager (5% on later events)
            <select value={newManager} onChange={(e) => setNewManager(e.target.value)} className={input}>
              <option value="">Nobody yet</option>
              {crew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of event">
        {(["wedding", "corporate"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => pickType(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${type === t ? "bg-charcoal text-cream" : "border border-parchment text-ink/70"}`}
          >
            {t === "wedding" ? "Wedding" : "Corporate"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {type === "wedding" ? "Couple" : "Company or client"}
          <input value={clientNames} onChange={(e) => setClientNames(e.target.value)} maxLength={255} className={input} required />
        </label>
        <label className={label}>
          Event date
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={input} required />
        </label>
        <label className={label}>
          Venue
          <input value={venueName} onChange={(e) => setVenueName(e.target.value)} maxLength={255} className={input} required />
        </label>
        <label className={label}>
          Venue address
          <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} maxLength={500} className={input} />
        </label>
        <label className={label}>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} className={input} />
        </label>
        <label className={label}>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} className={input} />
        </label>
        <label className={label}>
          Total ($)
          <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className={input} />
        </label>
        <label className={label}>
          Deposit ($)
          <input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={input} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" checked={depositReceived} onChange={(e) => setDepositReceived(e.target.checked)} />
        Deposit received today (cash or check)
      </label>
      <label className={label}>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={2} className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60">
          {busy ? "Saving..." : "Save the sales order"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-sage-dark" : "text-terracotta-dark"}`} role="status">
            {msg.text}{" "}
            {msg.id && (
              <>
                <a href={`/admin/${adminKey}/invoice/${msg.id}`} className="underline">
                  Open the invoice
                </a>{" "}
                ·{" "}
                <a href={`/admin/${adminKey}/costing/${msg.id}`} className="underline">
                  Plan the job
                </a>
              </>
            )}
          </span>
        )}
      </div>
    </form>
  );
}
