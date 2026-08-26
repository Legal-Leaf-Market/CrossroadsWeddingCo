"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const hubInput =
  "w-full rounded-lg border border-parchment bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none aria-invalid:border-terracotta-dark";

export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export type SaveResult =
  | { ok: true }
  | { ok: false; message?: string; conflict?: boolean; noRetry?: boolean };

/** Section save callback. `keepalive` is true for hide-time flush saves. */
export type SaveFn = (opts: { keepalive: boolean }) => Promise<SaveResult>;

const MAX_QUIET_RETRIES = 3;

/**
 * Debounced autosave: call `touch()` after every edit; `save` fires once the
 * edits pause. The design is deliberately simple: every save runs on one
 * promise chain (never two requests in flight from this hook), a sequence
 * counter keeps stale responses from winning the badge, and a completed-seq
 * watermark tells the hide-time flush whether anything is actually unsaved.
 * The flush queues a chained keepalive save whenever the newest edit has not
 * been confirmed saved: pending debounce, queued behind an in-flight save,
 * or parked in the retry window. There is intentionally no fire-and-forget
 * side channel; racing our own in-flight request created worse failure modes
 * than the narrow one it closed (a tab killed mid-flight), and that case is
 * covered by keepalive on the in-flight request itself plus self-conflict
 * detection (see revAwareSave) when the response is lost.
 */
export function useAutosave(save: SaveFn, delay = 700) {
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const seq = useRef(0);
  const lastOkSeq = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);

  const run = useCallback((mySeq: number, keepalive = false) => {
    chain.current = chain.current.then(async () => {
      // A newer edit scheduled its own save; let that one carry the data.
      if (seq.current !== mySeq) return;
      // This state already reached the server (a flush save queued behind
      // the save that then succeeded); a re-send would only bump the rev.
      if (lastOkSeq.current >= mySeq) return;
      let result: SaveResult;
      try {
        result = await saveRef.current({ keepalive });
      } catch {
        result = { ok: false };
      }
      if (!result.ok && result.conflict) {
        // The section already replaced its rows with the server's; anything
        // typed mid-flight went with them. This must win over the newer-edit
        // guard below, and all queued work must die here: a pending save
        // would re-commit the replaced rows and flip the badge to a false
        // Saved, hiding that the other device's version now stands.
        retries.current = 0;
        seq.current += 1;
        lastOkSeq.current = seq.current;
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        if (retryTimer.current) {
          clearTimeout(retryTimer.current);
          retryTimer.current = null;
        }
        setState("conflict");
        setMessage(result.message ?? "Updated from another device. Showing the latest.");
        return;
      }
      // Edited while the request was in flight: stay on "saving".
      if (seq.current !== mySeq) return;
      if (result.ok) {
        retries.current = 0;
        if (mySeq > lastOkSeq.current) lastOkSeq.current = mySeq;
        setState("saved");
        setMessage(null);
      } else {
        setState("error");
        if (!result.noRetry && retries.current < MAX_QUIET_RETRIES) {
          retries.current += 1;
          setMessage(result.message ?? null);
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => run(mySeq), 8000);
        } else {
          // No retry is coming; the badge must not promise one.
          setMessage(result.message ?? "Check your connection, then edit again to retry");
        }
      }
    });
  }, []);

  const touch = useCallback(() => {
    seq.current += 1;
    const mySeq = seq.current;
    retries.current = 0;
    setState("saving");
    setMessage(null);
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    timer.current = setTimeout(() => {
      // Null the handle so a fired debounce is distinguishable from a
      // pending one; flush() keys off the watermark, not this handle.
      timer.current = null;
      run(mySeq);
    }, delay);
  }, [delay, run]);

  // When the page hides or unloads, save the newest state if it is not
  // already confirmed saved: cancel the debounce and retry timers and queue
  // an immediate keepalive save. If a save is mid-flight the queued one runs
  // right after it (and skips itself if that save already confirmed this
  // state). A tab frozen or killed while a debounce-fired save is in flight
  // is the one accepted loss window: that request is not keepalive, but its
  // body is usually already transmitted, so the server tends to commit, and
  // self-conflict detection (revAwareSave) reconciles the rev when the tab
  // resumes. Do not "simplify" either of those away; they are what covers
  // this case.
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      if (seq.current === lastOkSeq.current) return;
      run(seq.current, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [run]);

  return { state, message, touch };
}

