import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewModerationButtons from "@/components/admin/ReviewModerationButtons";
import { adminKeyMatches } from "@/lib/admin";
import { getModerationEntries, type ModerationEntry } from "@/lib/reviews";
import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";

// Moderation for the public notes board at /reviews. Waiting notes first.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews to approve",
  robots: { index: false, follow: false },
};

const LABEL = { waiting: "Waiting", approved: "Public", hidden: "Hidden" } as const;

export default async function ReviewModerationPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();
  const entries = await getModerationEntries();
  const order: ModerationEntry["state"][] = ["waiting", "approved", "hidden"];
  const sorted = [...entries].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
  const waiting = entries.filter((e) => e.state === "waiting").length;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Reviews to approve</h1>
          <p className="text-sm text-ink/60">
            {waiting} waiting. Nothing on /reviews is public until you approve it. Approve shows a
            note exactly as written; Hide takes it down; Pin puts it at the top. Nothing deletes.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <a href={`/admin/${key}`} className="text-sm font-medium text-terracotta underline decoration-parchment underline-offset-2">
              Back to bookings
            </a>
            <a href="/reviews" className="text-sm font-medium text-terracotta underline decoration-parchment underline-offset-2">
              See the public page
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-4xl gap-4 px-6 py-8">
        {sorted.length === 0 ? (
          <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">
            No notes yet. Send people crossroadsweddingco.shop/reviews#sign to sign the board.
          </p>
        ) : (
          sorted.map((e) => (
            <div key={e.id} className={`rounded-2xl border bg-white p-5 ${e.state === "waiting" ? "border-terracotta/50" : "border-parchment"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-charcoal">{e.name}</span>
                    <span className="text-ink/55">
                      {" "}
                      · {e.relation} ·{" "}
                      {new Date(e.createdAt).toLocaleString("en-US", { timeZone: VENUE_TIME_ZONE, dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </p>
                  {e.source && <p className="mt-1 text-xs text-terracotta-dark">{e.source}</p>}
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink/50">
                    {LABEL[e.state]}
                    {e.featured ? " · pinned" : ""}
                  </p>
                </div>
                <ReviewModerationButtons adminKey={key} id={e.id} state={e.state} featured={e.featured} />
              </div>
              <p className="mt-3 whitespace-pre-line break-words text-ink/85">{e.message}</p>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
