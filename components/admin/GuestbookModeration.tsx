"use client";

import { useState } from "react";
import type { GuestbookEntry } from "@/lib/guestbook";

// Moderation list for the /reviews guestbook: approve, remove, or feature one
// entry at the top of the page. Each button is one PATCH; the list updates in
// place so a slow connection never leaves you guessing what took effect.
export default function GuestbookModeration({
  entries: initial,
  basePath,
}: {
  entries: GuestbookEntry[];
  basePath: string;
}) {
  const [entries, setEntries] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(id: string, change: { status?: string; featured?: boolean }) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api${basePath}/guestbook/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (!res.ok) throw new Error();
      setEntries((list) =>
        list
          .map((e) => {
            if (e.id === id) {
              const next = { ...e, ...change } as GuestbookEntry;
              if (change.featured) next.status = "approved";
              if (change.status === "removed") next.featured = false;
              return next;
            }
            return change.featured ? { ...e, featured: false } : e;
          })
          .filter((e) => e.status !== "removed"),
      );
    } catch {
      setError("That change didn't save. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const pending = entries.filter((e) => e.status === "pending");
  const live = entries.filter((e) => e.status === "approved");

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <a href={basePath} className="text-sm font-medium text-terracotta underline decoration-parchment underline-offset-2">
            Back to bookings
          </a>
          <h1 className="mt-2 text-2xl text-charcoal">Guestbook</h1>
          <p className="text-sm text-ink/60">
            Nothing shows on /reviews until you approve it. Feature one entry (the couple&apos;s review) to pin it at the top.
          </p>
          {error && <p className="mt-2 text-sm font-semibold text-terracotta">{error}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-8">
        {[
          ["Waiting for approval", pending],
          ["Live on the page", live],
        ].map(([title, list]) => (
          <section key={title as string}>
            <h2 className="mb-3 text-lg font-semibold text-charcoal">
              {title as string} ({(list as GuestbookEntry[]).length})
            </h2>
            {(list as GuestbookEntry[]).length === 0 ? (
              <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">Nothing here.</p>
            ) : (
              <div className="space-y-3">
                {(list as GuestbookEntry[]).map((e) => (
                  <article key={e.id} className="rounded-2xl border border-parchment bg-white p-5">
                    <p className="font-semibold text-charcoal">
                      {e.name}
                      {e.relation && <span className="font-normal text-ink/60"> · {e.relation}</span>}
                      {e.featured && (
                        <span className="ml-2 rounded-full bg-terracotta px-2 py-0.5 text-xs font-semibold text-cream">Featured</span>
                      )}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-ink/80">{e.message}</p>
                    <p className="mt-2 text-xs text-ink/50">{new Date(e.createdAt).toLocaleString("en-US")}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {e.status !== "approved" && (
                        <button disabled={busy === e.id} onClick={() => act(e.id, { status: "approved" })} className="rounded-full bg-charcoal px-4 py-1.5 font-semibold text-cream disabled:opacity-50">
                          Approve
                        </button>
                      )}
                      {!e.featured ? (
                        <button disabled={busy === e.id} onClick={() => act(e.id, { featured: true })} className="rounded-full border border-parchment px-4 py-1.5 font-semibold text-charcoal disabled:opacity-50">
                          Feature at top
                        </button>
                      ) : (
                        <button disabled={busy === e.id} onClick={() => act(e.id, { featured: false })} className="rounded-full border border-parchment px-4 py-1.5 font-semibold text-charcoal disabled:opacity-50">
                          Unfeature
                        </button>
                      )}
                      <button disabled={busy === e.id} onClick={() => act(e.id, { status: "removed" })} className="rounded-full border border-parchment px-4 py-1.5 font-semibold text-terracotta disabled:opacity-50">
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
