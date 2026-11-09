"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_KINDS, KIND_LABEL, type CategoryKind } from "@/lib/books/categories";

const field =
  "min-w-0 rounded-lg border border-parchment bg-cream/40 px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none";
const btn =
  "rounded-full border border-parchment px-3 py-1 text-xs font-semibold text-ink/65 hover:border-terracotta hover:text-terracotta-dark disabled:opacity-50";

export function AddCategory() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/app/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(f.get("name") ?? ""), kind: String(f.get("kind") ?? "expense") }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res?.ok) return setMsg(json.error ?? "Couldn't add it.");
    form.reset();
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2">
      <input name="name" required maxLength={80} placeholder="New category" aria-label="New category name" className={`${field} flex-1 sm:flex-none sm:w-56`} />
      <select name="kind" aria-label="Type" defaultValue="expense" className={field}>
        {CATEGORY_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k as CategoryKind]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={busy} className="rounded-full bg-terracotta px-4 py-2 text-xs font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60">
        {busy ? "Adding..." : "Add"}
      </button>
      {msg && <span className="text-xs font-semibold text-terracotta-dark" role="status">{msg}</span>}
    </form>
  );
}

export function ArchiveCategory({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    await fetch(`/api/app/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !archived }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" className={btn} disabled={busy} onClick={go}>
      {archived ? "Bring back" : "Hide"}
    </button>
  );
}

export function DeleteRule({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!window.confirm("Delete this rule? Transactions it already sorted stay sorted.")) return;
    setBusy(true);
    await fetch(`/api/app/rules/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    router.refresh();
  }
  return (
    <button type="button" className={btn} disabled={busy} onClick={go}>
      {busy ? "Deleting..." : "Delete"}
    </button>
  );
}
