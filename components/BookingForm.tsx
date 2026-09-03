"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ACOUSTIC_ADDON_USD,
  BARTENDER_MIN_USD,
  CONTACT_EMAIL,
  DEPOSIT_USD,
  DJ_DAY_RATE_USD,
} from "@/lib/site";

type Status = "idle" | "submitting" | "success" | "error";

const inputClass =
  "w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-2.5 text-cream placeholder:text-cream/40 focus:border-terracotta focus:outline-none";

export default function BookingForm({
  initialServices = ["dj"],
}: {
  /** Preselected services; the /acoustic and /bartending pages deep-link a-la-carte. */
  initialServices?: string[];
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [reference, setReference] = useState("");
  const [hubPath, setHubPath] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>(initialServices);
  const [noPlaylist, setNoPlaylist] = useState(false);
  // Extra people the couple wants in their hub. Starts as one empty row so the
  // field is visible and self-explanatory; the plus button adds more.
  const [inviteEmails, setInviteEmails] = useState<string[]>([""]);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  // Screen readers lose their place when the form unmounts, so land focus on
  // the confirmation heading so the outcome is announced.
  useEffect(() => {
    if (status === "success") successHeadingRef.current?.focus();
  }, [status]);

  const hasDj = services.includes("dj");
  const hasAcoustic = services.includes("acoustic");
  const hasBartender = services.includes("bartender");
  // The bar minimum is owed before any quote happens, so it belongs in the
  // total; the label marks the total as "before bar quote" (owner directive
  // 2026-08-27). A-la-carte bookings (owner directive 2026-08-28) simply
  // leave the DJ line out.
  const totalUsd =
    (hasDj ? DJ_DAY_RATE_USD : 0) +
    (hasAcoustic ? ACOUSTIC_ADDON_USD : 0) +
    (hasBartender ? BARTENDER_MIN_USD : 0);

  function toggleService(service: string) {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((a) => a !== service) : [...prev, service],
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerOneFirst: data.get("partnerOneFirst"),
          partnerOneLast: data.get("partnerOneLast"),
          partnerTwoFirst: data.get("partnerTwoFirst"),
          partnerTwoLast: data.get("partnerTwoLast"),
          hubInviteEmails: inviteEmails.map((e) => e.trim()).filter(Boolean),
          email: data.get("email"),
          phone: data.get("phone"),
          eventDate: data.get("eventDate"),
          venueName: data.get("venueName"),
          venueAddress: data.get("venueAddress"),
          services,
          // A disabled input is absent from FormData; send an explicit empty
          // string so the API's string schema never sees null.
          spotifyPlaylistUrl: noPlaylist ? "" : (data.get("spotifyPlaylistUrl") ?? ""),
          notes: data.get("notes"),
          website: data.get("website"),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setReference(json.reference ?? "");
      setHubPath(json.hubPath ?? null);
      setStatus("success");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="rounded-2xl border border-cream/20 bg-cream/5 p-8">
        <h3 ref={successHeadingRef} tabIndex={-1} className="text-xl text-cream focus:outline-none">
          Date request received
        </h3>
        <p className="mt-3 text-cream/70">
          Here&apos;s what happens next:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-cream/70">
          <li>We check the calendar and confirm availability by email within 24 hours.</li>
          <li>
            {hasDj
              ? `A $${DEPOSIT_USD} deposit locks your date. Payment details come with the confirmation.`
              : "A deposit locks your date. We'll sort the amount and payment details with the confirmation."}
          </li>
          <li>
            {hubPath ? (
              <>
                Your planning hub is ready right now: timeline, music, and the names we
                announce. <strong className="text-cream">Fill out now.</strong>
              </>
            ) : (
              "Then we gather the names, the schedule, and the music with you by email and on your intro call."
            )}
          </li>
        </ol>
        {hubPath && (
          <a
            href={hubPath}
            className="mt-5 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Open your planning hub
          </a>
        )}
        {reference && (
          <p className="mt-4 text-sm text-cream/50">Your reference: {reference}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl text-left">
      {/* Honeypot: invisible to people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Your first name</span>
          <input name="partnerOneFirst" required maxLength={120} className={inputClass} placeholder="Jane" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Your last name</span>
          <input name="partnerOneLast" required maxLength={120} className={inputClass} placeholder="Kennedy" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Partner&apos;s first name</span>
          <input name="partnerTwoFirst" required maxLength={120} className={inputClass} placeholder="Sam" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Partner&apos;s last name</span>
          <input name="partnerTwoLast" required maxLength={120} className={inputClass} placeholder="Carter" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Email</span>
          <input name="email" type="email" required className={inputClass} placeholder="you@example.com" />
        </label>

        {/* Invites live beside the couple's own email because that is where
            someone thinks "my planner should see this too". Each row is its own
            input rather than a comma-separated string: type="email" then
            validates each address in the browser, one at a time. */}
        <div className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">
            Invite someone to the hub (optional)
          </span>
          <div className="space-y-2">
            {inviteEmails.map((value, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="email"
                  value={value}
                  maxLength={255}
                  onChange={(e) =>
                    setInviteEmails((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                  }
                  className={inputClass}
                  placeholder="planner@example.com"
                  aria-label={`Invite email ${i + 1}`}
                />
                {inviteEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setInviteEmails((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-lg border border-cream/20 px-3 text-cream/60 hover:text-cream"
                    aria-label={`Remove invite email ${i + 1}`}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
          {inviteEmails.length < 10 && (
            <button
              type="button"
              onClick={() => setInviteEmails((prev) => [...prev, ""])}
              className="mt-2 rounded-full border border-cream/25 px-4 py-1.5 text-sm font-medium text-cream/80 hover:border-terracotta hover:text-cream"
            >
              + Add another
            </button>
          )}
          <span className="mt-1 block text-xs text-cream/50">
            Anyone you add can see and edit your planning hub, so add people you trust with your
            details.
          </span>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Phone (optional)</span>
          <input name="phone" type="tel" className={inputClass} placeholder="(812) 555-0100" />
          <span className="mt-1 block text-xs text-cream/50">
            We text booking updates to this number, never marketing. Reply STOP any time.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Wedding date</span>
          <input name="eventDate" type="date" required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Venue</span>
          <input
            name="venueName"
            required
            minLength={2}
            className={inputClass}
            placeholder='A venue, or "backyard in Seymour"'
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Venue address (optional)</span>
          <input name="venueAddress" className={inputClass} placeholder="If you have it handy" />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 block text-sm font-semibold text-cream/80">
          What are you booking?
        </legend>
        <p className="mb-3 text-xs text-cream/50">
          Pick any combination. Already have a DJ? The acoustic set and bar service book
          entirely on their own.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label
            className={`cursor-pointer rounded-lg border p-4 ${hasDj ? "border-terracotta bg-terracotta/10" : "border-cream/20 bg-cream/5"}`}
          >
            <input
              type="checkbox"
              checked={hasDj}
              onChange={() => toggleService("dj")}
              className="mr-2 accent-terracotta"
            />
            <span className="font-semibold text-cream">DJ &amp; MC, the whole day</span>
            <span className="mt-1 block text-sm text-cream/60">
              Ceremony through last dance: sound, MC, and the day-of timeline. Flat $
              {DJ_DAY_RATE_USD.toLocaleString("en-US")}.
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-lg border p-4 ${hasAcoustic ? "border-terracotta bg-terracotta/10" : "border-cream/20 bg-cream/5"}`}
          >
            <input
              type="checkbox"
              checked={hasAcoustic}
              onChange={() => toggleService("acoustic")}
              className="mr-2 accent-terracotta"
            />
            <span className="font-semibold text-cream">Live solo acoustic set</span>
            <span className="mt-1 block text-sm text-cream/60">
              One performer, ceremony or cocktail hour, up to three requests learned with
              notice. Flat ${ACOUSTIC_ADDON_USD}.
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-lg border p-4 ${hasBartender ? "border-terracotta bg-terracotta/10" : "border-cream/20 bg-cream/5"}`}
          >
            <input
              type="checkbox"
              checked={hasBartender}
              onChange={() => toggleService("bartender")}
              className="mr-2 accent-terracotta"
            />
            <span className="font-semibold text-cream">Bar service</span>
            <span className="mt-1 block text-sm text-cream/60">
              Licensed bartenders. ${BARTENDER_MIN_USD} minimum; the real number depends on
              your bar and gets quoted on your intro call.
            </span>
          </label>
        </div>
        {services.length === 0 && (
          <p className="mt-3 text-sm text-terracotta">
            Pick at least one so we know what to check the calendar for.
          </p>
        )}
      </fieldset>

      <div className="mt-6">
        <span className="mb-1 flex items-center justify-between gap-3">
          <label htmlFor="spotifyPlaylistUrl" className="text-sm font-semibold text-cream/80">
            Spotify playlist (optional)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-cream/60">
            <input
              type="checkbox"
              checked={noPlaylist}
              onChange={(e) => setNoPlaylist(e.target.checked)}
              className="accent-terracotta"
            />
            Don&apos;t have one yet
          </label>
        </span>
        <input
          id="spotifyPlaylistUrl"
          name="spotifyPlaylistUrl"
          disabled={noPlaylist}
          className={`${inputClass} ${noPlaylist ? "cursor-not-allowed opacity-40" : ""}`}
          placeholder="Paste a share link from your own Spotify"
        />
        <span className="mt-1 block text-xs text-cream/50">
          {noPlaylist
            ? "No problem. Your planning hub has an Add a playlist button waiting whenever you make one."
            : "Already collecting must-plays? Share the playlist and it follows your booking all the way to the DJ booth."}
        </span>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold text-cream/80">Anything else</span>
        <textarea
          name="notes"
          rows={3}
          className={inputClass}
          placeholder="Vibe, must-plays, must-nots, questions..."
        />
      </label>

      <div className="mt-6 rounded-lg border border-cream/20 bg-cream/5 px-4 py-3 text-sm text-cream/80">
        {hasDj && (
          <div className="flex items-center justify-between">
            <span>DJ &amp; MC day rate</span>
            <span>${DJ_DAY_RATE_USD.toLocaleString("en-US")}</span>
          </div>
        )}
        {hasAcoustic && (
          <div className="mt-1 flex items-center justify-between">
            <span>Live solo acoustic set</span>
            <span>${ACOUSTIC_ADDON_USD}</span>
          </div>
        )}
        {hasBartender && (
          <div className="mt-1 flex items-center justify-between">
            <span>Bar service (fully quoted on your call)</span>
            <span>from ${BARTENDER_MIN_USD}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-cream/20 pt-2 font-semibold text-cream">
          <span>Total{hasBartender ? " (before bar quote)" : ""}</span>
          <span>${totalUsd.toLocaleString("en-US")}</span>
        </div>
        <p className="mt-2 text-xs text-cream/50">
          {hasDj
            ? `$${DEPOSIT_USD} deposit locks the date once we confirm availability. It's non-refundable and comes off your total. No payment now.`
            : "No payment now. We confirm availability first, and deposit details come with your confirmation."}
        </p>
      </div>

      {status === "error" && (
        <p role="alert" className="mt-4 rounded-lg border border-terracotta/60 bg-terracotta/10 px-4 py-2.5 text-sm text-cream">
          {errorMessage}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
            Or just email us.
          </a>
        </p>
      )}

      <button
        type="submit"
        aria-busy={status === "submitting"}
        disabled={status === "submitting" || services.length === 0}
        className="mt-6 w-full rounded-full bg-terracotta px-6 py-3.5 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {status === "submitting" ? "Sending..." : "Request this date"}
      </button>
    </form>
  );
}
