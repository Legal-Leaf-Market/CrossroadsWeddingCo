"use client";

import { useEffect, useRef, useState } from "react";
import { CUE_TYPES, MAX_PLAYLIST_LINKS, parsePlaylistId, parseTrackId } from "@/lib/hub-constants";
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
  /** The couple's own name for the moment. Seeded from CUE_TYPES, editable. */
  label: string;
  trackTitle: string;
  artist: string;
  notes: string;
  /** The song's own Spotify link; renders as a playable row when set. */
  spotifyUrl: string;
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
  tracks?: FetchedTrack[];
  message?: string;
};

/** One track as the playlist route returns it. spotifyId is what makes a
 *  sent track land in a moment already playable. */
export type FetchedTrack = { title: string; artist: string; spotifyId?: string };

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
  demoTracks?: Record<string, { name: string; tracks: FetchedTrack[] }>;
}) {
  // Songs are a list, not a fixed grid: a wedding can need three processional
  // songs. Every standard moment is offered once so the page is never blank,
  // and any row the couple added or duplicated keeps its own place after it.
  const blank = (cueType: string, label: string): CueRow => ({
    cueType,
    label,
    trackTitle: "",
    artist: "",
    notes: "",
    spotifyUrl: "",
    isLivePerformance: false,
  });
  const toGrid = (rows: CueRow[]) => {
    const out: CueRow[] = [];
    for (const ct of CUE_TYPES) {
      const matches = rows.filter((c) => c.cueType === ct.type);
      if (matches.length === 0) out.push(blank(ct.type, ""));
      else out.push(...matches);
    }
    // A row whose type we no longer publish still belongs to the couple.
    for (const r of rows) {
      if (!CUE_TYPES.some((ct) => ct.type === r.cueType)) out.push(r);
    }
    return out;
  };
  const [cues, setCues] = useState<CueRow[]>(toGrid(initialCues));
  const [mustPlay, setMustPlay] = useState<TrackRow[]>(initialMustPlay);
  const [doNotPlay, setDoNotPlay] = useState<TrackRow[]>(initialDoNotPlay);
  const [playlists, setPlaylists] = useState<PlaylistLink[]>(initialPlaylists);
  const [armedMust, setArmedMust] = useState<number | null>(null);
  const [armedDoNot, setArmedDoNot] = useState<number | null>(null);
  const [armedPlaylist, setArmedPlaylist] = useState<number | null>(null);
  const [armedCue, setArmedCue] = useState<number | null>(null);
  // Playlist panels stay MOUNTED once opened and are only hidden with CSS when
  // collapsed, so the Spotify embed keeps its player state (and never reloads)
  // as the couple opens and closes it while filling in the moments below.
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [mountedIds, setMountedIds] = useState<string[]>([]);
  const [fetched, setFetched] = useState<Record<string, FetchedPlaylist>>({});
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

  // Display name for a row: the section's own name, numbered only when the
  // couple has more than one song in that section.
  function cueLabel(index: number): string {
    const row = cues[index];
    const base = CUE_TYPES.find((ct) => ct.type === row.cueType)?.label ?? "Another moment";
    const siblings = cues.filter((c) => c.cueType === row.cueType);
    if (siblings.length < 2) return base;
    return `${base} ${siblings.indexOf(row) + 1}`;
  }

  // Another song in the same section, inserted right after the last one so
  // the group stays together.
  function addCue(cueType: string) {
    setCues((rows) => {
      let last = -1;
      rows.forEach((r, i) => {
        if (r.cueType === cueType) last = i;
      });
      const next = [...rows];
      // The label is what keeps a row the couple deliberately added from being
      // dropped by the server before they have typed a song into it.
      const base = CUE_TYPES.find((ct) => ct.type === cueType)?.label ?? "Another moment";
      const count = rows.filter((r) => r.cueType === cueType).length;
      next.splice(last + 1, 0, blank(cueType, `${base} ${count + 1}`));
      return next;
    });
    cueSave.touch();
  }

  // Clearing the only song in a section leaves the empty section in place;
  // clearing an extra removes the row entirely.
  function clearCue(index: number) {
    setCues((rows) => {
      const row = rows[index];
      const siblings = rows.filter((c) => c.cueType === row.cueType);
      if (siblings.length < 2) {
        return rows.map((r, i) => (i === index ? blank(r.cueType, "") : r));
      }
      return rows.filter((_, i) => i !== index);
    });
    setArmedCue(null);
    cueSave.touch();
  }

  function updateCue(index: number, patch: Partial<CueRow>) {
    setCues((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    cueSave.touch();
  }

  // A pasted link names the song in the embed but not in our database, so the
  // printed run sheet would read "Processional:" with nothing after it. Look
  // the track up once per id and fill the blank track and artist boxes. Never
  // overwrites what the couple typed, and stays quiet when the lookup fails or
  // Spotify isn't connected: the embed still plays either way.
  const namedTrackIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const pending = cues
      .map((cue) => ({ cue, trackId: parseTrackId(cue.spotifyUrl) }))
      .filter(
        (row): row is { cue: CueRow; trackId: string } =>
          row.trackId !== null &&
          row.cue.trackTitle.trim() === "" &&
          !namedTrackIds.current.has(row.trackId),
      );
    if (pending.length === 0) return;

    for (const { cue, trackId } of pending) {
      namedTrackIds.current.add(trackId);
      void (async () => {
        try {
          const res = await fetch(`/api/hub/${token}/track?id=${trackId}`);
          if (!res.ok) return;
          const track = (await res.json()) as { title?: string; artist?: string };
          if (!track.title) return;
          let filled = false;
          setCues((rows) =>
            rows.map((row) => {
              // Re-check on the freshest rows: the couple may have typed a
              // name or swapped the link while this request was in flight.
              if (row.cueType !== cue.cueType) return row;
              if (row.trackTitle.trim() !== "") return row;
              if (parseTrackId(row.spotifyUrl) !== trackId) return row;
              filled = true;
              return { ...row, trackTitle: track.title!, artist: row.artist || (track.artist ?? "") };
            }),
          );
          if (filled) cueSave.touch();
        } catch {
          // Offline or blocked: leave the row as the couple left it.
        }
      })();
    }
  }, [cues, token, cueSave]);

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
  function placeTrack(track: FetchedTrack, target: string) {
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
    // Carry the link too, so the moment comes back as a playable row rather
    // than a name the couple has to go verify against Spotify by hand.
    const url = track.spotifyId ? `https://open.spotify.com/track/${track.spotifyId}` : "";
    const targetIndex = Number(target);
    setCues((rows) =>
      rows.map((row, i) =>
        i === targetIndex
          ? {
              ...row,
              trackTitle: track.title,
              artist: track.artist,
              spotifyUrl: url || row.spotifyUrl,
            }
          : row,
      ),
    );
    cueSave.touch();
  }

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
                    {/* Spotify's player is a cross-origin iframe: we cannot add a
                        per-row menu inside it, so this is the two-tap path to a
                        single song's link. */}
                    <p className="mt-2 text-xs text-ink/60">
                      Need one song&apos;s link for a moment below?{" "}
                      <a
                        href={`https://open.spotify.com/playlist/${playlistId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-terracotta underline decoration-parchment underline-offset-2"
                      >
                        Open this playlist in Spotify
                      </a>
                      , tap the three dots beside the song, then Share, then Copy Song Link.
                    </p>
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
                                  {cues.map((c, ci) => (
                                    <option key={`${c.cueType}-${ci}`} value={String(ci)}>
                                      {cueLabel(ci)}
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
        <h3 className="text-sm font-semibold text-charcoal">Your songs, moment by moment</h3>
        <p className="mb-3 text-xs text-ink/50">
          Grab a song&apos;s link from Spotify (three dots beside the song, Share, Copy Song
          Link), paste it into any row, and it becomes playable right here, so we are both
          listening to the same thing. Then tell us how to handle it. Leave any row blank and
          we choose it together on your call.
        </p>
        <ul className="space-y-3">
          {cues.map((cue, index) => {
            const meta = CUE_TYPES.find((ct) => ct.type === cue.cueType);
            const sectionName = meta?.label ?? "moment";
            const isLastOfType =
              cues.findLastIndex((c) => c.cueType === cue.cueType) === index;
            const trackId = parseTrackId(cue.spotifyUrl);
            const badTrack = cue.spotifyUrl.trim() !== "" && !trackId;
            return (
              <li
                key={`${cue.cueType}-${index}`}
                className="overflow-hidden rounded-xl border border-parchment bg-white"
              >
                <div className="flex items-center justify-between gap-2 border-b border-parchment bg-parchment/30 px-3 py-2">
                  <span className="text-sm font-semibold text-charcoal">{cueLabel(index)}</span>
                  <span className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-ink/60">
                      <input
                        type="checkbox"
                        checked={cue.isLivePerformance}
                        onChange={(e) => updateCue(index, { isLivePerformance: e.target.checked })}
                        className="accent-terracotta"
                      />
                      Played live
                    </label>
                    <RemoveButton
                      label={`Clear ${cueLabel(index)}`}
                      armed={armedCue === index}
                      onToggle={(next) => setArmedCue(next ? index : null)}
                      onRemove={() => clearCue(index)}
                    />
                  </span>
                </div>
                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  <div>
                    <input
                      aria-label={`${cueLabel(index)} Spotify link`}
                      aria-invalid={badTrack || undefined}
                      className={hubInput}
                      value={cue.spotifyUrl}
                      maxLength={500}
                      onChange={(e) => updateCue(index, { spotifyUrl: e.target.value })}
                      placeholder="Paste the song's Spotify link"
                    />
                    {badTrack && (
                      <p className="mt-1 text-xs text-terracotta-dark">
                        That is not a song link. In Spotify, tap the three dots beside the
                        song, then Share, then Copy Song Link.
                      </p>
                    )}
                    {trackId && (
                      <iframe
                        // Compact single-track player. Cheap, and it means the
                        // row itself is the song rather than a name for it.
                        src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
                        title={`${cueLabel(index)} song`}
                        width="100%"
                        height={80}
                        style={{ borderRadius: 10, border: 0, marginTop: 8 }}
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                      />
                    )}
                    {!trackId && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          aria-label={`${cueLabel(index)} track`}
                          className={hubInput}
                          value={cue.trackTitle}
                          maxLength={255}
                          onChange={(e) => updateCue(index, { trackTitle: e.target.value })}
                          placeholder="Or just the track name"
                        />
                        <input
                          aria-label={`${cueLabel(index)} artist`}
                          className={hubInput}
                          value={cue.artist}
                          maxLength={255}
                          onChange={(e) => updateCue(index, { artist: e.target.value })}
                          placeholder="Artist"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <textarea
                      aria-label={`${cueLabel(index)} notes`}
                      className={hubInput}
                      rows={trackId ? 4 : 3}
                      value={cue.notes}
                      maxLength={2000}
                      onChange={(e) => updateCue(index, { notes: e.target.value })}
                      placeholder="How should we handle it? Fade it early, start when the doors open, skip the long intro, announce it first..."
                    />
                    {trackId && (cue.trackTitle.trim() || cue.artist.trim()) && (
                      <p className="mt-1 truncate text-xs text-ink/40">
                        {[cue.trackTitle, cue.artist].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                {isLastOfType && (
                  <div className="border-t border-parchment px-3 py-2">
                    <button
                      type="button"
                      onClick={() => addCue(cue.cueType)}
                      className="text-sm font-semibold text-terracotta hover:text-terracotta-dark"
                    >
                      + Add another {sectionName.toLowerCase()} song
                    </button>
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
