import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DetailsSection from "@/components/hub/DetailsSection";
import MusicSection from "@/components/hub/MusicSection";
import TimelineSection from "@/components/hub/TimelineSection";
import VipSection from "@/components/hub/VipSection";
import { daysOut, getPortalData } from "@/lib/hub";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your planning hub",
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function HubPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();
  const { wedding, timeline, cues, vips, playlists } = data;
  const days = daysOut(wedding.eventDate);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
            <h1 className="text-2xl text-charcoal">{wedding.coupleNames}</h1>
            <p className="text-sm text-ink/60">
              {formatDate(wedding.eventDate)} at {wedding.venueName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {days >= 0 && (
              <span className="rounded-full bg-parchment px-4 py-1.5 text-sm font-semibold text-charcoal">
                {days === 0 ? "Today!" : `${days} days out`}
              </span>
            )}
            <a
              href={`/hub/${token}/runsheet`}
              className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
            >
              Run sheet
            </a>
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
          token={token}
          venueName={wedding.venueName}
          initial={{
            venueAddress: wedding.venueAddress ?? "",
            venueContactEmail: wedding.venueContactEmail ?? "",
            contactPhone: wedding.contactPhone ?? "",
            vibeNotes: wedding.notes ?? "",
          }}
        />
        <TimelineSection
          token={token}
          initial={timeline.map((item) => ({
            title: item.title,
            category: item.category ?? "reception",
            startTime: item.scheduledStartTime.slice(0, 5),
            durationMinutes: item.estimatedDurationMinutes,
            mcNotes: item.mcNotes ?? "",
          }))}
        />
        <MusicSection
          token={token}
          initialCues={cues.map((cue) => ({
            cueType: cue.cueType,
            trackTitle: cue.trackTitle,
            artist: cue.artist === "Unknown artist" ? "" : cue.artist,
            isLivePerformance: cue.isLivePerformance ?? false,
          }))}
          initialMustPlay={playlists
            .filter((p) => p.category === "must_play")
            .map((p) => ({ trackTitle: p.trackTitle, artist: p.artist === "Unknown artist" ? "" : p.artist }))}
          initialDoNotPlay={playlists
            .filter((p) => p.category === "do_not_play")
            .map((p) => ({ trackTitle: p.trackTitle, artist: p.artist === "Unknown artist" ? "" : p.artist }))}
          initialPlaylistUrl={wedding.spotifyPlaylistUrl ?? ""}
        />
        <VipSection
          token={token}
          initial={vips.map((v) => ({
            role: v.role,
            fullName: v.fullName,
            phoneticSpelling: v.phoneticSpelling,
            entranceSongOverride: v.entranceSongOverride ?? "",
          }))}
        />
        <p className="pb-8 text-center text-xs text-ink/40">
          Questions any time: jake@crossroadsweddingco.com
        </p>
      </main>
    </div>
  );
}
