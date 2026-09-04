import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CancelCallButton from "@/components/admin/CancelCallButton";
import OfficeHoursEditor from "@/components/admin/OfficeHoursEditor";
import { adminKeyMatches } from "@/lib/admin";
import { getOfficeHours, getUpcomingAppointments } from "@/lib/booking-server";
import { SCHEDULERS } from "@/lib/schedulers";
import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";

// The other end of the QR code on the business cards. Until somebody opens
// times here, /book?with=<slug> says so plainly rather than inventing any.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Call times",
  robots: { index: false, follow: false },
};

function whenLabel(at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

export default async function HoursPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();

  const [hours, upcoming] = await Promise.all([
    Promise.all(SCHEDULERS.map(async (s) => [s.slug, await getOfficeHours(s.slug)] as const)),
    getUpcomingAppointments(),
  ]);
  const bySlug = new Map(hours);
  const nameOf = new Map(SCHEDULERS.map((s) => [s.slug, s.name]));

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Call times</h1>
          <p className="text-sm text-ink/60">
            When each of you is free for a 30 minute intro call. These are the times the QR code
            on your business card offers, in Indiana time. Leave someone empty and their card
            sends people to the date form instead.
          </p>
          <a
            href={`/admin/${key}`}
            className="mt-2 inline-block text-sm font-medium text-terracotta underline decoration-parchment underline-offset-2"
          >
            Back to bookings
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <div className="space-y-4">
          {SCHEDULERS.map((s) => (
            <OfficeHoursEditor
              key={s.slug}
              adminKey={key}
              slug={s.slug}
              name={`${s.name} (/book?with=${s.slug})`}
              initial={(bySlug.get(s.slug) ?? []).map((h) => ({
                weekday: h.weekday,
                start: h.start,
                end: h.end,
              }))}
            />
          ))}
        </div>

        <section>
          <h2 className="text-lg text-charcoal">Calls booked</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">
              Nothing booked yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {upcoming.map((a) => (
                <div key={a.id} className="rounded-2xl border border-parchment bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-charcoal">
                        {whenLabel(a.startsAt)} &middot; {nameOf.get(a.personSlug) ?? a.personSlug}
                      </p>
                      <p className="text-sm text-ink/70">
                        {a.name} &middot; {a.email}
                        {a.phone ? ` · ${a.phone}` : ""}
                      </p>
                      {a.eventDate && <p className="text-sm text-ink/50">Their date: {a.eventDate}</p>}
                      {a.notes && <p className="mt-2 text-sm text-ink/70">{a.notes}</p>}
                    </div>
                    <CancelCallButton adminKey={key} appointmentId={a.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
