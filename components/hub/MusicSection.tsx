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

export default function MusicSection({
  token,
  initialCues,
  initialMustPlay,
  initialDoNotPlay,
  initialPlaylists,
  initialCuesRev,
  initialPlaylistsRev,
}: {
  token: string;
  initialCues: CueRow[];
  initialMustPlay: TrackRow[];
  initialDoNotPlay: TrackRow[];
  initialPlaylists: PlaylistLink[];
  initialCuesRev: number;
  initialPlaylistsRev: number;
}) {
  const toGrid = (rows: CueRow[]) =>
    CUE_TYPES.map(
      (ct) =>
        rows.find((c) => c.cueType === ct.type) ?? {
          cueType: ct.type,
          trackTitle: "",
          artist: "",
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

  return (
    <div className="space-y-6">
      <SectionCard
        title="The big moments"
        subtitle="One track per moment. Leave anything blank and we'll pick it together on the call. Tick the guitar box for moments you want played live."
        badge={<SaveBadge state={cueSave.state} message={cueSave.message} />}
      >
        <ul className="space-y-3">
          {cues.map((cue, index) => {
            const meta = CUE_TYPES.find((ct) => ct.type === cue.cueType);
            return (
              <li key={cue.cueType} className="grid gap-2 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-center">
                <span className="text-sm font-semibold text-charcoal">{meta?.label}</span>
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
                <label className="flex items-center gap-1 text-xs text-ink/60" title="Played live on acoustic guitar">
                  <input
                    type="checkbox"
                    checked={cue.isLivePerformance}
                    onChange={(e) => updateCue(index, { isLivePerformance: e.target.checked })}
                    className="accent-terracotta"
                  />
                  Live
                </label>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard
        title="Your playlists and hard lines"
        subtitle="Build your playlists in your own Spotify and paste the share links: cocktail hour, dinner, dance floor, however you split it. Must-plays are promises; the do-not-play list is law."
        badge={<SaveBadge state={listSave.state} message={listSave.message} />}
      >
        <div>
          <h3 className="text-sm font-semibold text-charcoal">Spotify playlists</h3>
          <p className="mb-2 text-xs text-ink/50">
            In Spotify: Share, then Copy link. Name each one so we know where it belongs in the day.
          </p>
          <ul className="space-y-2">
            {playlists.map((p, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
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
              </li>
            ))}
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
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
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
    </div>
  );
}
