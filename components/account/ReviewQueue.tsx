"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KIND_LABEL, type CategoryKind } from "@/lib/books/categories";

export type QueueCategory = { id: string; name: string; kind: CategoryKind };
export type QueueItem = {
  id: string;
  postedDate: string;
  amountCents: number;
  merchant: string | null;
  description: string;
  rawCategory: string | null;
  pending: boolean;
  categoryName: string | null;
  note: string | null;
  sortedByRule: boolean;
  accountName: string;
  mask: string | null;
};

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const select =
  "w-full min-w-0 rounded-lg border border-parchment bg-cream/40 px-2 py-1.5 text-sm text-ink focus:border-terracotta focus:outline-none sm:w-56";
const btn =
  "rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta-dark disabled:opacity-50";
const primary =
  "rounded-full bg-terracotta px-4 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50";

/** "FOOD_AND_DRINK_RESTAURANT" -> "Food and drink restaurant". The bank's guess, shown as a hint only. */
function bankHint(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/_/g, " ").toLowerCase().trim();
  return s ? s[0].toUpperCase() + s.slice(1) : null;
}

/**
 * Category options, with the kinds that fit the money's direction first: money
 * in leads with income, money out with expenses. Nothing is preselected; the
 * person chooses, because a guessed category that gets saved is a wrong book.
 */
