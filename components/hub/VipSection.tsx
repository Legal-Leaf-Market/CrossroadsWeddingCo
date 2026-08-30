"use client";

import { useRef, useState } from "react";
import {
  hubInput,
  RemoveButton,
  revAwareSave,
  SaveBadge,
  SectionCard,
  useAutosave,
  type SaveFn,
} from "./shared";

export type VipRow = {
  role: string;
  fullName: string;
  phoneticSpelling: string;
  entranceSongOverride: string;
  /** Pronouns, relationship, anything the MC should know before saying it. */
  notes: string;
};

// Suggestions only. The field is free text: these are the couple's people and
// they get to name the roles, including ones no list would guess. Both the
// gendered forms couples actually print on their cards and neutral
// alternatives are here, because plenty of wedding parties are neither.
const COMMON_ROLES = [
  "Officiant",
  "Father of the Bride",
  "Mother of the Bride",
  "Father of the Groom",
  "Mother of the Groom",
  "Parent of the Bride",
  "Parent of the Groom",
  "Stepfather",
  "Stepmother",
  "Stepparent",
  "Grandfather",
  "Grandmother",
  "Grandparent",
  "Maid of Honor",
  "Matron of Honor",
  "Man of Honor",
  "Best Man",
  "Best Woman",
  "Honor Attendant",
  "Bridesmaid",
  "Bridesman",
  "Groomsman",
  "Groomswoman",
  "Wedding Party",
  "Flower Girl",
  "Flower Kid",
  "Ring Bearer",
  "Usher",
  "Reader",
];

export default function VipSection({
  token,
  initial,
  initialRev,
}: {
  token: string;
  initial: VipRow[];
  initialRev: number;
}) {
  const [vips, setVips] = useState<VipRow[]>(initial);
  const [armedRemove, setArmedRemove] = useState<number | null>(null);
  const rev = useRef(initialRev);
  const sentSaveIds = useRef<string[]>([]);

  // Every visible row is sent as-is; the server accepts partial rows so
  // nothing the couple can see is silently dropped from a save.
  const save: SaveFn = ({ keepalive }) =>
    revAwareSave({
      path: `/api/hub/${token}/vips`,
      payload: { vips },
      rev,
      sentSaveIds,
      keepalive,
      onConflict: (body) => {
        const b = body as { vips?: VipRow[] };
        if (!Array.isArray(b.vips)) return;
        setVips(b.vips);
        // Disarm: the rows just changed under any armed remove button.
        setArmedRemove(null);
      },
    });
  const { state, message, touch } = useAutosave(save);

  // Order is meaningful here: this is the sequence the MC reads at the grand
  // entrance, so the couple has to be able to set it.
  function move(index: number, delta: number) {
    const target = index + delta;
    setVips((rows) => {
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setArmedRemove(null);
    touch();
  }

  function update(index: number, patch: Partial<VipRow>) {
    setVips((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    touch();
  }

  return (
    <SectionCard
      title="Names we say out loud"
      subtitle="Wedding party and family we announce, in the order we announce them. Pick a role from the list or type your own, whatever you'd actually print on your card. Phonetic spellings save lives: write it how it sounds, like Siobhan (shi-VAWN)."
      badge={<SaveBadge state={state} message={message} />}
    >
      <ul className="space-y-3">
        {vips.map((vip, index) => (
          <li key={index} className="rounded-xl border border-parchment p-3">
            <div className="grid gap-2 sm:grid-cols-[11rem_1fr_1fr] sm:items-center">
              <input
                aria-label="Role"
                className={hubInput}
                value={vip.role}
                maxLength={100}
                onChange={(e) => update(index, { role: e.target.value })}
                placeholder="Role, or type your own"
                list="vip-roles"
              />
              <input
                aria-label="Full name"
                className={hubInput}
                value={vip.fullName}
                maxLength={255}
                onChange={(e) => update(index, { fullName: e.target.value })}
                placeholder="Full name"
              />
              <input
                aria-label="How it sounds"
                className={hubInput}
                value={vip.phoneticSpelling}
                maxLength={255}
                onChange={(e) => update(index, { phoneticSpelling: e.target.value })}
                placeholder="How it sounds"
              />
            </div>
            <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <input
                aria-label="Anything we should know"
                className={hubInput}
                value={vip.notes}
                maxLength={500}
                onChange={(e) => update(index, { notes: e.target.value })}
                placeholder="Anything we should know: pronouns, how they're related, how to introduce them"
              />
              <span className="flex items-center justify-end gap-1 sm:gap-2">
              <button
                type="button"
                aria-label="Move up"
                onClick={() => move(index, -1)}
                className="min-h-10 min-w-10 shrink-0 rounded-lg px-2.5 py-2 text-ink/50 hover:bg-parchment/60 hover:text-charcoal"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => move(index, 1)}
                className="min-h-10 min-w-10 shrink-0 rounded-lg px-2.5 py-2 text-ink/50 hover:bg-parchment/60 hover:text-charcoal"
              >
                ↓
              </button>
              <RemoveButton
                label="Remove person"
                armed={armedRemove === index}
                onToggle={(next) => setArmedRemove(next ? index : null)}
                onRemove={() => {
                  setVips((rows) => rows.filter((_, i) => i !== index));
                  setArmedRemove(null);
                  touch();
                }}
              />
              </span>
            </div>
          </li>
        ))}
      </ul>
      <datalist id="vip-roles">
        {COMMON_ROLES.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>
      {vips.length < 40 && (
        <button
          type="button"
          onClick={() => {
            setVips((rows) => [
              ...rows,
              { role: "", fullName: "", phoneticSpelling: "", entranceSongOverride: "", notes: "" },
            ]);
            setArmedRemove(null);
            touch();
          }}
          className="mt-4 rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
        >
          Add a person
        </button>
      )}
    </SectionCard>
  );
}
