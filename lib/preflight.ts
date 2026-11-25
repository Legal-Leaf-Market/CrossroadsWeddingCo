// Pre-flight checks for a wedding's run sheet. Pure: no database, no clock,
// so it runs the same on the server page, in a dev preview and in a script.
//
// Ported in spirit from the DJ prep kit spec (Gemini, Nov 2026, the Kat and
// Tanis wedding), which proposed a separate Python validator. It lives here
// instead so the rules read the same rows the hub writes and cannot drift.
//
// The rule for every check: report only what the data actually says. This
// site never invents a song length, a BPM or a key, so the kit's checks that
// need those numbers (recessional under 2:15, open-floor crate at 85 to 95%
// of the window) are NOT here. They come back the day a real duration is
// stored, never from a guess.

export type Severity = "error" | "warn" | "info";

export type Check = { severity: Severity; message: string };

export type PreflightBlock = {
  title: string;
  /** HH:MM, 24-hour. */
  start: string;
  minutes: number;
};

export type PreflightCue = {
  cueType: string;
  label: string;
  trackTitle: string;
  artist: string;
  customEdit: boolean;
};

export type PreflightTrack = { trackTitle: string; artist: string };

export type PreflightInput = {
  timeline: PreflightBlock[];
  cues: PreflightCue[];
  mustPlay: PreflightTrack[];
  doNotPlay: PreflightTrack[];
  /** How many files the couple uploaded to the hub (their own paperwork). */
  documentCount: number;
};

// Words in a timeline block that mean a song moment is expected. Matched as
// whole words on the lowercased title, so "Dinner" never reads as "dinner
// dance" and a "first look" photo block never asks for a first dance song.
const MOMENT_WORDS: { type: string; label: string; re: RegExp }[] = [
  { type: "processional", label: "Processional", re: /\bprocession(al)?\b/ },
  { type: "recessional", label: "Recessional", re: /\brecession(al)?\b/ },
  { type: "grand_entrance", label: "Grand entrance", re: /\bgrand entrance\b|\bintroductions?\b/ },
  { type: "first_dance", label: "First dance", re: /\bfirst dance\b/ },
  { type: "father_daughter", label: "Father-daughter dance", re: /\bfather[- ]daughter\b/ },
  { type: "mother_son", label: "Mother-son dance", re: /\bmother[- ]son\b/ },
  { type: "cake_cutting", label: "Cake cutting", re: /\bcake\b/ },
  { type: "bouquet_toss", label: "Bouquet toss", re: /\bbouquet\b/ },
  { type: "garter_toss", label: "Garter toss", re: /\bgarter\b/ },
  { type: "money_dance", label: "Dollar dance", re: /\b(dollar|money) dance\b/ },
  { type: "last_song", label: "Last song", re: /\blast (song|dance)\b/ },
];

const UNKNOWN_ARTIST = "Unknown artist";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "(Remastered 2011)" is the same recording; "(Remix)" or "(Acoustic)" is not.
    .replace(/[(\[][^)\]]*remaster[^)\]]*[)\]]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artistOf(t: { artist: string }): string {
  return t.artist === UNKNOWN_ARTIST ? "" : norm(t.artist);
}

/** Same song if the titles match and the artists do not disagree. */
function sameSong(a: PreflightTrack, b: PreflightTrack): boolean {
  if (!norm(a.trackTitle) || norm(a.trackTitle) !== norm(b.trackTitle)) return false;
  const x = artistOf(a);
  const y = artistOf(b);
  return !x || !y || x === y;
}

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function show(t: PreflightTrack): string {
  const a = t.artist && t.artist !== UNKNOWN_ARTIST ? `, ${t.artist}` : "";
  return `"${t.trackTitle}"${a}`;
}

function cueName(c: PreflightCue, fallback: string): string {
  return c.label.trim() || fallback;
}

