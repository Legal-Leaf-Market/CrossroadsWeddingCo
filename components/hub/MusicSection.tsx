"use client";

import { useRef, useState } from "react";
import { CUE_TYPES } from "@/lib/hub-constants";
import {
  hubInput,
  hubSave,
  RemoveButton,
  SaveBadge,
  SectionCard,
  useAutosave,
  type SaveFn,
  type SaveState,
} from "./shared";

export type CueRow = {
  cueType: string;
  trackTitle: string;
  artist: string;
  isLivePerformance: boolean;
};

export type TrackRow = { trackTitle: string; artist: string };

/**
 * The playlist card runs two saves (the track lists and the playlist URL);
 * its one badge must never let a green Saved from one hide a failure in the
 * other, so the worse state always wins.
 */
function combineBadge(
  a: { state: SaveState; message: string | null },
  b: { state: SaveState; message: string | null },
): { state: SaveState; message: string | null } {
  const order: SaveState[] = ["conflict", "error", "saving", "saved", "idle"];
  for (const state of order) {
    if (a.state === state) return a;
    if (b.state === state) return b;
  }
  return a;
}

function TrackList({
  label,
  hint,
  rows,
  setRows,
  onTouched,
}: {
  label: string;
  hint: string;
  rows: TrackRow[];
  setRows: React.Dispatch<React.SetStateAction<TrackRow[]>>;
  onTouched: () => void;
}) {
  const [armedRemove, setArmedRemove] = useState<number | null>(null);
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

export default function MusicSection({
  token,
  initialCues,
  initialMustPlay,
  initialDoNotPlay,
  initialPlaylistUrl,
  initialCuesRev,
  initialPlaylistsRev,
}: {
  token: string;
  initialCues: CueRow[];
  initialMustPlay: TrackRow[];
  initialDoNotPlay: TrackRow[];
  initialPlaylistUrl: string;
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
  const [playlistUrl, setPlaylistUrl] = useState(initialPlaylistUrl);
  const cuesRev = useRef(initialCuesRev);
  const playlistsRev = useRef(initialPlaylistsRev);

  const saveCues: SaveFn = async ({ keepalive, flush }) => {
    const out = await hubSave(
      `/api/hub/${token}/cues`,
      "PUT",
      { rev: cuesRev.current, cues },
      { keepalive },
    );
    if (out.ok) {
      const body = out.body as { rev?: number } | null;
      if (typeof body?.rev === "number") cuesRev.current = body.rev;
      return { ok: true };
    }
    if (out.status === 409) {
      // Flush saves must not apply the 409 snapshot; see TimelineSection.
      if (!flush) {
        const body = out.body as { rev: number; cues: CueRow[] };
        cuesRev.current = body.rev;
        setCues(toGrid(body.cues));
      }
      return { ok: false, conflict: true, message: out.message };
    }
    return { ok: false, message: out.message };
  };

  const saveLists: SaveFn = async ({ keepalive, flush }) => {
    const out = await hubSave(
      `/api/hub/${token}/playlists`,
      "PUT",
      { rev: playlistsRev.current, mustPlay, doNotPlay },
      { keepalive },
    );
    if (out.ok) {
      const body = out.body as { rev?: number } | null;
      if (typeof body?.rev === "number") playlistsRev.current = body.rev;
      return { ok: true };
    }
    if (out.status === 409) {
      // Flush saves must not apply the 409 snapshot; see TimelineSection.
      if (!flush) {
        const body = out.body as { rev: number; mustPlay: TrackRow[]; doNotPlay: TrackRow[] };
        playlistsRev.current = body.rev;
        setMustPlay(body.mustPlay);
        setDoNotPlay(body.doNotPlay);
      }
      return { ok: false, conflict: true, message: out.message };
    }
    return { ok: false, message: out.message };
  };

  const saveUrl: SaveFn = async ({ keepalive }) => {
    const out = await hubSave(
      `/api/hub/${token}/details`,
      "PATCH",
      { spotifyPlaylistUrl: playlistUrl },
      { keepalive },
    );
    return out.ok ? { ok: true } : { ok: false, message: out.message };
  };

  const cueSave = useAutosave(saveCues);
  const listSave = useAutosave(saveLists);
  const urlSave = useAutosave(saveUrl);
  const playlistBadge = combineBadge(
    { state: listSave.state, message: listSave.message },
    { state: urlSave.state, message: urlSave.message },
  );

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
        title="Your playlist and hard lines"
        subtitle="Build the big playlist in your own Spotify and paste the share link. Must-plays are promises; the do-not-play list is law."
        badge={<SaveBadge state={playlistBadge.state} message={playlistBadge.message} />}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Spotify playlist link</span>
          <input
            className={hubInput}
            value={playlistUrl}
            maxLength={500}
            onChange={(e) => {
              setPlaylistUrl(e.target.value);
              urlSave.touch();
            }}
            placeholder="https://open.spotify.com/playlist/..."
          />
        </label>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <TrackList
            label="Must play"
            hint="These make the night. We work them in, guaranteed."
            rows={mustPlay}
            setRows={setMustPlay}
            onTouched={listSave.touch}
          />
          <TrackList
            label="Do not play"
            hint="Hard vetoes. Songs, or whole genres, that never touch the speakers."
            rows={doNotPlay}
            setRows={setDoNotPlay}
            onTouched={listSave.touch}
          />
        </div>
      </SectionCard>
    </div>
  );
}
