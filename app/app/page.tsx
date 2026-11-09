import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getWorkspace } from "@/lib/auth";
import { getWorkspaceSummary, type WorkspaceSummary } from "@/lib/workspace";
import { PLATFORM_NAME, businessTypeLabel } from "@/lib/tenant-constants";
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

export default async function WorkspacePage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  // The house account is run from /admin/[key]; it has no workspace here.
  if (ws.tenant.kind !== "customer") redirect("/login");

  let summary: WorkspaceSummary | null = null;
  try {
    summary = await getWorkspaceSummary(ws.tenant.id);
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
            : "Your free trial has ended."}
        </p>
      )}

      <section className="mt-10 rounded-2xl border border-parchment bg-white p-6">
        <h2 className="text-xl text-charcoal">Your bookings</h2>
        {!summary ? (
          <p className="mt-2 text-ink/70">We couldn&apos;t load your bookings just now. Refresh in a minute.</p>
        ) : summary.total === 0 ? (
          <p className="mt-2 text-ink/70">
            No bookings yet. Bookings, client planning hubs and the live day-of timeline are being switched on for
            new accounts next. We&apos;ll email you as each one is ready.
          </p>
        ) : (
          <>
            <p className="mt-2 text-ink/70">
              {summary.upcoming} upcoming of {summary.total} total.
            </p>
            <ul className="mt-4 divide-y divide-parchment">
              {summary.next.map((w) => (
                <li key={w.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <span className="font-semibold text-charcoal">{w.coupleNames}</span>
                  <span className="text-sm text-ink/60">
                    {dateLabel(w.eventDate)} · {w.venueName}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
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
