"use client";

import { useState } from "react";

type Block = { weekday: number; start: string; end: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const inputClass =
  "rounded-lg border border-parchment bg-cream px-3 py-2 text-sm text-charcoal focus:border-terracotta focus:outline-none";

/**
 * One person's week. Replace-all: the whole week posts on save, because a week
 * of office hours is a handful of rows and a single PUT cannot leave it half
 * written the way a row-at-a-time editor can.
 */
export default function OfficeHoursEditor({
  adminKey,
  slug,
  name,
  initial,
}: {
  adminKey: string;
  slug: string;
  name: string;
  initial: Block[];
}) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  function edit(i: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, n) => (n === i ? { ...b, ...patch } : b)));
    setStatus("idle");
  }

  async function save() {
    const parsed: { weekday: number; startMinute: number; endMinute: number }[] = [];
    for (const b of blocks) {
      const s = toMinutes(b.start);
      const e = toMinutes(b.end);
      if (s === null || e === null) {
        setError("Every time needs to be a real time, like 18:00.");
        setStatus("error");
        return;
      }
      if (e <= s) {
        setError(`On ${DAYS[b.weekday]}, the end time has to come after the start.`);
        setStatus("error");
        return;
      }
      parsed.push({ weekday: b.weekday, startMinute: s, endMinute: e });
    }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/admin/${encodeURIComponent(adminKey)}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: slug, blocks: parsed }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "That didn't save.");
        setStatus("error");
        return;
      }
      setStatus("saved");
    } catch {
      setError("That didn't save.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-parchment bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg text-charcoal">{name}</h2>
        <p className="text-xs text-ink/50">
          {blocks.length === 0
            ? "No times open. Nobody can book a call."
            : `${blocks.length} block${blocks.length === 1 ? "" : "s"} a week`}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {blocks.map((b, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${slug}-day-${i}`}>
              Day
            </label>
            <select
              id={`${slug}-day-${i}`}
              value={b.weekday}
              onChange={(e) => edit(i, { weekday: Number(e.target.value) })}
              className={inputClass}
            >
              {DAYS.map((d, n) => (
                <option key={d} value={n}>
                  {d}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`${slug}-start-${i}`}>
              Start
            </label>
            <input
              id={`${slug}-start-${i}`}
              type="time"
              value={b.start}
              onChange={(e) => edit(i, { start: e.target.value })}
              className={inputClass}
            />
            <span className="text-sm text-ink/50">to</span>
            <label className="sr-only" htmlFor={`${slug}-end-${i}`}>
              End
            </label>
            <input
              id={`${slug}-end-${i}`}
              type="time"
              value={b.end}
              onChange={(e) => edit(i, { end: e.target.value })}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => {
                setBlocks((prev) => prev.filter((_, n) => n !== i));
                setStatus("idle");
              }}
              className="text-sm text-ink/50 underline decoration-parchment underline-offset-2 hover:text-terracotta"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setBlocks((prev) => [...prev, { weekday: 2, start: "18:00", end: "20:00" }]);
            setStatus("idle");
          }}
          className="rounded-full border border-parchment px-4 py-2 text-sm text-charcoal hover:border-terracotta"
        >
          Add a block
        </button>
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
        >
          {status === "saving" ? "Saving..." : "Save this week"}
        </button>
        {status === "saved" && <span className="text-sm text-sage">Saved.</span>}
        {status === "error" && (
          <span role="alert" className="text-sm text-terracotta">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
