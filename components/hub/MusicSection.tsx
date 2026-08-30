"use client";

import { useRef, useState } from "react";
import { CUE_TYPES, MAX_PLAYLIST_LINKS, parsePlaylistId } from "@/lib/hub-constants";
import {
  hubInput,
  RemoveButton,
  revAwareSave,
  SaveBadge,
  SectionCard,
  useAutosave,
  type SaveFn,
} from "./shared";

export type CueRow = {
  cueType: string;
  trackTitle: string;
  artist: string;
  notes: string;
  isLivePerformance: boolean;
};

export type TrackRow = { trackTitle: string; artist: string };

function TrackList({
  label,
  hint,
  rows,
  setRows,
  onTouched,
  armedRemove,
  setArmedRemove,
}: {
  label: string;
  hint: string;
  rows: TrackRow[];
  setRows: React.Dispatch<React.SetStateAction<TrackRow[]>>;
  onTouched: () => void;
  // Armed state lives with the parent so a 409 refresh that swaps the rows
  // can disarm a pending "Sure?" before it deletes the wrong track.
  armedRemove: number | null;
  setArmedRemove: (next: number | null) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-charcoal">{label}</h3>
      <p className="mb-2 text-xs text-ink/50">{hint}</p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <input
              aria-label={`${label} track`}
              className={`${hubInput} flex-1`}
              value={row.trackTitle}
              maxLength={255}
              onChange={(e) => {
                setRows((r) => r.map((t, i) => (i === index ? { ...t, trackTitle: e.target.value } : t)));
                onTouched();
              }}
              placeholder="Track"
            />
            <input
              aria-label={`${label} artist`}
              className={`${hubInput} flex-1`}
              value={row.artist}
              maxLength={255}
              onChange={(e) => {
                setRows((r) => r.map((t, i) => (i === index ? { ...t, artist: e.target.value } : t)));
                onTouched();
              }}
              placeholder="Artist"
            />
            <RemoveButton
              label="Remove track"
              armed={armedRemove === index}
              onToggle={(next) => setArmedRemove(next ? index : null)}
              onRemove={() => {
                setRows((r) => r.filter((_, i) => i !== index));
                setArmedRemove(null);
                onTouched();
              }}
            />
          </li>
        ))}
      </ul>
      {rows.length < 100 && (
        <button
          type="button"
          onClick={() => {
            setRows((r) => [...r, { trackTitle: "", artist: "" }]);
            setArmedRemove(null);
            onTouched();
          }}
          className="mt-2 text-sm font-semibold text-terracotta hover:text-terracotta-dark"
        >
          + Add a track
        </button>
      )}
    </div>
  );
}

export type { PlaylistLink } from "@/lib/hub-constants";
import type { PlaylistLink } from "@/lib/hub-constants";

// One fetched playlist, cached per playlist id for the life of the page so
// collapsing and reopening never refetches.
export type FetchedPlaylist = {
  state: "loading" | "ready" | "error";
  name?: string;
  total?: number;
  tracks?: { title: string; artist: string }[];
  message?: string;
};

