"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const hubInput =
  "w-full rounded-lg border border-parchment bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none aria-invalid:border-terracotta-dark";

export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export type SaveResult = { ok: true } | { ok: false; message?: string; conflict?: boolean };

/** Section save callback. `keepalive` is true when flushing on page hide. */
export type SaveFn = (opts: { keepalive: boolean }) => Promise<SaveResult>;

const MAX_QUIET_RETRIES = 3;

/**
 * Debounced autosave: call `touch()` after every edit; `save` fires once the
 * edits pause. Guarantees: saves never overlap (promise chain), a stale
 * response never wins the badge (sequence counter), pending edits are flushed
 * on pagehide/visibility-hidden, and a failed save quietly retries a few
 * times. The badge only says Saved when the latest edit is actually saved.
 */
export function useAutosave(save: SaveFn, delay = 700) {
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const seq = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);

  const run = useCallback((mySeq: number, keepalive = false) => {
    chain.current = chain.current.then(async () => {
      // A newer edit scheduled its own save; let that one carry the data.
      if (seq.current !== mySeq) return;
      let result: SaveResult;
      try {
        result = await saveRef.current({ keepalive });
      } catch {
        result = { ok: false };
      }
      // Edited while the request was in flight: stay on "saving".
      if (seq.current !== mySeq) return;
      if (result.ok) {
        retries.current = 0;
        setState("saved");
        setMessage(null);
      } else if (result.conflict) {
        retries.current = 0;
        setState("conflict");
        setMessage(result.message ?? "Updated from another device. Showing the latest.");
      } else {
        setState("error");
        setMessage(result.message ?? null);
        if (retries.current < MAX_QUIET_RETRIES) {
          retries.current += 1;
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => run(mySeq), 8000);
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
    timer.current = setTimeout(() => run(mySeq), delay);
  }, [delay, run]);

  // Flush the pending debounce when the page hides or unloads, so the last
  // keystrokes before a tab switch or navigation still reach the server.
  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        run(seq.current, true);
      }
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
 * Two-tap destructive button: first tap arms it ("Sure?"), second tap within
 * 3 seconds removes. Sized to a 40px touch target for phone thumbs.
 */
export function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (disarm.current) clearTimeout(disarm.current);
  }, []);
  return (
    <button
      type="button"
      aria-label={armed ? `Tap again to ${label.toLowerCase()}` : label}
      onClick={() => {
        if (armed) {
          if (disarm.current) clearTimeout(disarm.current);
          setArmed(false);
          onRemove();
        } else {
          setArmed(true);
          disarm.current = setTimeout(() => setArmed(false), 3000);
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

/**
 * PUT/PATCH JSON to a hub endpoint. Parses the response body so callers can
 * surface the server's error message and react to 409 revision conflicts.
 * `keepalive` keeps a flush-on-unload request alive past navigation; some
 * browsers cap keepalive bodies at 64KB, so it falls back to a plain fetch.
 */
export async function hubSave(
  path: string,
  method: "PUT" | "PATCH",
  body: unknown,
  opts?: { keepalive?: boolean },
): Promise<HubSaveOutcome> {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  try {
    let res: Response;
    if (opts?.keepalive) {
      try {
        res = await fetch(path, { ...init, keepalive: true });
      } catch {
        res = await fetch(path, init);
      }
    } else {
      res = await fetch(path, init);
    }
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