export function preflight(input: PreflightInput): Check[] {
  const out: Check[] = [];
  const blocks = input.timeline.filter((b) => b.title.trim() !== "" || b.start);
  const cues = input.cues;
  const hasSong = (c: PreflightCue) => c.trackTitle.trim() !== "";
  const typeLabel = (type: string) =>
    MOMENT_WORDS.find((m) => m.type === type)?.label ?? type.replace(/_/g, " ");

  // 1. Two blocks at the same minute need an order the MC can read aloud.
  const byStart = new Map<string, string[]>();
  for (const b of blocks) {
    const list = byStart.get(b.start) ?? [];
    list.push(b.title.trim() || "Untitled block");
    byStart.set(b.start, list);
  }
  for (const [start, titles] of byStart) {
    if (titles.length > 1) {
      out.push({
        severity: "warn",
        message: `${titles.join(" and ")} are both set for ${start}. Confirm the order they happen in.`,
      });
    }
  }

  // 2. A block that starts before the previous one ends.
  const timed = blocks
    .map((b) => ({ ...b, at: minutesOf(b.start) }))
    .filter((b): b is typeof b & { at: number } => b.at !== null)
    .sort((a, b) => a.at - b.at);
  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1];
    const cur = timed[i];
    if (cur.at === prev.at) continue; // reported by check 1
    const overlap = prev.at + prev.minutes - cur.at;
    if (overlap > 0) {
      out.push({
        severity: "warn",
        message: `${prev.title || "A block"} runs ${overlap} min into ${cur.title || "the next block"}.`,
      });
    }
  }

  // 3. A song moment on the schedule with no song chosen for it.
  const titles = blocks.map((b) => norm(b.title));
  for (const m of MOMENT_WORDS) {
    if (!titles.some((t) => m.re.test(t))) continue;
    if (!cues.some((c) => c.cueType === m.type && hasSong(c))) {
      out.push({ severity: "warn", message: `${m.label} is on the schedule but has no song yet.` });
    }
  }

  // 4. One song, one moment. The same track twice is usually a copy slip.
  const songs = cues.filter(hasSong);
  const seen = new Set<number>();
  for (let i = 0; i < songs.length; i++) {
    if (seen.has(i)) continue;
    const dup = [i];
    for (let j = i + 1; j < songs.length; j++) if (sameSong(songs[i], songs[j])) dup.push(j);
    if (dup.length > 1) {
      dup.forEach((k) => seen.add(k));
      const names = dup.map((k) => cueName(songs[k], typeLabel(songs[k].cueType)));
      out.push({
        severity: "warn",
        message: `${show(songs[i])} is set for ${names.join(" and ")}. Confirm it plays more than once.`,
      });
    }
  }

  // 5. A song the couple asked for and banned at the same time.
  const banned = input.doNotPlay.filter((t) => t.trackTitle.trim() !== "");
  for (const t of [...songs, ...input.mustPlay]) {
    const hit = banned.find((b) => sameSong(t, b));
    if (hit) {
      out.push({
        severity: "error",
        message: `${show(t)} is requested and also on the do-not-play list. Ask the couple which one stands.`,
      });
    }
  }

  // 6. A banned ARTIST (do-not-play row with an artist and no title).
  const bannedArtists = input.doNotPlay
    .filter((t) => t.trackTitle.trim() === "" && artistOf(t))
    .map(artistOf);
  for (const t of [...songs, ...input.mustPlay]) {
    if (artistOf(t) && bannedArtists.includes(artistOf(t))) {
      out.push({
        severity: "error",
        message: `${show(t)} is requested, but ${t.artist} is on the do-not-play list.`,
      });
    }
  }

  // 7. Custom edits have to exist as a file before the day.
  for (const c of songs.filter((c) => c.customEdit)) {
    out.push({
      severity: "warn",
      message: `${cueName(c, typeLabel(c.cueType))}: ${show(c)} is a custom edit. Have the edited file on the laptop and a backup.`,
    });
  }

  // 8. The couple's own paperwork is the official record (CLAUDE.md 9.2), and
  // nothing here can read a PDF, so the check is a reminder, never a verdict.
  if (input.documentCount > 0) {
    out.push({
      severity: "info",
      message: `The couple uploaded ${input.documentCount} document${input.documentCount === 1 ? "" : "s"}. Check this sheet against them before it is final.`,
    });
  }

  if (blocks.length === 0) out.push({ severity: "warn", message: "No timeline yet." });

  const rank: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  // Dedupe identical messages (a song can be both a cue and a must-play).
  return out
    .filter((c, i, all) => all.findIndex((x) => x.message === c.message) === i)
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
}
