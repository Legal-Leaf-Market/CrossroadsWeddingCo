"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyLiveAction,
  computeLive,
  driftLabel,
  minutesToLabel,
  type LiveAction,
  type LiveBlock,
} from "@/lib/live";

const POLL_MS = 15_000;

/**
 * The Crossroads Live run sheet. One component, three modes: with
 * `controlPath` it is the MC's tap-to-run console; with `demo` the same
 * console simulated locally (the dev preview, no database); with neither,
 * the read-only vendor view. Polling every 15 seconds converges every phone
 * at the venue on the same state.
 */
export default function LiveRunSheet({
  initialBlocks,
  pollPath,
  controlPath,
  demo = false,
}: {
  initialBlocks: LiveBlock[];
  pollPath?: string;
  controlPath?: string;
  demo?: boolean;
}) {
  const [blocks, setBlocks] = useState<LiveBlock[]>(initialBlocks);
  const [offline, setOffline] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armedReset, setArmedReset] = useState(false);
  const busyRef = useRef(false);
  // Bumped by every action so a poll snapshot taken BEFORE the action can
  // never land after it and roll the console back to pre-tap state.
  const pollSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!pollPath || busyRef.current) return;
    const mySeq = pollSeq.current;
    try {
      const res = await fetch(pollPath, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { blocks?: LiveBlock[] };
      if (mySeq === pollSeq.current && !busyRef.current && Array.isArray(body.blocks)) {
        setBlocks(body.blocks);
        setOffline(false);
      }
    } catch {
      if (mySeq === pollSeq.current) setOffline(true);
    }
  }, [pollPath]);

  useEffect(() => {
    if (!pollPath) return;
    const timer = setInterval(refresh, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pollPath, refresh]);

  async function act(action: LiveAction, itemId: string) {
    if (demo && !controlPath) {
      setBlocks((b) => applyLiveAction(b, action, itemId, new Date().toISOString()));
      return;
    }
    if (!controlPath || busyRef.current) return;
    busyRef.current = true;
    pollSeq.current += 1;
    setBusy(true);
    try {
      const res = await fetch(controlPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId }),
      });
      if (res.ok) {
        const body = (await res.json()) as { blocks?: LiveBlock[] };
        if (Array.isArray(body.blocks)) setBlocks(body.blocks);
        setOffline(false);
        setFailure(null);
      } else {
        // A 4xx is not a connectivity problem: the tap was rejected.
        setFailure("That didn't save. Refresh this page; the timeline may have changed.");
      }
    } catch {
      setOffline(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const showControls = Boolean(controlPath) || demo;
  const view = computeLive(blocks);
  const lastId = blocks.length > 0 ? blocks[blocks.length - 1].id : null;
  // Resetting the first block clears it and everything after, so one call puts
  // the whole night back to the scheduled times. Two taps: wiping a run that is
  // actually under way would be the worst possible mis-tap at a wedding.
  const firstId = blocks.length > 0 ? blocks[0].id : null;
  const anyStarted = blocks.some((b) => b.actualStart !== null || b.isCompleted);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            view.allDone
              ? "bg-sage/30 text-charcoal"
              : view.driftMinutes !== null && view.driftMinutes > 2
                ? "bg-terracotta text-cream"
                : "bg-parchment text-charcoal"
          }`}
        >
          {view.allDone ? "That's a wrap" : driftLabel(view.driftMinutes)}
        </span>
        {showControls && anyStarted && firstId && (
          <span className="ml-auto">
            {armedReset ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setArmedReset(false);
                    void act("reset", firstId);
                  }}
                  className="min-h-9 rounded-full bg-terracotta-dark px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-50"
                >
                  Yes, reset everything
                </button>
                <button
                  type="button"
                  onClick={() => setArmedReset(false)}
                  className="min-h-9 px-2 py-1.5 text-sm font-semibold text-ink/60 hover:text-charcoal"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setArmedReset(true)}
                className="min-h-9 rounded-full border border-parchment px-4 py-1.5 text-sm font-semibold text-ink/60 hover:border-terracotta hover:text-terracotta"
              >
                Reset the night
              </button>
            )}
          </span>
        )}
        {offline && (
          <span className="text-xs font-semibold text-terracotta-dark" role="status">
            Reconnecting; times shown may be a moment old
          </span>
        )}
        {failure && (
          <span className="text-xs font-semibold text-terracotta-dark" role="status">
            {failure}
          </span>
        )}
      </div>

      {blocks.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          No timeline yet. Build the run of show in the planning hub and it appears here live.
        </p>
      ) : (
        <ol className="mt-5 space-y-2">
          {view.blocks.map((block) => (
            <li
              key={block.id}
              className={
                block.status === "now"
                  ? "rounded-xl border-2 border-terracotta bg-white p-4 shadow-sm"
                  : block.status === "done"
                    ? "rounded-xl border border-parchment bg-cream/60 p-4 opacity-60"
                    : "rounded-xl border border-parchment bg-white p-4"
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-20 shrink-0">
                  <span className="block text-base font-bold text-charcoal">
                    {minutesToLabel(block.projectedMinutes)}
                  </span>
                  {block.status === "upcoming" &&
                    !block.actualStart &&
                    view.driftMinutes !== null &&
                    Math.abs(view.driftMinutes) > 2 && (
                      <span className="block text-xs text-ink/40 line-through">
                        {minutesToLabel(block.projectedMinutes - (view.driftMinutes ?? 0))}
                      </span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-charcoal">
                    {block.status === "done" ? (
                      <s>{block.title || "Untitled block"}</s>
                    ) : (
                      block.title || "Untitled block"
                    )}
                  </p>
                  {block.mcNotes && <p className="text-sm text-ink/60">{block.mcNotes}</p>}
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-ink/40">
                  {block.durationMinutes} min
                </span>
                {showControls && (
                  <span className="flex w-full justify-end gap-2 sm:w-auto">
                    {block.status === "upcoming" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("start", block.id)}
                        className="min-h-11 rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-50"
                      >
                        Start now
                      </button>
                    )}
                    {block.status === "now" && (
                      <>
                        {block.id === lastId && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => act("complete", block.id)}
                            className="min-h-11 rounded-full bg-charcoal px-5 py-2 text-sm font-semibold text-cream disabled:opacity-50"
                          >
                            Wrap the night
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act("reset", block.id)}
                          className="min-h-11 rounded-full border border-parchment px-4 py-2 text-sm font-semibold text-ink/60 hover:text-charcoal disabled:opacity-50"
                        >
                          Undo
                        </button>
                      </>
                    )}
                    {block.status === "done" && (
                      // The recovery path for a fat-fingered Start or an
                      // accidental wrap: restarting reopens everything after.
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("start", block.id)}
                        className="min-h-11 rounded-full border border-parchment px-4 py-2 text-sm font-semibold text-ink/50 hover:text-charcoal disabled:opacity-50"
                      >
                        Restart
                      </button>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