export function SaveBadge({ state, message }: { state: SaveState; message?: string | null }) {
  if (state === "idle") return null;
  const text =
    state === "saving"
      ? "Saving..."
      : state === "saved"
        ? "Saved"
        : state === "conflict"
          ? (message ?? "Updated from another device. Showing the latest.")
          : message
            ? `Not saved: ${message}`
            : "Not saved. We keep retrying; check your connection.";
  const tone =
    state === "saved" ? "text-sage-dark" : state === "saving" ? "text-ink/50" : "text-terracotta-dark";
  return (
    <span role="status" className={`max-w-56 text-right text-xs font-semibold ${tone}`}>
      {text}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-parchment bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl text-charcoal">{title}</h2>
        {badge}
      </div>
      <p className="mt-1 text-sm text-ink/60">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Two-tap destructive button, controlled by the parent: rows are index-keyed,
 * so the armed flag must live with the list and be cleared on ANY list
 * mutation, including a 409 refresh swapping in another device's rows. An
 * armed flag held inside the button would survive reindexing and delete
 * whichever row slid into this position. Auto-disarms after 3 seconds. Sized
 * to a 40px touch target for phone thumbs.
 */
export function RemoveButton({
  label,
  armed,
  onToggle,
  onRemove,
}: {
  label: string;
  armed: boolean;
  onToggle: (next: boolean) => void;
  onRemove: () => void;
}) {
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => toggleRef.current(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      aria-label={armed ? `Tap again to ${label.toLowerCase()}` : label}
      onClick={() => {
        if (armed) {
          toggleRef.current(false);
          onRemove();
        } else {
          toggleRef.current(true);
        }
      }}
      className={
        armed
          ? "min-h-10 rounded-lg bg-terracotta px-2.5 py-2 text-xs font-semibold text-cream"
          : "min-h-10 min-w-10 rounded-lg px-2.5 py-2 text-ink/50 hover:bg-parchment/60 hover:text-terracotta-dark"
      }
    >
      {armed ? "Sure?" : "✕"}
    </button>
  );
}

export type HubSaveOutcome = { ok: boolean; status: number; message?: string; body?: unknown };

// Browsers cap the in-flight keepalive body budget around 64KB of UTF-8
// BYTES (shared across concurrent keepalive fetches); an over-budget body
// makes fetch throw before dispatch. Deciding by measured byte size up front
// avoids a throw-then-refetch fallback, which could double-send a request
// that failed for an unrelated reason. Several sections flushing at once can
// still jointly exceed the shared budget; those requests fail cleanly to
// status 0 and the quiet retry recovers whenever the tab survives.
const KEEPALIVE_BODY_LIMIT = 60_000;

/**
 * PUT/PATCH JSON to a hub endpoint. Parses the response body so callers can
 * surface the server's error message and react to 409 revision conflicts.
 */
export async function hubSave(
  path: string,
  method: "PUT" | "PATCH",
  body: unknown,
  opts?: { keepalive?: boolean },
): Promise<HubSaveOutcome> {
  const payload = JSON.stringify(body);
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive:
        Boolean(opts?.keepalive) &&
        new TextEncoder().encode(payload).length < KEEPALIVE_BODY_LIMIT,
    });
    const parsed: unknown = await res.json().catch(() => null);
    const message =
      parsed !== null &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : undefined;
    return { ok: res.ok, status: res.status, message, body: parsed };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Save a rev-guarded section. Adds a per-request save id so the server can
 * echo, on a 409, whose commit currently holds the section. If that id is one
 * WE sent, this is our own earlier commit whose response was lost (mobile
 * networks do that): adopt the server's rev and report a plain retryable
 * failure so the quiet retry re-sends the newest rows, instead of treating it
 * as another device's edit and rolling local rows back to our own older
 * snapshot. Only an id we did not send is a real conflict, and only then does
 * `onConflict` replace local state with the server's rows.
 */
export async function revAwareSave(opts: {
  path: string;
  payload: Record<string, unknown>;
  rev: React.MutableRefObject<number>;
  sentSaveIds: React.MutableRefObject<string[]>;
  keepalive: boolean;
  onConflict: (body: unknown) => void;
}): Promise<SaveResult> {
  const saveId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  // Ids accumulate until a commit is CONFIRMED, then reset to just the
  // confirmed one. Evicting by recency instead would let an offline burst of
  // failed retries push out the one id whose commit landed but whose
  // response was lost, turning the later self-409 into a false cross-device
  // conflict that rolls back every edit. The cap is a runaway guard sized
  // far past any plausible unconfirmed streak.
  opts.sentSaveIds.current = [...opts.sentSaveIds.current.slice(-49), saveId];
  const out = await hubSave(
    opts.path,
    "PUT",
    { ...opts.payload, rev: opts.rev.current, saveId },
    { keepalive: opts.keepalive },
  );
  if (out.ok) {
    const body = out.body as { rev?: number } | null;
    if (typeof body?.rev === "number") opts.rev.current = body.rev;
    opts.sentSaveIds.current = [saveId];
    return { ok: true };
  }
  if (out.status === 409) {
    const body = out.body as { rev?: number; lastSaveId?: string } | null;
    if (typeof body?.rev === "number") opts.rev.current = body.rev;
    if (typeof body?.lastSaveId === "string" && opts.sentSaveIds.current.includes(body.lastSaveId)) {
      // Our own earlier commit landed but its response was lost. The rev is
      // adopted above; the quiet retry re-sends the newest rows under it.
      // (When nothing changed since, that re-send commits identical rows and
      // bumps the rev once more, which can cost another device one spurious
      // conflict refresh in the retry window: accepted, the conflict UX
      // recovers it.)
      return { ok: false, message: "still syncing, hang on" };
    }
    // A 409 body should carry the server's rows; if an intermediary produced
    // a bodyless or malformed 409, applying it would crash the section, so
    // treat it as a plain retryable failure instead.
    if (out.body === null || typeof out.body !== "object") {
      return { ok: false, message: out.message };
    }
    opts.onConflict(out.body);
    return { ok: false, conflict: true, message: out.message };
  }
  // 4xx responses are deterministic rejections of this exact payload; a
  // quiet retry would just re-send the same doomed request.
  return { ok: false, message: out.message, noRetry: out.status >= 400 && out.status < 500 };
}
