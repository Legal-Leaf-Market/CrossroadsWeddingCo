import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getWorkspace } from "@/lib/auth";
import { listBookings, type BookingListItem } from "@/lib/workspace";
import Link from "next/link";
import { PLATFORM_NAME, bookingStatusLabel, businessTypeLabel, eventTypeLabel } from "@/lib/tenant-constants";
import { VENUE_TIME_ZONE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Your workspace | ${PLATFORM_NAME}`,
  robots: { index: false, follow: false },
};

function daysLeft(end: Date | null): number | null {
  if (!end) return null;
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function dateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function BookingList({ title, items }: { title: string; items: BookingListItem[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-ink/55">{title}</h3>
      <ul className="mt-2 divide-y divide-parchment">
        {items.map((w) => (
          <li key={w.id}>
            <Link href={`/app/bookings/${w.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 hover:bg-cream/50">
              <span className="min-w-0 break-words font-semibold text-charcoal">{w.clientNames}</span>
              <span className="text-sm text-ink/60">
                {dateLabel(w.eventDate)} · {eventTypeLabel(w.eventType)} · {bookingStatusLabel(w.status)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const showArchived = (await searchParams).archived === "1";
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  // The house account's bookings are run from /admin/[key]; only its books live here.
  if (ws.tenant.kind !== "customer") redirect("/app/books");

  let lists: { upcoming: BookingListItem[]; past: BookingListItem[] } | null = null;
  try {
    lists = await listBookings(ws.tenant.id, { archived: showArchived });
  } catch (err) {
    console.error("[app] summary failed:", err);
  }
  const left = daysLeft(ws.tenant.trialEndsAt);
  const first = ws.user.fullName.trim().split(/\s+/)[0];

  return (
    <AccountShell signedIn>
      <p className="text-sm font-semibold uppercase tracking-widest text-terracotta-dark">{ws.tenant.name}</p>
      <h1 className="mt-2 text-3xl text-charcoal sm:text-4xl">Welcome, {first}.</h1>
      {ws.tenant.plan === "trial" && left !== null && (
        <p className="mt-3 text-ink/70">
          {left > 0
            ? `${left} ${left === 1 ? "day" : "days"} left in your free trial.`
            : "Your free trial has ended."}{" "}
          <Link href="/app/billing" className="font-semibold text-terracotta-dark underline underline-offset-2">
            {left > 0 ? "Set up billing" : "Start your plan"}
          </Link>
        </p>
      )}

      <section className="mt-10 rounded-2xl border border-parchment bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl text-charcoal">Your bookings</h2>
          <Link
            href="/app/bookings/new"
            className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Add a booking
          </Link>
        </div>
        {!lists ? (
          <p className="mt-3 text-ink/70">We couldn&apos;t load your bookings just now. Refresh in a minute.</p>
        ) : lists.upcoming.length + lists.past.length === 0 ? (
          <p className="mt-3 text-ink/70">
            No bookings yet. Add one and its client planning hub, run sheet and live timeline are ready right away.
          </p>
        ) : (
          <>
            <BookingList title={`Upcoming (${lists.upcoming.length})`} items={lists.upcoming} />
            {lists.past.length > 0 && <BookingList title={`Past and cancelled (${lists.past.length})`} items={lists.past} />}
          </>
        )}
        <p className="mt-4 text-sm">
          <Link href={showArchived ? "/app" : "/app?archived=1"} className="text-ink/55 underline decoration-parchment underline-offset-2 hover:text-terracotta-dark">
            {showArchived ? "Showing archived bookings. Back to the active list" : "See archived bookings"}
          </Link>
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
        <h2 className="text-xl text-charcoal">Account</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/55">Business</dt>
            <dd className="font-semibold text-charcoal">{ws.tenant.name}</dd>
          </div>
          <div>
            <dt className="text-ink/55">Type</dt>
            <dd className="font-semibold text-charcoal">{businessTypeLabel(ws.tenant.businessType)}</dd>
          </div>
          <div>
            <dt className="text-ink/55">Owner</dt>
            <dd className="font-semibold text-charcoal">{ws.user.fullName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-ink/55">Email</dt>
            <dd className="break-words font-semibold text-charcoal">{ws.user.email}</dd>
          </div>
          <div>
            <dt className="text-ink/55">Member since</dt>
            <dd className="font-semibold text-charcoal">
              {ws.tenant.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: VENUE_TIME_ZONE })}
            </dd>
          </div>
        </dl>
      </section>
    </AccountShell>
  );
}
