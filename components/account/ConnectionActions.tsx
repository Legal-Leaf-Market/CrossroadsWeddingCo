"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectionActions({ id, institution }: { id: string; institution: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "sync" | "disconnect">("");
  const [msg, setMsg] = useState("");

  async function act(action: "sync" | "disconnect") {
    if (action === "disconnect" && !window.confirm(`Disconnect ${institution}? Transactions already pulled stay; new ones stop.`)) return;
    setBusy(action);
    setMsg("");
    const res = await fetch(`/api/app/integrations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { added?: number; error?: string } | undefined;
    setBusy("");
    if (!res?.ok) setMsg(json?.error ?? "Something went wrong.");
    else if (action === "sync") setMsg(json?.added ? `${json.added} new transactions.` : "Up to date.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => act("sync")}
        disabled={busy !== ""}
        className="rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta-dark disabled:opacity-60"
      >
        {busy === "sync" ? "Refreshing..." : "Refresh"}
      </button>
      <button
        type="button"
        onClick={() => act("disconnect")}
        disabled={busy !== ""}
        className="rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink/55 hover:border-terracotta hover:text-terracotta-dark disabled:opacity-60"
      >
        {busy === "disconnect" ? "Disconnecting..." : "Disconnect"}
      </button>
      {msg && <span className="text-xs text-ink/60" role="status">{msg}</span>}
    </div>
  );
}
