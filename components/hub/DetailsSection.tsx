"use client";

import { useRef, useState } from "react";
import { hubInput, hubSave, SaveBadge, SectionCard, useAutosave, type SaveFn } from "./shared";

type Details = {
  venueAddress: string;
  venueContactEmail: string;
  contactPhone: string;
  vibeNotes: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DetailsSection({
  token,
  initial,
  venueName,
}: {
  token: string;
  initial: Details;
  venueName: string;
}) {
  const [details, setDetails] = useState(initial);
  // Only fields the couple actually edited are sent, so a stale tab can
  // never overwrite a field it never touched.
  const dirty = useRef<Set<keyof Details>>(new Set());

  const emailInvalid =
    details.venueContactEmail.trim() !== "" && !EMAIL_RE.test(details.venueContactEmail.trim());

  const save: SaveFn = async ({ keepalive }) => {
    const payload: Partial<Details> = {};
    for (const key of dirty.current) {
      // Hold back a half-typed email; the field is marked and the rest saves.
      if (key === "venueContactEmail" && emailInvalid) continue;
      payload[key] = details[key];
    }
    if (Object.keys(payload).length === 0) {
      return emailInvalid
        ? { ok: false, message: "Finish the venue email so we can save it" }
        : { ok: true };
    }
    const out = await hubSave(`/api/hub/${token}/details`, "PATCH", payload, { keepalive });
    return out.ok ? { ok: true } : { ok: false, message: out.message };
  };
  const { state, message, touch } = useAutosave(save);

  function set<K extends keyof Details>(key: K, value: string) {
    setDetails((d) => ({ ...d, [key]: value }));
    dirty.current.add(key);
    touch();
  }

  return (
    <SectionCard
      title="The basics"
      subtitle={`Where we load in and who we call. Venue on file: ${venueName}.`}
      badge={<SaveBadge state={state} message={message} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Venue address</span>
          <input
            className={hubInput}
            value={details.venueAddress}
            maxLength={2000}
            onChange={(e) => set("venueAddress", e.target.value)}
            placeholder="Street address for load-in"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">
            Venue coordinator email (optional)
          </span>
          <input
            className={hubInput}
            type="email"
            aria-invalid={emailInvalid || undefined}
            value={details.venueContactEmail}
            maxLength={255}
            onChange={(e) => set("venueContactEmail", e.target.value)}
            placeholder="For load-in questions and the COI"
          />
          {emailInvalid && (
            <span className="mt-1 block text-xs text-terracotta-dark">
              We save this once it looks like a full email address
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Best phone for the day</span>
          <input
            className={hubInput}
            type="tel"
            value={details.contactPhone}
            maxLength={50}
            onChange={(e) => set("contactPhone", e.target.value)}
            placeholder="Who we text when we arrive"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-charcoal">The vibe</span>
          <textarea
            className={hubInput}
            rows={3}
            value={details.vibeNotes}
            maxLength={5000}
            onChange={(e) => set("vibeNotes", e.target.value)}
            placeholder="Genres you love, decades to lean on, energy you want in the room, anything else we should know"
          />
        </label>
      </div>
    </SectionCard>
  );
}
