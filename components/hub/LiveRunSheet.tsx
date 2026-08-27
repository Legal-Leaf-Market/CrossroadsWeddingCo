"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeLive, driftLabel, minutesToLabel, type LiveBlock } from "@/lib/live";

const POLL_MS = 15_000;

/**
 * The Crossroads Live run sheet. One component, two modes: with `controlPath`
 * it is the MC's tap-to-run console (start blocks, wrap the night, undo);
 * without it, the read-only vendor view. Both poll every 15 seconds so every
 * phone at the venue converges on the same state.
 */
export default function LiveRunSheet({
  initialBlocks,
  pollPath,
  controlPath,
}: {
  initialBlocks: LiveBlock[];
  pollPath: string;
  controlPath?: string;
}) {
  const [blocks, setBlocks] = useState<LiveBlock[]>(initialBlocks);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    // Never clobber state with a poll response racing an action.
    if (busyRef.current) return;
    try {
      const res = await fetch(pollPath, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { blocks?: LiveBlock[] };
      if (!busyRef.current && Array.isArray(body.blocks)) {
        setBlocks(body.blocks);
        setOffline(false);
      }
    } catch {
      setOffline(true);
    }
  }, [pollPath]);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  async function act(action: "start" | "complete" | "reset", itemId: string) {
    if (!controlPath || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch(controlPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId }),
      });
      if (res.ok) {
        const body = (await res.json()) as { blocks?: LiveBlock[] };
        if (Array.isArray(body.blocks)) {
          setBlocks(body.blocks);
          setOffline(false);
        }
      } else {
        setOffline(true);
      }
    } catch {
      setOffline(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const view = computeLive(blocks);
  const lastId = blocks.length > 0 ? blocks[blocks.length - 1].id : null;

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
        {offline && (
          <span className="text-xs font-semibold text-terracotta-dark" role="status">
            Reconnecting; times shown may be a moment old
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
                  {!block.actualStart &&
                    view.driftMinutes !== null &&
                    Math.abs(view.driftMinutes) > 2 && (
                      <span className="block text-xs text-ink/40 line-through">
                        {minutesToLabel(
                          block.projectedMinutes - (view.driftMinutes ?? 0),
                        )}
                      </span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-charcoal">
                    {block.status === "done" ? <s>{block.title || "Untitled block"}</s> : (block.title || "Untitled block")}
                  </p>
                  {block.mcNotes && <p className="text-sm text-ink/60">{block.mcNotes}</p>}
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-ink/40">
                  {block.durationMinutes} min
                </span>
                {controlPath && (
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
