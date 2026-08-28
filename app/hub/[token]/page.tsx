import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CountdownHero from "@/components/hub/CountdownHero";
import DetailsSection from "@/components/hub/DetailsSection";
import MusicSection from "@/components/hub/MusicSection";
import TimelineSection from "@/components/hub/TimelineSection";
import VipSection from "@/components/hub/VipSection";
import { getPortalData, TOKEN_RE } from "@/lib/hub";
import { formatEventDate, normalizePlaylistLinks } from "@/lib/hub-constants";
import { countUnread } from "@/lib/messages";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Your planning hub",
    robots: { index: false, follow: false },
    // Per-wedding manifest so a pinned home-screen icon opens this hub.
    ...(TOKEN_RE.test(token) ? { manifest: `/hub/${token}/manifest.webmanifest` } : {}),
  };
}


export default async function HubPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();
  const { wedding, timeline, cues, vips, playlists } = data;
  const unreadMessages = await countUnread(wedding.id, "couple");
  const revs = (wedding.hubSectionRevs ?? {}) as Record<string, number>;
  // The hub-managed playlist links, seeded from the single link captured at
  // booking when the couple hasn't managed the list yet. The playlists route
  // nulls that single column on every managed save, so a deleted seed row
  // stays deleted instead of resurrecting on reload.
  const storedPlaylists = normalizePlaylistLinks(wedding.spotifyPlaylistUrls);
  const playlistLinks =
    storedPlaylists.length === 0 && wedding.spotifyPlaylistUrl
      ? [{ label: "", url: wedding.spotifyPlaylistUrl }]
      : storedPlaylists;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
            <h1 className="text-2xl text-charcoal">{wedding.coupleNames}</h1>
            <p className="text-sm text-ink/60">
              {formatEventDate(wedding.eventDate)} at {wedding.venueName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/hub/${token}/messages`}
              className="rounded-full bg-charcoal px-4 py-1.5 text-sm font-semibold text-cream hover:bg-ink"
            >
              Messages
              {unreadMessages > 0 && (
                <span className="ml-2 rounded-full bg-terracotta px-2 py-0.5 text-xs font-bold text-cream">
                  {unreadMessages}
                </span>
              )}
            </a>
            <a
              href={`/hub/${token}/live`}
              className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-dark"
            >
              Live
            </a>
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
        <CountdownHero
          eventDate={wedding.eventDate}
          startTime={timeline[0]?.scheduledStartTime.slice(0, 5) ?? null}
        />
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
          initialRev={revs.timeline ?? 0}
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
          initialCuesRev={revs.cues ?? 0}
          initialPlaylistsRev={revs.playlists ?? 0}
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
          initialPlaylists={playlistLinks}
        />
        <VipSection
          token={token}
          initialRev={revs.vips ?? 0}
          initial={vips.map((v) => ({
            role: v.role,
            fullName: v.fullName,
            phoneticSpelling: v.phoneticSpelling,
            entranceSongOverride: v.entranceSongOverride ?? "",
          }))}
        />
        <p className="pb-8 text-center text-xs text-ink/40">
          Questions any time:{" "}
          <a href={`/hub/${token}/messages`} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
            message us
          </a>{" "}
          and we both see it right away.
        </p>
      </main>
    </div>
  );
}
