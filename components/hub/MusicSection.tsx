"use client";

import { useState } from "react";
import { CUE_TYPES } from "@/lib/hub-constants";
import { hubInput, hubSave, SaveBadge, SectionCard, useAutosave } from "./shared";

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
}: {
  label: string;
  hint: string;
  rows: TrackRow[];
  setRows: React.Dispatch<React.SetStateAction<TrackRow[]>>;
  onTouched: () => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-charcoal">{label}</h3>
      <p className="mb-2 text-xs text-ink/50">{hint}</p>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex gap-2">
            <input
              aria-label={`${label} track`}
              className={`${hubInput} flex-1`}
              value={row.trackTitle}
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
              onChange={(e) => {
                setRows((r) => r.map((t, i) => (i === index ? { ...t, artist: e.target.value } : t)));
                onTouched();
              }}
              placeholder="Artist"
            />
            <button
              type="button"
              aria-label="Remove track"
              onClick={() => {
                setRows((r) => r.filter((_, i) => i !== index));
                onTouched();
              }}
              className="rounded px-2 text-ink/50 hover:text-terracotta-dark"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {rows.length < 100 && (
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { trackTitle: "", artist: "" }])}
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
}: {
  token: string;
  initialCues: CueRow[];
  initialMustPlay: TrackRow[];
  initialDoNotPlay: TrackRow[];
  initialPlaylistUrl: string;
}) {
  const [cues, setCues] = useState<CueRow[]>(
    CUE_TYPES.map(
      (ct) =>
        initialCues.find((c) => c.cueType === ct.type) ?? {
          cueType: ct.type,
          trackTitle: "",
          artist: "",
          isLivePerformance: false,
        },
    ),
  );
  const [mustPlay, setMustPlay] = useState<TrackRow[]>(initialMustPlay);
  const [doNotPlay, setDoNotPlay] = useState<TrackRow[]>(initialDoNotPlay);
  const [playlistUrl, setPlaylistUrl] = useState(initialPlaylistUrl);

  const cueSave = useAutosave(() => hubSave(`/api/hub/${token}/cues`, "PUT", { cues }));
  const listSave = useAutosave(() =>
    hubSave(`/api/hub/${token}/playlists`, "PUT", {
      mustPlay: mustPlay.filter((t) => t.trackTitle.trim()),
      doNotPlay: doNotPlay.filter((t) => t.trackTitle.trim()),
    }),
  );
  const urlSave = useAutosave(() =>
    hubSave(`/api/hub/${token}/details`, "PATCH", { spotifyPlaylistUrl: playlistUrl }),
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
        badge={<SaveBadge state={cueSave.state} />}
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
                  onChange={(e) => updateCue(index, { trackTitle: e.target.value })}
                  placeholder="Track"
                />
                <input
                  aria-label={`${meta?.label} artist`}
                  className={hubInput}
                  value={cue.artist}
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
        badge={<SaveBadge state={listSave.state === "idle" ? urlSave.state : listSave.state} />}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Spotify playlist link</span>
          <input
            className={hubInput}
            value={playlistUrl}
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
