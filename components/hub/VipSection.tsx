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
};

const COMMON_ROLES = [
  "Maid of Honor",
  "Best Man",
  "Bridesmaid",
  "Groomsman",
  "Parent",
  "Grandparent",
  "Officiant",
  "Flower Girl",
  "Ring Bearer",
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

  function update(index: number, patch: Partial<VipRow>) {
    setVips((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    touch();
  }

  return (
    <SectionCard
      title="Names we say out loud"
      subtitle="Wedding party and family we announce. Phonetic spellings save lives: write it how it sounds, like Siobhan (shi-VAWN)."
      badge={<SaveBadge state={state} message={message} />}
    >
      <ul className="space-y-3">
        {vips.map((vip, index) => (
          <li key={index} className="grid gap-2 sm:grid-cols-[11rem_1fr_1fr_auto] sm:items-center">
            <input
              aria-label="Role"
              className={hubInput}
              value={vip.role}
              maxLength={100}
              onChange={(e) => update(index, { role: e.target.value })}
              placeholder="Role"
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
            setVips((rows) => [...rows, { role: "", fullName: "", phoneticSpelling: "", entranceSongOverride: "" }]);
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
