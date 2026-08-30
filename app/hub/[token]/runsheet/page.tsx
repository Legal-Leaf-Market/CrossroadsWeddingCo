import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrintButton from "@/components/hub/PrintButton";
import { CUE_TYPES, getPortalData } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";
import { EMAIL_FROM_ADDRESS, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Run sheet",
  robots: { index: false, follow: false },
};

function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default async function RunSheetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPortalData(token);
  if (!data) notFound();
  const { wedding, timeline, cues, vips, playlists } = data;
  // The hub stores partially filled rows so nothing a couple typed is lost;
  // the printed sheet only shows the ones with something to say.
  const hasTrack = (p: { trackTitle: string; artist: string }) =>
    p.trackTitle.trim() !== "" || (p.artist.trim() !== "" && p.artist !== "Unknown artist");
  const doNotPlay = playlists.filter((p) => p.category === "do_not_play" && hasTrack(p));
  const mustPlay = playlists.filter((p) => p.category === "must_play" && hasTrack(p));
  const roster = vips.filter((v) => v.fullName.trim() !== "" || v.role.trim() !== "");

  return (
    <div className="min-h-screen bg-white p-8 text-charcoal print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between print:hidden">
          <a href={`/hub/${token}`} className="text-sm font-semibold text-terracotta hover:text-terracotta-dark">
            Back to your hub
          </a>
          <PrintButton />
        </div>

        <header className="mt-4 border-b-2 border-charcoal pb-3">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">{wedding.coupleNames}</h1>
            <span className="text-sm font-semibold">{SITE_NAME}</span>
          </div>
          <p className="mt-1 text-sm">
            {formatEventDate(wedding.eventDate)}
            {" · "}
            {wedding.venueName}
            {wedding.venueAddress ? ` · ${wedding.venueAddress}` : ""}
          </p>
          {(wedding.dressCode || wedding.weddingSiteUrl) && (
            // What the room was told: the MC reads the same brief the guests did.
            <p className="mt-1 text-sm text-ink/60">
              {wedding.dressCode ? `Dress code: ${wedding.dressCode}` : ""}
              {wedding.dressCode && wedding.weddingSiteUrl ? " · " : ""}
              {wedding.weddingSiteUrl ? `Their site: ${wedding.weddingSiteUrl}` : ""}
            </p>
          )}
        </header>

        <section className="mt-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">Run of show</h2>
          {timeline.length === 0 ? (
            <p className="mt-2 text-sm text-ink/50">No timeline yet.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {timeline.map((item) => (
                  <tr key={item.id} className="border-b border-parchment align-top">
                    <td className="w-20 py-1.5 pr-3 font-semibold whitespace-nowrap">
                      {time12(item.scheduledStartTime.slice(0, 5))}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span className="font-semibold">{item.title || "Untitled block"}</span>
                      {item.mcNotes && <span className="block text-ink/60">{item.mcNotes}</span>}
                    </td>
                    <td className="w-16 py-1.5 text-right text-ink/50 whitespace-nowrap">
                      {item.estimatedDurationMinutes} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">Key tracks</h2>
            {cues.length === 0 ? (
              <p className="mt-2 text-sm text-ink/50">No cues chosen yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {/* A section can hold several songs now, so every stored cue
                    prints, in the order the couple put them in. */}
                {cues.map((cue, i) => {
                  const ct = CUE_TYPES.find((t) => t.type === cue.cueType);
                  const siblings = cues.filter((c) => c.cueType === cue.cueType);
                  const label =
                    siblings.length > 1
                      ? `${ct?.label ?? cue.cueType} ${siblings.indexOf(cue) + 1}`
                      : (ct?.label ?? cue.cueType);
                  const track = [
                    cue.trackTitle,
                    cue.artist && cue.artist !== "Unknown artist" ? cue.artist : "",
                  ]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <li key={`${cue.cueType}-${i}`}>
                      <span className="font-semibold">{label}:</span> {track}
                      {cue.isLivePerformance ? " (live)" : ""}
                      {cue.notes && (
                        <span className="block text-ink/60">{cue.notes}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">
              Names and pronunciations
            </h2>
            {roster.length === 0 ? (
              <p className="mt-2 text-sm text-ink/50">No roster yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {roster.map((v) => (
                  <li key={v.id}>
                    {v.role ? <span className="font-semibold">{v.role}: </span> : null}
                    {v.fullName}
                    {v.phoneticSpelling ? ` (${v.phoneticSpelling})` : ""}
                    {v.notes ? <span className="block text-ink/60">{v.notes}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {(mustPlay.length > 0 || doNotPlay.length > 0) && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">Must play</h2>
              <ul className="mt-2 space-y-0.5 text-sm">
                {mustPlay.map((t) => (
                  <li key={t.id}>
                    {t.trackTitle}
                    {t.artist && t.artist !== "Unknown artist" ? `, ${t.artist}` : ""}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">
                Do not play
              </h2>
              <ul className="mt-2 space-y-0.5 text-sm">
                {doNotPlay.map((t) => (
                  <li key={t.id}>
                    {t.trackTitle}
                    {t.artist && t.artist !== "Unknown artist" ? `, ${t.artist}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        <footer className="mt-6 border-t border-parchment pt-2 text-xs text-ink/50">
          {wedding.contactPhone ? `Day-of contact: ${wedding.contactPhone} · ` : ""}
          {SITE_NAME} · {EMAIL_FROM_ADDRESS}
        </footer>
      </div>
    </div>
  );
}
