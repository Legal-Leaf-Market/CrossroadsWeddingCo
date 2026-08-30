"use client";

import { useRef, useState } from "react";
import { hubInput, hubSave, SaveBadge, SectionCard, useAutosave, type SaveFn } from "./shared";

type Details = {
  contactEmail: string;
  venueAddress: string;
  venueContactEmail: string;
  contactPhone: string;
  vibeNotes: string;
  weddingSiteUrl: string;
  dressCode: string;
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
  // Only fields the couple actually edited (and not yet saved) are sent, so a
  // long-lived tab can never resurrect an hours-old value over a field the
  // other phone updated in the meantime.
  const dirty = useRef<Set<keyof Details>>(new Set());

  const emailInvalid =
    details.venueContactEmail.trim() !== "" && !EMAIL_RE.test(details.venueContactEmail.trim());
  const ownEmailInvalid =
    details.contactEmail.trim() !== "" && !EMAIL_RE.test(details.contactEmail.trim());

  const heldNames = () =>
    [
      ownEmailInvalid && dirty.current.has("contactEmail") ? "your email" : null,
      emailInvalid && dirty.current.has("venueContactEmail") ? "the venue email" : null,
    ].filter((n): n is string => n !== null);

  const save: SaveFn = async ({ keepalive }) => {
    // Hold back a half-typed email; the field is marked and the rest saves.
    const keys = [...dirty.current].filter(
      (k) =>
        !(k === "venueContactEmail" && emailInvalid) && !(k === "contactEmail" && ownEmailInvalid),
    );
    const held = heldNames();
    if (keys.length === 0) {
      return held.length > 0
        ? { ok: false, noRetry: true, message: `Finish ${held.join(" and ")} so we can save` }
        : { ok: true };
    }
    const payload: Partial<Details> = {};
    // Trimmed to match the server's validation, which rejects an email with
    // stray whitespace and would otherwise block the whole PATCH.
    for (const k of keys) payload[k] = details[k].trim();
    // Clear before sending: an edit that lands mid-flight re-marks its field,
    // so it is included again in the next save instead of being lost.
    for (const k of keys) dirty.current.delete(k);
    const out = await hubSave(`/api/hub/${token}/details`, "PATCH", payload, { keepalive });
    if (!out.ok) {
      for (const k of keys) dirty.current.add(k);
      return { ok: false, message: out.message, noRetry: out.status >= 400 && out.status < 500 };
    }
    // Reads under the badge's "Not saved: " prefix, so the message names
    // what is not saved rather than contradicting the prefix.
    return held.length > 0
      ? {
          ok: false,
          noRetry: true,
          message: `${held.join(" and ")} ${held.length > 1 ? "are" : "is"} incomplete; everything else is saved`,
        }
      : { ok: true };
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
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Your email</span>
          <input
            className={hubInput}
            type="email"
            aria-invalid={ownEmailInvalid || undefined}
            value={details.contactEmail}
            maxLength={255}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder="Where booking updates land"
          />
          {ownEmailInvalid && (
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
          <span className="mb-1 block text-sm font-semibold text-charcoal">Venue address</span>
          <input
            className={hubInput}
            value={details.venueAddress}
            maxLength={2000}
            onChange={(e) => set("venueAddress", e.target.value)}
            placeholder="Street address for load-in"
          />
        </label>
        <label className="block sm:col-span-2">
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
          <span className="mb-1 block text-sm font-semibold text-charcoal">
            Your wedding website (optional)
          </span>
          <input
            className={hubInput}
            value={details.weddingSiteUrl}
            maxLength={500}
            onChange={(e) => set("weddingSiteUrl", e.target.value)}
            placeholder="zola.com/wedding/yournames"
          />
          <span className="mt-1 block text-xs text-ink/45">
            We link your guests back to it from your order of events.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">
            Dress code (optional)
          </span>
          <input
            className={hubInput}
            value={details.dressCode}
            maxLength={200}
            onChange={(e) => set("dressCode", e.target.value)}
            placeholder="However you told your guests to dress"
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
