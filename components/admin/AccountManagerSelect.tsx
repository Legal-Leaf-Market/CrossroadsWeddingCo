"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Who manages an account. Changes apply to sales made from now on; earlier deals keep their terms. */
export default function AccountManagerSelect({ adminKey, accountId, value, crew }: { adminKey: string; accountId: string; value: string; crew: { id: string; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [err, setErr] = useState("");
  async function change(next: string) {
    setV(next);
    setErr("");
    const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/crm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "manager", accountId, managerCrewId: next || null }),
    }).catch(() => null);
    if (!res?.ok) {
      setErr("Didn't save");
      setV(value);
      return;
    }
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <select value={v} onChange={(e) => change(e.target.value)} aria-label="Account manager" className="rounded-lg border border-parchment bg-white px-2 py-1 text-xs text-charcoal">
        <option value="">No manager</option>
        {crew.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {err && <span className="text-xs text-terracotta-dark">{err}</span>}
    </span>
  );
}
