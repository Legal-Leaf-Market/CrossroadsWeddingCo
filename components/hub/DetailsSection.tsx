"use client";

import { useState } from "react";
import { hubInput, hubSave, SaveBadge, SectionCard, useAutosave } from "./shared";

type Details = {
  venueAddress: string;
  venueContactEmail: string;
  contactPhone: string;
  vibeNotes: string;
};

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
  const { state, touch } = useAutosave(() =>
    hubSave(`/api/hub/${token}/details`, "PATCH", details),
  );

  function set<K extends keyof Details>(key: K, value: string) {
    setDetails((d) => ({ ...d, [key]: value }));
    touch();
  }

  return (
    <SectionCard
      title="The basics"
      subtitle={`Where we load in and who we call. Venue on file: ${venueName}.`}
      badge={<SaveBadge state={state} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Venue address</span>
          <input
            className={hubInput}
            value={details.venueAddress}
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
            value={details.venueContactEmail}
            onChange={(e) => set("venueContactEmail", e.target.value)}
            placeholder="For load-in questions and the COI"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-charcoal">Best phone for the day</span>
          <input
            className={hubInput}
            type="tel"
            value={details.contactPhone}
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
            onChange={(e) => set("vibeNotes", e.target.value)}
            placeholder="Genres you love, decades to lean on, energy you want in the room, anything else we should know"
          />
        </label>
      </div>
    </SectionCard>
  );
}
