import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LiveRunSheet from "@/components/hub/LiveRunSheet";
import ShareLink from "@/components/hub/ShareLink";
import { SITE_NAME, SITE_URL, VENUE_TIME_ZONE } from "@/lib/site";
import type { LiveBlock } from "@/lib/live";

// Dev-only layout preview of Crossroads Live with sample mid-event state
// (speeches started 18 minutes late, everything downstream shifted).
// Returns 404 in production builds; the real page lives at /hub/[token]/live.
export const metadata: Metadata = {
  title: "Live preview",
  robots: { index: false, follow: false },
};

// The drift engine reads wall clocks in the venue timezone, so the sample
// "actual start" instants must be minted there too, not in this machine's
// local zone, or the preview drift reads as hours instead of minutes.
function startedAt(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const guess = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
  const venue = guess.toLocaleString("en-US", {
    timeZone: VENUE_TIME_ZONE,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [vh, vm] = venue.split(":").map(Number);
  const diff = h * 60 + m - ((vh % 24) * 60 + vm);
  return new Date(guess.getTime() + diff * 60_000).toISOString();
}

const BLOCKS: LiveBlock[] = [
  { id: "b1", title: "Guests arrive, prelude music", category: "pre_ceremony", scheduledStartTime: "16:00", durationMinutes: 30, actualStart: startedAt("16:00"), isCompleted: true, mcNotes: "" },
  { id: "b2", title: "Processional", category: "ceremony", scheduledStartTime: "16:30", durationMinutes: 5, actualStart: startedAt("16:34"), isCompleted: true, mcNotes: "" },
  { id: "b3", title: "Ceremony", category: "ceremony", scheduledStartTime: "16:35", durationMinutes: 25, actualStart: startedAt("16:40"), isCompleted: true, mcNotes: "" },
  { id: "b4", title: "Cocktail hour", category: "cocktail", scheduledStartTime: "17:00", durationMinutes: 60, actualStart: startedAt("17:08"), isCompleted: true, mcNotes: "Acoustic set on the patio" },
  { id: "b5", title: "Speeches and toasts", category: "reception", scheduledStartTime: "19:00", durationMinutes: 20, actualStart: startedAt("19:18"), isCompleted: false, mcNotes: "Best man first, then maid of honor" },
  { id: "b6", title: "First dance", category: "dance", scheduledStartTime: "19:20", durationMinutes: 5, actualStart: null, isCompleted: false, mcNotes: "" },
  { id: "b7", title: "Open dance floor", category: "dance", scheduledStartTime: "19:25", durationMinutes: 150, actualStart: null, isCompleted: false, mcNotes: "" },
  { id: "b8", title: "Last song and send-off", category: "dance", scheduledStartTime: "21:55", durationMinutes: 5, actualStart: null, isCompleted: false, mcNotes: "Sparkler exit, line up at 9:50" },
];

export default function LivePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-terracotta">{SITE_NAME} Live</p>
            <h1 className="text-2xl text-charcoal">Jordan Hayes &amp; Taylor Morgan</h1>
            <p className="text-sm text-ink/60">
              Tap Start as each moment begins; every later time shifts with you, on every
              screen watching.
            </p>
          </div>
          <span className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta">
            Back to your hub
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* demo mode: the console simulated locally, no polling, no database */}
        <LiveRunSheet initialBlocks={BLOCKS} demo />
        <section className="rounded-2xl border border-parchment bg-white p-6 shadow-sm">
          <h2 className="text-lg text-charcoal">Share with your vendors</h2>
          <p className="mb-3 mt-1 text-sm text-ink/60">
            Photographer, venue, caterer: this link shows them the live timeline, read only.
            They see every shift the moment it happens, and they can never change anything.
          </p>
          <ShareLink url={`${SITE_URL}/live/111111111111111111111111111111111111111111111111`} />
        </section>
      </main>
    </div>
  );
}