function CategoryOptions({ categories, amountCents }: { categories: QueueCategory[]; amountCents: number | null }) {
  const order: CategoryKind[] =
    amountCents === null
      ? ["income", "expense", "transfer", "equity"]
      : amountCents >= 0
        ? ["income", "transfer", "equity", "expense"]
        : ["expense", "transfer", "equity", "income"];
  return (
    <>
      <option value="">Choose a category</option>
      {order.map((k) => {
        const list = categories.filter((c) => c.kind === k);
        if (!list.length) return null;
        return (
          <optgroup key={k} label={KIND_LABEL[k]}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/app/transactions/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = (await res?.json().catch(() => ({}))) as { error?: string; updated?: number; ruleSorted?: number; ruleError?: string };
  return { ok: !!res?.ok, ...json };
}

export default function ReviewQueue({
  view,
  items,
  categories,
}: {
  view: "unreviewed" | "categorized" | "excluded";
  items: QueueItem[];
  categories: QueueCategory[];
}) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [always, setAlways] = useState<Record<string, boolean>>({});
  const [bulkCat, setBulkCat] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");

  const visible = useMemo(() => items.filter((i) => !gone.has(i.id)), [items, gone]);

  function finish(ids: string[], res: Awaited<ReturnType<typeof post>>) {
    setBusy("");
    if (!res.ok) {
      setMsg(res.error ?? "Couldn't save that.");
      return;
    }
    setGone((g) => new Set([...g, ...ids]));
    setPicked((p) => new Set([...p].filter((x) => !ids.includes(x))));
    const parts: string[] = [];
    if (res.ruleSorted) parts.push(`Rule saved and sorted ${res.ruleSorted} more.`);
    if (res.ruleError) parts.push(`Saved, but the rule wasn't: ${res.ruleError}`);
    setMsg(parts.join(" "));
    router.refresh();
  }

  function ruleFor(item: QueueItem) {
    if (!always[item.id]) return undefined;
    const useMerchant = !!item.merchant;
    return {
      matchField: useMerchant ? "merchant" : "description",
      matchType: useMerchant ? "equals" : "contains",
      pattern: useMerchant ? item.merchant : item.description,
      direction: item.amountCents >= 0 ? "in" : "out",
    };
  }

  async function sortOne(item: QueueItem) {
    const categoryId = choice[item.id];
    if (!categoryId) return;
    setBusy(item.id);
    setMsg("");
    finish([item.id], await post({ action: "categorize", ids: [item.id], categoryId, note: notes[item.id], rule: ruleFor(item) }));
  }

  async function excludeOne(item: QueueItem) {
    setBusy(item.id);
    setMsg("");
    finish([item.id], await post({ action: "exclude", ids: [item.id], note: notes[item.id], rule: ruleFor(item) }));
  }

  async function reopen(item: QueueItem) {
    setBusy(item.id);
    setMsg("");
    finish([item.id], await post({ action: "reopen", ids: [item.id] }));
  }

  async function bulk(action: "categorize" | "exclude") {
    const ids = [...picked].filter((id) => !gone.has(id));
    if (!ids.length || (action === "categorize" && !bulkCat)) return;
    setBusy("bulk");
    setMsg("");
    finish(ids, await post(action === "categorize" ? { action, ids, categoryId: bulkCat } : { action, ids }));
  }

  if (!visible.length) {
    return (
      <p className="mt-6 rounded-2xl border border-parchment bg-white p-6 text-sm text-ink/70">
        {view === "unreviewed"
          ? "Nothing waiting. Every transaction pulled so far is sorted."
          : view === "categorized"
            ? "Nothing sorted yet."
            : "Nothing set aside."}
      </p>
    );
  }

  const allPicked = visible.length > 0 && visible.every((i) => picked.has(i.id));

  return (
    <div className="mt-6">
      {view === "unreviewed" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-parchment bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={(e) => setPicked(e.target.checked ? new Set(visible.map((i) => i.id)) : new Set())}
            />
            Select all
          </label>
          {picked.size > 0 && (
            <>
              <span className="text-sm text-ink/60">{picked.size} selected</span>
              <select aria-label="Category for selected" className={select} value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
                <CategoryOptions categories={categories} amountCents={null} />
              </select>
              <button type="button" className={primary} disabled={!bulkCat || busy !== ""} onClick={() => bulk("categorize")}>
                Sort selected
              </button>
              <button type="button" className={btn} disabled={busy !== ""} onClick={() => bulk("exclude")}>
                Not business
              </button>
            </>
          )}
        </div>
      )}

      {msg && (
        <p className="mt-3 text-sm text-ink/70" role="status">
          {msg}
        </p>
      )}

      <ul className="mt-3 divide-y divide-parchment rounded-2xl border border-parchment bg-white">
        {visible.map((item) => {
          const hint = bankHint(item.rawCategory);
          const title = item.merchant || item.description || "Bank transaction";
          return (
            <li key={item.id} className="grid gap-3 p-4">
              <div className="flex items-start gap-3">
                {view === "unreviewed" && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${title}`}
                    className="mt-1"
                    checked={picked.has(item.id)}
                    onChange={(e) =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (e.target.checked) n.add(item.id);
                        else n.delete(item.id);
                        return n;
                      })
                    }
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 break-words font-semibold text-charcoal">
                      {title}
                      {item.pending && <span className="ml-2 text-xs font-normal text-ink/50">pending</span>}
                    </p>
                    <p className={`tabular-nums font-semibold ${item.amountCents >= 0 ? "text-emerald-800" : "text-charcoal"}`}>
                      {item.amountCents >= 0 ? "+" : ""}
                      {usd(item.amountCents)}
                    </p>
                  </div>
                  <p className="mt-0.5 break-words text-xs text-ink/55">
                    {item.postedDate} · {item.accountName}
                    {item.mask ? ` ····${item.mask}` : ""}
                    {item.merchant && item.description && item.description !== item.merchant ? ` · ${item.description}` : ""}
                    {hint && view === "unreviewed" ? ` · Bank says: ${hint}` : ""}
                  </p>
                  {view !== "unreviewed" && (
                    <p className="mt-1 text-sm text-ink/70">
                      {view === "categorized" ? item.categoryName ?? "Category removed" : "Not business"}
                      {item.sortedByRule && <span className="ml-2 rounded-full bg-parchment/70 px-2 py-0.5 text-xs font-semibold text-ink/60">by a rule</span>}
                      {item.note && <span className="text-ink/55"> · {item.note}</span>}
                    </p>
                  )}
                </div>
              </div>

              {view === "unreviewed" ? (
                <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:pl-7">
                  <select
                    aria-label={`Category for ${title}`}
                    className={select}
                    value={choice[item.id] ?? ""}
                    onChange={(e) => setChoice((c) => ({ ...c, [item.id]: e.target.value }))}
                  >
                    <CategoryOptions categories={categories} amountCents={item.amountCents} />
                  </select>
                  <input
                    aria-label={`Note for ${title}`}
                    placeholder="Note (optional)"
                    maxLength={1000}
                    className={`${select} sm:w-48`}
                    value={notes[item.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={primary} disabled={!choice[item.id] || busy !== ""} onClick={() => sortOne(item)}>
                      {busy === item.id ? "Saving..." : "Save"}
                    </button>
                    <button type="button" className={btn} disabled={busy !== ""} onClick={() => excludeOne(item)}>
                      Not business
                    </button>
                  </div>
                  {(item.merchant || item.description.trim().length >= 3) && (
                    <label className="flex items-center gap-2 text-xs text-ink/65">
                      <input
                        type="checkbox"
                        checked={!!always[item.id]}
                        onChange={(e) => setAlways((a) => ({ ...a, [item.id]: e.target.checked }))}
                      />
                      Always do this for {item.merchant ? `"${item.merchant}"` : "lines like this"}
                    </label>
                  )}
                </div>
              ) : (
                <div>
                  <button type="button" className={btn} disabled={busy !== ""} onClick={() => reopen(item)}>
                    {busy === item.id ? "Moving..." : "Move back to review"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
