"use client";

import { useState } from "react";
import { hubInput, hubSave, SaveBadge, SectionCard, useAutosave } from "./shared";

export type TimelineRow = {
  title: string;
  category: string;
  startTime: string;
  durationMinutes: number;
  mcNotes: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  pre_ceremony: "Pre-ceremony",
  ceremony: "Ceremony",
  cocktail: "Cocktail hour",
  reception: "Reception",
  dance: "Dance floor",
};

const STARTER: TimelineRow[] = [
  { title: "Guests arrive, prelude music", category: "pre_ceremony", startTime: "15:30", durationMinutes: 30, mcNotes: "" },
  { title: "Processional", category: "ceremony", startTime: "16:00", durationMinutes: 10, mcNotes: "" },
  { title: "Ceremony", category: "ceremony", startTime: "16:10", durationMinutes: 25, mcNotes: "" },
  { title: "Cocktail hour", category: "cocktail", startTime: "16:45", durationMinutes: 60, mcNotes: "" },
  { title: "Grand entrance", category: "reception", startTime: "17:45", durationMinutes: 10, mcNotes: "" },
  { title: "Dinner", category: "reception", startTime: "17:55", durationMinutes: 50, mcNotes: "" },
  { title: "Speeches", category: "reception", startTime: "18:45", durationMinutes: 20, mcNotes: "" },
  { title: "First dance", category: "dance", startTime: "19:05", durationMinutes: 5, mcNotes: "" },
  { title: "Open floor", category: "dance", startTime: "19:10", durationMinutes: 170, mcNotes: "" },
  { title: "Last song and send-off", category: "dance", startTime: "22:00", durationMinutes: 15, mcNotes: "" },
];

export default function TimelineSection({
  token,
  initial,
}: {
  token: string;
  initial: TimelineRow[];
}) {
  const [items, setItems] = useState<TimelineRow[]>(initial);
  const { state, touch } = useAutosave(() =>
    hubSave(`/api/hub/${token}/timeline`, "PUT", {
      items: items.filter((i) => i.title.trim().length > 0),
    }),
  );

  function update(index: number, patch: Partial<TimelineRow>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    touch();
  }
  function move(index: number, delta: -1 | 1) {
    setItems((rows) => {
      const next = [...rows];
      const j = index + delta;
      if (j < 0 || j >= next.length) return rows;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    touch();
  }
  function remove(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
    touch();
  }
  function add() {
    setItems((rows) => [
      ...rows,
      { title: "", category: "reception", startTime: "18:00", durationMinutes: 15, mcNotes: "" },
    ]);
  }

  return (
    <SectionCard
      title="Run of show"
      subtitle="The day, block by block. We call these cues live; times are yours to shape and we fine-tune together on the intro call."
      badge={<SaveBadge state={state} />}
    >
      {items.length === 0 && (
        <button
          type="button"
          onClick={() => {
            setItems(STARTER);
            touch();
          }}
          className="mb-4 rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
        >
          Start from a typical Saturday
        </button>
      )}
      <ol className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="rounded-xl border border-parchment bg-cream/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                aria-label="Start time"
                className={`${hubInput} w-auto`}
                value={item.startTime}
                onChange={(e) => update(index, { startTime: e.target.value })}
              />
              <input
                aria-label="Block title"
                className={`${hubInput} min-w-40 flex-1`}
                value={item.title}
                onChange={(e) => update(index, { title: e.target.value })}
                placeholder="What happens"
              />
              <select
                aria-label="Category"
                className={`${hubInput} w-auto`}
                value={item.category}
                onChange={(e) => update(index, { category: e.target.value })}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-sm text-ink/70">
                <input
                  type="number"
                  aria-label="Duration in minutes"
                  className={`${hubInput} w-20`}
                  min={1}
                  max={600}
                  value={item.durationMinutes}
                  onChange={(e) =>
                    update(index, { durationMinutes: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
                min
              </label>
              <div className="ml-auto flex gap-1">
                <button type="button" aria-label="Move up" onClick={() => move(index, -1)} className="rounded px-2 py-1 text-ink/50 hover:text-charcoal">↑</button>
                <button type="button" aria-label="Move down" onClick={() => move(index, 1)} className="rounded px-2 py-1 text-ink/50 hover:text-charcoal">↓</button>
                <button type="button" aria-label="Remove block" onClick={() => remove(index)} className="rounded px-2 py-1 text-ink/50 hover:text-terracotta-dark">✕</button>
              </div>
            </div>
            <input
              aria-label="Notes for the MC"
              className={`${hubInput} mt-2`}
              value={item.mcNotes}
              onChange={(e) => update(index, { mcNotes: e.target.value })}
              placeholder="Notes for the mic: who speaks, what to announce, what to avoid"
            />
          </li>
        ))}
      </ol>
      {items.length > 0 && items.length < 60 && (
        <button
          type="button"
          onClick={add}
          className="mt-4 rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
        >
          Add a block
        </button>
      )}
    </SectionCard>
  );
}
