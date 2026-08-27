"use client";

import { useEffect, useState } from "react";
import { daysOut, formatEventDate } from "@/lib/hub-constants";
import { minutesToLabel, hhmmToMinutes, venueWallClockToEpoch } from "@/lib/live";

/**
 * The hub's countdown hero. Days are the anchor; when the couple's timeline
 * has a first block, its start time turns the countdown live, down to the
 * minute. The ticking line renders only after mount (the server can't know
 * the viewer's "now"), so SSR and hydration always agree.
 */
export default function CountdownHero({
  eventDate,
  startTime,
}: {
  eventDate: string;
  /** HH:MM venue wall clock of the first timeline block, null until one exists. */
  startTime: string | null;
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const days = daysOut(eventDate);
  const big =
    days > 0 ? String(days) : days === 0 ? "Today" : "Married!";
  const bigLabel = days > 1 ? "days to go" : days === 1 ? "day to go" : "";

  let tick: string | null = null;
  if (startTime && nowMs !== null && days >= 0) {
    const target = venueWallClockToEpoch(eventDate, startTime);
    const minutesLeft = Math.floor((target - nowMs) / 60_000);
    if (minutesLeft > 0) {
      const d = Math.floor(minutesLeft / 1440);
      const h = Math.floor((minutesLeft % 1440) / 60);
      const m = minutesLeft % 60;
      const parts = [
        ...(d > 0 ? [`${d} ${d === 1 ? "day" : "days"}`] : []),
        ...(h > 0 ? [`${h} ${h === 1 ? "hour" : "hours"}`] : []),
        `${m} ${m === 1 ? "minute" : "minutes"}`,
      ];
      tick = parts.join(", ");
    }
  }

  return (
    <section
      aria-label="Countdown to your wedding"
      className="rounded-3xl bg-gradient-to-br from-terracotta to-terracotta-dark px-8 py-10 text-center text-cream shadow-xl"
    >
      <p
        className="text-7xl font-semibold leading-none tracking-tight sm:text-8xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {big}
      </p>
      {bigLabel && (
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-cream/80">
          {bigLabel}
        </p>
      )}
      <p className="mt-4 text-base text-cream/90">
        {formatEventDate(eventDate)}
        {startTime ? ` · kicks off at ${minutesToLabel(hhmmToMinutes(startTime))}` : ""}
      </p>
      {tick && (
        <p className="mt-2 text-sm text-cream/70" role="timer">
          {tick} from right now
        </p>
      )}
      {days < 0 && (
        <p className="mt-2 text-sm text-cream/70">Congratulations, you two.</p>
      )}
    </section>
  );
}