export default function MusicSection({
  token,
  initialCues,
  initialMustPlay,
  initialDoNotPlay,
  initialPlaylists,
  initialCuesRev,
  initialPlaylistsRev,
  demoTracks,
}: {
  token: string;
  initialCues: CueRow[];
  initialMustPlay: TrackRow[];
  initialDoNotPlay: TrackRow[];
  initialPlaylists: PlaylistLink[];
  initialCuesRev: number;
  initialPlaylistsRev: number;
  /** Preview-only: playlist id -> tracks, served without touching the API. */
  demoTracks?: Record<string, { name: string; tracks: { title: string; artist: string }[] }>;
}) {
  const toGrid = (rows: CueRow[]) =>
    CUE_TYPES.map(
      (ct) =>
        rows.find((c) => c.cueType === ct.type) ?? {
          cueType: ct.type,
          trackTitle: "",
          artist: "",
          notes: "",
          isLivePerformance: false,
        },
    );
  const [cues, setCues] = useState<CueRow[]>(toGrid(initialCues));
  const [mustPlay, setMustPlay] = useState<TrackRow[]>(initialMustPlay);
  const [doNotPlay, setDoNotPlay] = useState<TrackRow[]>(initialDoNotPlay);
  const [playlists, setPlaylists] = useState<PlaylistLink[]>(initialPlaylists);
  const [armedMust, setArmedMust] = useState<number | null>(null);
  const [armedDoNot, setArmedDoNot] = useState<number | null>(null);
  const [armedPlaylist, setArmedPlaylist] = useState<number | null>(null);
  // Playlist panels stay MOUNTED once opened and are only hidden with CSS when
  // collapsed, so the Spotify embed keeps its player state (and never reloads)
  // as the couple opens and closes it while filling in the moments below.
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [mountedIds, setMountedIds] = useState<string[]>([]);
  const [fetched, setFetched] = useState<Record<string, FetchedPlaylist>>({});
  // Which big moment is expanded for editing; the rest stay collapsed to one line.
  const [openMoment, setOpenMoment] = useState<string | null>(null);
  const cuesRev = useRef(initialCuesRev);
  const playlistsRev = useRef(initialPlaylistsRev);
  const cuesSaveIds = useRef<string[]>([]);
  const playlistsSaveIds = useRef<string[]>([]);

  const saveCues: SaveFn = ({ keepalive }) =>
    revAwareSave({
      path: `/api/hub/${token}/cues`,
      payload: { cues },
      rev: cuesRev,
      sentSaveIds: cuesSaveIds,
      keepalive,
      onConflict: (body) => {
        const b = body as { cues?: CueRow[] };
        if (Array.isArray(b.cues)) setCues(toGrid(b.cues));
      },
    });

  // A non-playlist link still saves as typed (holding the save would block
  // the track-list edits sharing this section); the field is flagged and the
  // hint below the list explains, so nothing is lost and nothing lies.
  const badLink = (p: PlaylistLink) => p.url.trim() !== "" && !parsePlaylistId(p.url);

  const saveLists: SaveFn = async ({ keepalive }) => {
    return revAwareSave({
      path: `/api/hub/${token}/playlists`,
      payload: { mustPlay, doNotPlay, playlists },
      rev: playlistsRev,
      sentSaveIds: playlistsSaveIds,
      keepalive,
      onConflict: (body) => {
        const b = body as {
          mustPlay?: TrackRow[];
          doNotPlay?: TrackRow[];
          playlists?: PlaylistLink[];
        };
        if (!Array.isArray(b.mustPlay) || !Array.isArray(b.doNotPlay)) return;
        setMustPlay(b.mustPlay);
        setDoNotPlay(b.doNotPlay);
        if (Array.isArray(b.playlists)) setPlaylists(b.playlists);
        // Disarm: the rows just changed under any armed remove button.
        setArmedMust(null);
        setArmedDoNot(null);
        setArmedPlaylist(null);
      },
    });
  };

  const cueSave = useAutosave(saveCues);
  const listSave = useAutosave(saveLists);

  function updateCue(index: number, patch: Partial<CueRow>) {
    setCues((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    cueSave.touch();
  }

  async function togglePlaylist(playlistId: string, url: string) {
    if (openIds.includes(playlistId)) {
      setOpenIds((ids) => ids.filter((id) => id !== playlistId));
      return;
    }
    setOpenIds((ids) => [...ids, playlistId]);
    setMountedIds((ids) => (ids.includes(playlistId) ? ids : [...ids, playlistId]));
    if (fetched[playlistId]?.state === "ready") return;

    if (demoTracks?.[playlistId]) {
      const demo = demoTracks[playlistId];
      setFetched((f) => ({
        ...f,
        [playlistId]: { state: "ready", name: demo.name, total: demo.tracks.length, tracks: demo.tracks },
      }));
      return;
    }

    setFetched((f) => ({ ...f, [playlistId]: { state: "loading" } }));
    try {
      const res = await fetch(
        `/api/hub/${token}/playlist-tracks?url=${encodeURIComponent(url)}`,
        { cache: "no-store" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        name?: string;
        total?: number;
        tracks?: { title: string; artist: string }[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(json.tracks)) {
        setFetched((f) => ({
          ...f,
          [playlistId]: { state: "error", message: json.error || "We couldn't load that playlist right now." },
        }));
        return;
      }
      setFetched((f) => ({
        ...f,
        [playlistId]: { state: "ready", name: json.name, total: json.total, tracks: json.tracks },
      }));
    } catch {
      setFetched((f) => ({
        ...f,
        [playlistId]: { state: "error", message: "No connection. Tap the playlist again to retry." },
      }));
    }
  }

  // "Send a track somewhere": into one of the big-moment slots (overwriting
  // what's there; the row sits right above and shows the change), or onto the
  // must-play list (deduped).
  function placeTrack(track: { title: string; artist: string }, target: string) {
    if (target === "must_play") {
      setMustPlay((rows) => {
        const exists = rows.some(
          (r) =>
            r.trackTitle.trim().toLowerCase() === track.title.trim().toLowerCase() &&
            r.artist.trim().toLowerCase() === track.artist.trim().toLowerCase(),
        );
        return exists ? rows : [...rows, { trackTitle: track.title, artist: track.artist }];
      });
      listSave.touch();
      return;
    }
    setCues((rows) =>
      rows.map((row) =>
        row.cueType === target ? { ...row, trackTitle: track.title, artist: track.artist } : row,
      ),
    );
    cueSave.touch();
  }

  const cueSummary = (cue: CueRow) => {
    const t = [cue.trackTitle, cue.artist].filter((x) => x.trim()).join(" · ");
    return t || "Not chosen yet";
  };

  return (
    <SectionCard
      title="Music"
      subtitle="Your playlists live at the top: open one and it stays open, so you can play it while you pick the songs for each moment below."
      badge={
        <span className="flex items-center gap-3">
          <SaveBadge state={listSave.state} message={listSave.message} />
          <SaveBadge state={cueSave.state} message={cueSave.message} />
        </span>
      }
    >
      <div>
        <h3 className="text-sm font-semibold text-charcoal">Your Spotify playlists</h3>
        <p className="mb-2 text-xs text-ink/50">
          In Spotify: Share, then Copy link. Name each one so we know where it belongs in the day.
        </p>
        <ul className="space-y-2">
          {playlists.map((p, index) => {
            const playlistId = parsePlaylistId(p.url);
            const isOpen = playlistId !== null && openIds.includes(playlistId);
            const isMounted = playlistId !== null && mountedIds.includes(playlistId);
            const data = playlistId ? fetched[playlistId] : undefined;
            return (
              <li key={index}>
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <input
                    aria-label="Playlist name"
                    className={`${hubInput} basis-40 sm:basis-56 sm:flex-none`}
                    value={p.label}
                    maxLength={100}
                    onChange={(e) => {
                      setPlaylists((r) => r.map((row, i) => (i === index ? { ...row, label: e.target.value } : row)));
                      listSave.touch();
                    }}
                    placeholder="Cocktail hour"
                  />
                  <input
                    aria-label="Playlist link"
                    aria-invalid={badLink(p) || undefined}
                    className={`${hubInput} min-w-40 flex-1`}
                    value={p.url}
                    maxLength={500}
                    onChange={(e) => {
                      setPlaylists((r) => r.map((row, i) => (i === index ? { ...row, url: e.target.value } : row)));
                      listSave.touch();
                    }}
                    placeholder="https://open.spotify.com/playlist/..."
                  />
                  {playlistId && (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? "Hide playlist" : "Show playlist"}
                      onClick={() => void togglePlaylist(playlistId, p.url)}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg font-semibold ${
                        isOpen
                          ? "border-terracotta bg-terracotta text-cream"
                          : "border-parchment text-terracotta hover:border-terracotta"
                      }`}
                    >
                      {isOpen ? "\u2212" : "+"}
                    </button>
                  )}
                  <RemoveButton
                    label="Remove playlist"
                    armed={armedPlaylist === index}
                    onToggle={(next) => setArmedPlaylist(next ? index : null)}
                    onRemove={() => {
                      setPlaylists((r) => r.filter((_, i) => i !== index));
                      setArmedPlaylist(null);
                      listSave.touch();
                    }}
                  />
                </div>
                {isMounted && (
                  <div
                    // Hidden, never unmounted: the embed keeps its player state
                    // so collapsing and reopening never restarts the music.
                    className={`mt-2 rounded-xl border border-parchment bg-parchment/30 p-3 ${isOpen ? "" : "hidden"}`}
                  >
                    <iframe
                      src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`}
                      title={`${p.label || "Playlist"} on Spotify`}
                      width="100%"
                      height={352}
                      style={{ borderRadius: 12, border: 0 }}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                    />
                    {data?.state === "ready" && data.tracks && data.tracks.length > 0 && (
                      <>
                        <p className="mb-2 mt-3 text-xs text-ink/60">
                          Send any of these straight to a moment below.
                        </p>
                        <ul className="max-h-60 space-y-1 overflow-y-auto pr-1">
                          {data.tracks.map((t, ti) => (
                            <li
                              key={`${t.title}-${ti}`}
                              className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5"
                            >
                              <span className="min-w-0 flex-1 truncate text-sm text-charcoal">
                                {t.title}
                                <span className="text-ink/50"> · {t.artist}</span>
                              </span>
                              <select
                                aria-label={`Send ${t.title} to`}
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) placeTrack(t, e.target.value);
                                }}
                                className="w-20 shrink-0 rounded-lg border border-parchment bg-white px-2 py-1.5 text-xs font-semibold text-terracotta"
                              >
                                <option value="" disabled>
                                  Add...
                                </option>
                                <optgroup label="Big moments">
                                  {CUE_TYPES.map((ct) => (
                                    <option key={ct.type} value={ct.type}>
                                      {ct.label}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Lists">
                                  <option value="must_play">Must play</option>
                                </optgroup>
                              </select>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {playlists.some(badLink) && (
          <p className="mt-2 text-xs text-terracotta-dark">
            A highlighted link doesn&apos;t look like a Spotify playlist. In Spotify: Share,
            then Copy link.
          </p>
        )}
        {playlists.length < MAX_PLAYLIST_LINKS && (
          <button
            type="button"
            onClick={() => {
              setPlaylists((r) => [...r, { label: "", url: "" }]);
              setArmedPlaylist(null);
              listSave.touch();
            }}
            className="mt-2 text-sm font-semibold text-terracotta hover:text-terracotta-dark"
          >
            + Add a playlist
          </button>
        )}
      </div>

      <div className="mt-6 border-t border-parchment pt-5">
        <h3 className="text-sm font-semibold text-charcoal">The big moments</h3>
        <p className="mb-2 text-xs text-ink/50">
          Tap a moment to choose its song, tell us how to handle it, and mark it live if you
          want it played on guitar instead of the speakers. Leave any of them blank and we
          pick together on your call.
        </p>
        <ul className="divide-y divide-parchment rounded-xl border border-parchment">
          {cues.map((cue, index) => {
            const meta = CUE_TYPES.find((ct) => ct.type === cue.cueType);
            const isOpen = openMoment === cue.cueType;
            const filled = cue.trackTitle.trim() !== "" || cue.artist.trim() !== "";
            return (
              <li key={cue.cueType}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenMoment(isOpen ? null : cue.cueType)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-parchment/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-charcoal">
                      {meta?.label}
                      {cue.isLivePerformance && (
                        <span className="ml-2 rounded-full bg-terracotta/15 px-2 py-0.5 text-[11px] font-semibold text-terracotta">
                          live
                        </span>
                      )}
                    </span>
                    <span
                      className={`block truncate text-sm ${filled ? "text-ink/70" : "text-ink/40"}`}
                    >
                      {cueSummary(cue)}
                    </span>
                  </span>
                  <span className="shrink-0 text-lg font-semibold text-terracotta">
                    {isOpen ? "\u2212" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-2 bg-parchment/20 px-3 pb-4 pt-1">
                    <input
                      aria-label={`${meta?.label} track`}
                      className={hubInput}
                      value={cue.trackTitle}
                      maxLength={255}
                      onChange={(e) => updateCue(index, { trackTitle: e.target.value })}
                      placeholder="Track"
                    />
                    <input
                      aria-label={`${meta?.label} artist`}
                      className={hubInput}
                      value={cue.artist}
                      maxLength={255}
                      onChange={(e) => updateCue(index, { artist: e.target.value })}
                      placeholder="Artist"
                    />
                    <textarea
                      aria-label={`${meta?.label} notes`}
                      className={hubInput}
                      rows={2}
                      value={cue.notes}
                      maxLength={2000}
                      onChange={(e) => updateCue(index, { notes: e.target.value })}
                      placeholder="Anything we should know: fade it early, start it when the doors open, skip the long intro..."
                    />
                    <label className="flex items-center gap-2 text-sm text-ink/70">
                      <input
                        type="checkbox"
                        checked={cue.isLivePerformance}
                        onChange={(e) => updateCue(index, { isLivePerformance: e.target.checked })}
                        className="accent-terracotta"
                      />
                      Play this one live on guitar
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6 grid gap-6 border-t border-parchment pt-5 sm:grid-cols-2">
        <TrackList
          label="Must play"
          hint="These make the night. We work them in, guaranteed."
          rows={mustPlay}
          setRows={setMustPlay}
          onTouched={listSave.touch}
          armedRemove={armedMust}
          setArmedRemove={setArmedMust}
        />
        <TrackList
          label="Do not play"
          hint="Hard vetoes. Songs, or whole genres, that never touch the speakers."
          rows={doNotPlay}
          setRows={setDoNotPlay}
          onTouched={listSave.touch}
          armedRemove={armedDoNot}
          setArmedRemove={setArmedDoNot}
        />
      </div>
    </SectionCard>
  );
}
