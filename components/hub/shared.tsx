"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const hubInput =
  "w-full rounded-lg border border-parchment bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave: call `touch()` after every edit; `save` fires once the
 * edits pause. Returns the save state for the section's badge.
 */
export function useAutosave(save: () => Promise<boolean>, delay = 700) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const touch = useCallback(() => {
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const ok = await saveRef.current();
      setState(ok ? "saved" : "error");
    }, delay);
  }, [delay]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { state, touch };
}

export function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const text = state === "saving" ? "Saving..." : state === "saved" ? "Saved" : "Not saved, retrying on your next edit";
  const tone =
    state === "error" ? "text-terracotta-dark" : state === "saved" ? "text-sage-dark" : "text-ink/50";
  return (
    <span role="status" className={`text-xs font-semibold ${tone}`}>
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

/** PUT/PATCH JSON to a hub endpoint; true on success. */
export async function hubSave(path: string, method: "PUT" | "PATCH", body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
