"use client";

import { useRef, useState } from "react";
import { TIME_RE } from "@/lib/hub-constants";
import {
  hubInput,
  RemoveButton,
  revAwareSave,
  SaveBadge,
  SectionCard,
  useAutosave,
  type SaveFn,
} from "./shared";

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
  initialRev,
}: {
  token: string;
  initial: TimelineRow[];
  initialRev: number;
}) {
  const [items, setItems] = useState<TimelineRow[]>(initial);
  const [armedRemove, setArmedRemove] = useState<number | null>(null);
  const rev = useRef(initialRev);
  const sentSaveIds = useRef<string[]>([]);

  const save: SaveFn = async ({ keepalive }) => {
    if (items.some((i) => !TIME_RE.test(i.startTime))) {
      return { ok: false, noRetry: true, message: "Finish the highlighted time so we can save" };
    }
    return revAwareSave({
      path: `/api/hub/${token}/timeline`,
      payload: { items },
      rev,
      sentSaveIds,
      keepalive,
      onConflict: (body) => {
        const b = body as { items: TimelineRow[] };
        setItems(b.items);
        // The rows just changed under any armed remove button; disarm so the
        // confirm tap cannot delete whichever row slid into that index.
        setArmedRemove(null);
      },
    });
  };
  const { state, message, touch } = useAutosave(save);

  function update(index: number, patch: Partial<TimelineRow>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    touch();
  }
  function move(index: number, delta: -1 | 1) {
    const j = index + delta;
    // A boundary tap changes nothing; saving it would only bump the rev.
    if (j < 0 || j >= items.length) return;
    setItems((rows) => {
      const next = [...rows];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setArmedRemove(null);
    touch();
  }
  function remove(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
    setArmedRemove(null);
    touch();
  }
  function add() {
    setItems((rows) => [
      ...rows,
      { title: "", category: "reception", startTime: "18:00", durationMinutes: 15, mcNotes: "" },
    ]);
    setArmedRemove(null);
    touch();
  }

  return (
    <SectionCard
      title="Run of show"
      subtitle="The day, block by block. We call these cues live; times are yours to shape and we fine-tune together on the intro call."
      badge={<SaveBadge state={state} message={message} />}
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
                aria-invalid={!TIME_RE.test(item.startTime) || undefined}
                className={`${hubInput} w-auto`}
                value={item.startTime}
                onChange={(e) => update(index, { startTime: e.target.value })}
              />
              <input
                aria-label="Block title"
                className={`${hubInput} min-w-40 flex-1`}
                value={item.title}
                maxLength={255}
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
                    update(index, {
                      durationMinutes: Math.min(600, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                />
                min
              </label>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => move(index, -1)}
                  className="min-h-10 min-w-10 rounded-lg px-2.5 py-2 text-ink/50 hover:bg-parchment/60 hover:text-charcoal"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => move(index, 1)}
                  className="min-h-10 min-w-10 rounded-lg px-2.5 py-2 text-ink/50 hover:bg-parchment/60 hover:text-charcoal"
                >
                  ↓
                </button>
                <span className="ml-2">
                  <RemoveButton
                    label="Remove block"
                    armed={armedRemove === index}
                    onToggle={(next) => setArmedRemove(next ? index : null)}
                    onRemove={() => remove(index)}
                  />
                </span>
              </div>
            </div>
            <input
              aria-label="Notes for the MC"
              className={`${hubInput} mt-2`}
              value={item.mcNotes}
              maxLength={2000}
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
