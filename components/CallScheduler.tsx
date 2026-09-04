"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { VENUE_TIME_ZONE } from "@/lib/site";

type DaySlots = { ymd: string; slots: string[] };
type Status = "loading" | "ready" | "empty" | "booking" | "booked" | "error";

const inputClass =
  "w-full rounded-lg border border-cream/20 bg-cream/5 px-4 py-2.5 text-cream placeholder:text-cream/40 focus:border-terracotta focus:outline-none";

// EVERY TIME ON THIS SCREEN IS THE VENUE'S WALL CLOCK, and it says so on the
// screen rather than only in this comment. The server hands down instants and
// nothing here ever calls toLocaleTimeString without a timeZone, because a
// couple booking from a phone still on Pacific would otherwise be shown 3:00,
// write 3:00 on a sticky note, and miss a call Indiana placed at 6:00.
function slotLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function dayLabel(ymd: string): string {
  // Noon avoids the midnight edge entirely: parsed as UTC and read back in the
  // venue zone, a date at 00:00 can land on the day before.
  const at = new Date(`${ymd}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(at);
}

function zoneLabel(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TIME_ZONE,
    timeZoneName: "short",
  }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "local time";
}

export default function CallScheduler({
  slug,
  name,
  title,
  minutes,
}: {
  slug: string;
  name: string;
  title: string;
  minutes: number;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [days, setDays] = useState<DaySlots[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const doneRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/call?with=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { days: DaySlots[] };
      setDays(json.days);
      setOpenDay(json.days[0]?.ymd ?? null);
      setStatus(json.days.length ? "ready" : "empty");
    } catch {
      setStatus("error");
      setError("We couldn't load the calendar just now.");
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status === "booked") doneRef.current?.focus();
  }, [status]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chosen) return;
    const form = new FormData(e.currentTarget);
    setStatus("booking");
    setError("");
    try {
      const res = await fetch("/api/bookings/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          with: slug,
          startsAt: chosen,
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          eventDate: String(form.get("eventDate") ?? ""),
          notes: String(form.get("notes") ?? ""),
        }),
      });
      const json = (await res.json()) as { error?: string; retry?: boolean };
      if (!res.ok) {
        setError(json.error ?? "That didn't go through.");
        setStatus("ready");
        // A lost race is the one failure with a next step: the calendar it came
        // from is stale by definition, so refetch it rather than leaving the
        // visitor to tap the same dead slot again.
        if (json.retry) {
          setChosen(null);
          await load();
        }
        return;
      }
      setStatus("booked");
    } catch {
      setError("That didn't go through. Try again in a moment.");
      setStatus("ready");
    }
  }

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-cream/20 bg-cream/5 p-6">
        <p className="text-cream/70">Loading {name}&apos;s calendar...</p>
      </div>
    );
  }

  // FAILS CLOSED, like every other externally-gated thing on this site. Nobody
  // is offered a time that nobody agreed to: with no office hours set, this
  // says so plainly and hands the visitor back to the form below, which always
  // works.
  if (status === "empty" || status === "error") {
    return (
      <div className="rounded-2xl border border-cream/20 bg-cream/5 p-6">
        <p className="text-lg text-cream">
          {status === "error"
            ? "We couldn't load the calendar just now."
            : `${name} hasn't opened any call times yet.`}
        </p>
        <p className="mt-2 text-sm text-cream/70">
          Fill in the form below and we&apos;ll come to you, usually the same day.
        </p>
      </div>
    );
  }

  if (status === "booked") {
    return (
      <div role="status" className="rounded-2xl border border-sage/60 bg-sage/10 p-6">
        <h2 ref={doneRef} tabIndex={-1} className="text-xl text-cream outline-none">
          You&apos;re booked with {name}.
        </h2>
        <p className="mt-2 text-cream/70">
          {chosen ? `${dayLabel(chosen.slice(0, 10))} at ${slotLabel(chosen)} ${zoneLabel()}. ` : ""}
          A confirmation is on its way to your inbox. If you need to move it, just reply to that
          email.
        </p>
      </div>
    );
  }

  const day = days.find((d) => d.ymd === openDay) ?? days[0];

  return (
    <div className="rounded-2xl border border-cream/20 bg-cream/5 p-6">
      <h2 className="text-2xl text-cream">Book a call with {name}</h2>
      <p className="mt-1 text-sm text-cream/70">
        {title}. {minutes} minutes, on the phone, no charge. All times {zoneLabel()}.
      </p>

      <div className="mt-6">
        <p id="pick-a-day" className="text-xs uppercase tracking-widest text-cream/50">
          Pick a day
        </p>
        <div
          role="group"
          aria-labelledby="pick-a-day"
          className="mt-3 flex flex-wrap gap-2"
        >
          {days.map((d) => (
            <button
              key={d.ymd}
              type="button"
              aria-pressed={d.ymd === day?.ymd}
              onClick={() => {
                setOpenDay(d.ymd);
                setChosen(null);
              }}
              className={
                "rounded-full px-4 py-2 text-sm " +
                (d.ymd === day?.ymd
                  ? "bg-terracotta text-cream"
                  : "border border-cream/20 text-cream/80 hover:border-cream/40")
              }
            >
              {dayLabel(d.ymd)}
            </button>
          ))}
        </div>
      </div>

      {day && (
        <div className="mt-6">
          <p id="pick-a-time" className="text-xs uppercase tracking-widest text-cream/50">
            Pick a time
          </p>
          <div role="group" aria-labelledby="pick-a-time" className="mt-3 flex flex-wrap gap-2">
            {day.slots.map((iso) => (
              <button
                key={iso}
                type="button"
                aria-pressed={iso === chosen}
                onClick={() => setChosen(iso)}
                className={
                  "rounded-full px-4 py-2 text-sm " +
                  (iso === chosen
                    ? "bg-terracotta text-cream"
                    : "border border-cream/20 text-cream/80 hover:border-cream/40")
                }
              >
                {slotLabel(iso)}
              </button>
            ))}
          </div>
        </div>
      )}

      {chosen && (
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <p className="text-sm text-cream/80">
            {dayLabel(chosen.slice(0, 10))} at {slotLabel(chosen)} {zoneLabel()}. Who are we
            calling?
          </p>
          <label className="block">
            <span className="text-sm text-cream/70">Your name</span>
            <input name="name" required maxLength={120} className={`mt-1 ${inputClass}`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-cream/70">Email</span>
              <input
                name="email"
                type="email"
                required
                maxLength={255}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block">
              <span className="text-sm text-cream/70">Phone</span>
              <input name="phone" type="tel" maxLength={50} className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <label className="block">
            <span className="text-sm text-cream/70">Your wedding date, if you have one</span>
            <input name="eventDate" type="date" className={`mt-1 ${inputClass}`} />
          </label>
          <label className="block">
            <span className="text-sm text-cream/70">Anything we should know first?</span>
            <textarea name="notes" rows={3} maxLength={2000} className={`mt-1 ${inputClass}`} />
          </label>
          {error && (
            <p role="alert" className="text-sm text-terracotta">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={status === "booking"}
            className="justify-self-start rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
          >
            {status === "booking" ? "Locking it in..." : "Book this time"}
          </button>
        </form>
      )}

      {!chosen && error && (
        <p role="alert" className="mt-4 text-sm text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
