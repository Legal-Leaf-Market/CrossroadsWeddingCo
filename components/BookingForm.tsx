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

export default function BookingForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [reference, setReference] = useState("");
  const [hubPath, setHubPath] = useState<string | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  // Screen readers lose their place when the form unmounts, so land focus on
  // the confirmation heading so the outcome is announced.
  useEffect(() => {
    if (status === "success") successHeadingRef.current?.focus();
  }, [status]);

  const hasAcoustic = addons.includes("acoustic");
  const totalUsd = DJ_DAY_RATE_USD + (hasAcoustic ? ACOUSTIC_ADDON_USD : 0);

  function toggleAddon(addon: string) {
    setAddons((prev) =>
      prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon],
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
          coupleNames: data.get("coupleNames"),
          email: data.get("email"),
          phone: data.get("phone"),
          eventDate: data.get("eventDate"),
          venueName: data.get("venueName"),
          venueAddress: data.get("venueAddress"),
          addons,
          spotifyPlaylistUrl: data.get("spotifyPlaylistUrl"),
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
            A ${DEPOSIT_USD} deposit locks your date. Payment details come with the
            confirmation.
          </li>
          <li>
            {hubPath
              ? "Your planning hub is ready right now: timeline, music, and the names we announce, saving as you type."
              : "Then we gather the names, the schedule, and the music with you by email and on your intro call."}
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
          <span className="mb-1 block text-sm font-semibold text-cream/80">Your names</span>
          <input name="coupleNames" required minLength={2} className={inputClass} placeholder="Jane & Sam" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Email</span>
          <input name="email" type="email" required className={inputClass} placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-cream/80">Phone (optional)</span>
          <input name="phone" type="tel" className={inputClass} placeholder="(812) 555-0100" />
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
        <legend className="mb-2 block text-sm font-semibold text-cream/80">Add-ons</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-lg border p-4 ${hasAcoustic ? "border-terracotta bg-terracotta/10" : "border-cream/20 bg-cream/5"}`}
          >
            <input
              type="checkbox"
              checked={hasAcoustic}
              onChange={() => toggleAddon("acoustic")}
              className="mr-2 accent-terracotta"
            />
            <span className="font-semibold text-cream">Live solo acoustic set</span>
            <span className="mt-1 block text-sm text-cream/60">
              One performer, ceremony or cocktail hour, up to three requests learned with
              notice. Flat ${ACOUSTIC_ADDON_USD}.
            </span>
          </label>
          <label
            className={`cursor-pointer rounded-lg border p-4 ${addons.includes("bartender") ? "border-terracotta bg-terracotta/10" : "border-cream/20 bg-cream/5"}`}
          >
            <input
              type="checkbox"
              checked={addons.includes("bartender")}
              onChange={() => toggleAddon("bartender")}
              className="mr-2 accent-terracotta"
            />
            <span className="font-semibold text-cream">Bar service</span>
            <span className="mt-1 block text-sm text-cream/60">
              Licensed bartenders. ${BARTENDER_MIN_USD} minimum; the real number depends on
              your bar and gets quoted on your intro call.
            </span>
          </label>
        </div>
      </fieldset>

      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-semibold text-cream/80">
          Spotify playlist (optional)
        </span>
        <input
          name="spotifyPlaylistUrl"
          className={inputClass}
          placeholder="Paste a share link from your own Spotify"
        />
        <span className="mt-1 block text-xs text-cream/50">
          Already collecting must-plays? Share the playlist and it follows your booking all the
          way to the DJ booth.
        </span>
      </label>

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
        <div className="flex items-center justify-between">
          <span>DJ &amp; MC day rate</span>
          <span>${DJ_DAY_RATE_USD.toLocaleString("en-US")}</span>
        </div>
        {hasAcoustic && (
          <div className="mt-1 flex items-center justify-between">
            <span>Live solo acoustic set</span>
            <span>${ACOUSTIC_ADDON_USD}</span>
          </div>
        )}
        {addons.includes("bartender") && (
          <div className="mt-1 flex items-center justify-between text-cream/60">
            <span>Bar service (quoted on your call)</span>
            <span>from ${BARTENDER_MIN_USD}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t border-cream/20 pt-2 font-semibold text-cream">
          <span>Total{addons.includes("bartender") ? " (before bar quote)" : ""}</span>
          <span>${totalUsd.toLocaleString("en-US")}</span>
        </div>
        <p className="mt-2 text-xs text-cream/50">
          ${DEPOSIT_USD} deposit locks the date once we confirm availability. It&apos;s
          non-refundable and comes off your total. No payment now.
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
        disabled={status === "submitting"}
        className="mt-6 w-full rounded-full bg-terracotta px-6 py-3.5 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {status === "submitting" ? "Sending..." : "Request this date"}
      </button>
    </form>
  );
}
