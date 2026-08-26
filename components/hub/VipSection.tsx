"use client";

import { useRef, useState } from "react";
import {
  hubInput,
  hubSave,
  RemoveButton,
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
  const rev = useRef(initialRev);

  // Every visible row is sent as-is; the server accepts partial rows so
  // nothing the couple can see is silently dropped from a save.
  const save: SaveFn = async ({ keepalive }) => {
    const out = await hubSave(
      `/api/hub/${token}/vips`,
      "PUT",
      { rev: rev.current, vips },
      { keepalive },
    );
    if (out.ok) {
      const body = out.body as { rev?: number } | null;
      if (typeof body?.rev === "number") rev.current = body.rev;
      return { ok: true };
    }
    if (out.status === 409) {
      const body = out.body as { rev: number; vips: VipRow[] };
      rev.current = body.rev;
      setVips(body.vips);
      return { ok: false, conflict: true, message: out.message };
    }
    return { ok: false, message: out.message };
  };
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
              onRemove={() => {
                setVips((rows) => rows.filter((_, i) => i !== index));
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
          onClick={() =>
            setVips((rows) => [...rows, { role: "", fullName: "", phoneticSpelling: "", entranceSongOverride: "" }])
          }
          className="mt-4 rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
        >
          Add a person
        </button>
      )}
    </SectionCard>
  );
}
