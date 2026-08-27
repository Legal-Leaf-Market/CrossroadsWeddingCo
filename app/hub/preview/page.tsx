import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DetailsSection from "@/components/hub/DetailsSection";
import MusicSection from "@/components/hub/MusicSection";
import TimelineSection from "@/components/hub/TimelineSection";
import VipSection from "@/components/hub/VipSection";
import { EMAIL_FROM_ADDRESS, SITE_NAME } from "@/lib/site";

// Dev-only layout preview of the planning hub, rendered with sample data so the
// portal can be screenshotted and measured without a database. Returns 404 in
// production builds; the real portal lives at /hub/[token].
export const metadata: Metadata = {
  title: "Hub preview",
  robots: { index: false, follow: false },
};

const SAMPLE_TOKEN = "000000000000000000000000000000000000000000000000";

export default function HubPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
            <h1 className="text-2xl text-charcoal">Jordan Hayes &amp; Taylor Morgan</h1>
            <p className="text-sm text-ink/60">Saturday, June 12, 2027 at The Sycamore Barn</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-parchment px-4 py-1.5 text-sm font-semibold text-charcoal">
              290 days out
            </span>
            <span className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta">
              Run sheet
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <p className="text-sm text-ink/60">
          Everything here saves as you type and lands directly in front of your crew. Fill in
          what you know, skip what you don&apos;t, and we walk the rest together on your call.
          Keep this link private: it&apos;s the key to your wedding.
        </p>
        <DetailsSection
          token={SAMPLE_TOKEN}
          venueName="The Sycamore Barn"
          initial={{
            venueAddress: "4280 County Road 325 N, Columbus, IN 47203",
            venueContactEmail: "events@sycamorebarn.com",
            contactPhone: "(812) 555-0142",
            vibeNotes: "Golden hour garden party. Motown for cocktails, 90s and 2000s once the floor opens.",
          }}
        />
        <TimelineSection
          token={SAMPLE_TOKEN}
          initialRev={0}
          initial={[
            { title: "Guests arrive, prelude music", category: "pre_ceremony", startTime: "16:00", durationMinutes: 30, mcNotes: "" },
            { title: "Processional", category: "ceremony", startTime: "16:30", durationMinutes: 5, mcNotes: "" },
            { title: "Ceremony", category: "ceremony", startTime: "16:35", durationMinutes: 25, mcNotes: "" },
            { title: "Cocktail hour", category: "cocktail", startTime: "17:00", durationMinutes: 60, mcNotes: "Acoustic set on the patio" },
            { title: "Grand entrance", category: "reception", startTime: "18:00", durationMinutes: 10, mcNotes: "Introduce the wedding party in roster order" },
            { title: "Dinner", category: "reception", startTime: "18:10", durationMinutes: 50, mcNotes: "" },
            { title: "Speeches and toasts", category: "reception", startTime: "19:00", durationMinutes: 20, mcNotes: "Best man first, then maid of honor" },
            { title: "First dance", category: "dance", startTime: "19:20", durationMinutes: 5, mcNotes: "" },
            { title: "Open dance floor", category: "dance", startTime: "19:25", durationMinutes: 150, mcNotes: "" },
            { title: "Last song and send-off", category: "dance", startTime: "21:55", durationMinutes: 5, mcNotes: "Sparkler exit, line up at 21:50" },
          ]}
        />
        <MusicSection
          token={SAMPLE_TOKEN}
          initialCuesRev={0}
          initialPlaylistsRev={0}
          initialCues={[
            { cueType: "processional", trackTitle: "Can't Help Falling in Love", artist: "Kina Grannis", isLivePerformance: true },
            { cueType: "first_dance", trackTitle: "Lover", artist: "Taylor Swift", isLivePerformance: false },
          ]}
          initialMustPlay={[
            { trackTitle: "September", artist: "Earth, Wind & Fire" },
            { trackTitle: "Mr. Brightside", artist: "The Killers" },
          ]}
          initialDoNotPlay={[{ trackTitle: "Chicken Dance", artist: "" }]}
          initialPlaylists={[
            { label: "Cocktail hour", url: "https://open.spotify.com/playlist/37i9dQZF1DXdPec7aLTmlC" },
            { label: "Dance floor", url: "https://open.spotify.com/playlist/37i9dQZF1DX4JAvHpjipBk" },
          ]}
        />
        <VipSection
          token={SAMPLE_TOKEN}
          initialRev={0}
          initial={[
            { role: "Maid of Honor", fullName: "Siobhan Nguyen", phoneticSpelling: "shi-VAWN NWIN", entranceSongOverride: "" },
            { role: "Best Man", fullName: "Marcus Hayes", phoneticSpelling: "MAR-kus HAYZ", entranceSongOverride: "" },
          ]}
        />
        <p className="pb-8 text-center text-xs text-ink/40">
          Questions any time: {EMAIL_FROM_ADDRESS}
        </p>
      </main>
    </div>
  );
}
