"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Opens Plaid Link. The script loads only when the button is pressed, from
// Plaid's own CDN, so pages that never connect a bank never load it.
const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

type PlaidHandler = { open: () => void; destroy: () => void };
type PlaidGlobal = {
  create: (cfg: {
    token: string;
    onSuccess: (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => void;
    onExit: (err: { display_message?: string | null; error_message?: string } | null) => void;
  }) => PlaidHandler;
};

function loadPlaid(): Promise<PlaidGlobal> {
  const w = window as unknown as { Plaid?: PlaidGlobal };
  if (w.Plaid) return Promise.resolve(w.Plaid);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PLAID_SCRIPT;
    s.async = true;
    s.onload = () => (w.Plaid ? resolve(w.Plaid) : reject(new Error("Plaid didn't load")));
    s.onerror = () => reject(new Error("Couldn't load Plaid"));
    document.head.appendChild(s);
  });
}

/**
 * Connect a new bank, or with `repair` re-log into one whose login expired.
 * With `selectAccounts` as well, the person picks the new accounts their bank reported.
 */
export default function PlaidConnect({ repair, label, selectAccounts = false }: { repair?: string; label?: string; selectAccounts?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function start() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/app/integrations/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repair ? { repair, selectAccounts } : {}),
      });
      const json = (await res.json().catch(() => ({}))) as { linkToken?: string; error?: string };
      if (!res.ok || !json.linkToken) throw new Error(json.error ?? "Couldn't start the connection.");
      const Plaid = await loadPlaid();
      const handler = Plaid.create({
        token: json.linkToken,
        onSuccess: async (publicToken, metadata) => {
          if (repair) {
            setMsg(selectAccounts ? "Accounts updated." : "Reconnected.");
            await fetch(`/api/app/integrations/${repair}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(selectAccounts ? { action: "sync", accountsChosen: true } : { action: "sync" }),
            }).catch(() => null);
          } else {
            setMsg("Saving your accounts...");
            const r = await fetch("/api/app/integrations/plaid/exchange", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                publicToken,
                institution: { id: metadata.institution?.institution_id ?? null, name: metadata.institution?.name ?? null },
              }),
            }).catch(() => null);
            const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
            setMsg(r?.ok ? "Connected. Transactions can take a few minutes to arrive." : j?.error ?? "Couldn't save the connection.");
          }
          setBusy(false);
          handler.destroy();
          router.refresh();
        },
        onExit: (err) => {
          if (err) setMsg(err.display_message || "The bank connection didn't finish.");
          setBusy(false);
          handler.destroy();
        },
      });
      handler.open();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Couldn't start the connection.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          repair
            ? "rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta-dark hover:bg-terracotta hover:text-cream disabled:opacity-60"
            : "rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
        }
      >
        {busy ? "Opening..." : label ?? (repair ? "Log in again" : "Connect a bank or card")}
      </button>
      {msg && (
        <p className="mt-2 text-sm text-ink/70" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
