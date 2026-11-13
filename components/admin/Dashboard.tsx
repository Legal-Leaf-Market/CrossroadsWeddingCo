import ArchiveButton from "@/components/admin/ArchiveButton";
import BookingEditor from "@/components/admin/BookingEditor";
import type { AdminCall, AdminData, AdminWedding } from "@/lib/admin";
import CommandCenter from "@/components/admin/CommandCenter";
import CorporateBookingForm from "@/components/admin/CorporateBookingForm";
import PlatformPanel from "@/components/admin/PlatformPanel";
import type { PlatformStats } from "@/lib/platform-stats";
import { findScheduler } from "@/lib/schedulers";
import { daysOut, formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME, VENUE_TIME_ZONE, WEDDINGS_PER_YEAR_CAP } from "@/lib/site";
import { buildInsights } from "@/lib/admin-insights";
import { leadSourceLabel, sourceForTag } from "@/lib/lead-sources";

// Presentational owner dashboard, rendered by /admin/[key] with live data and
// by /admin/preview (dev only) with samples so layout QA needs no database.

const ADDON_LABELS: Record<string, string> = {
  acoustic_set: "Acoustic set",
  bar_service: "Bar service",
};

const STATUS_STYLES: Record<string, string> = {
  inquiry: "bg-gold/15 text-ink",
  deposit_paid: "bg-terracotta/15 text-terracotta",
  talent_assigned: "bg-terracotta/15 text-terracotta",
  planning_locked: "bg-charcoal/10 text-charcoal",
  in_progress: "bg-terracotta text-cream",
  completed: "bg-charcoal/10 text-ink/60",
  cancelled: "bg-charcoal/10 text-ink/40",
};

function money(amount: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : amount;
}

function statusChip(status: string) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-charcoal/10 text-ink"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function WeddingCard({
  wedding,
  upcoming,
  basePath,
}: {
  wedding: AdminWedding;
  upcoming: boolean;
  basePath: string;
}) {
  // basePath is "/admin/<key>"; the API wants the key on its own.
  const adminKey = basePath.split("/").pop() ?? "";
  const d = daysOut(wedding.eventDate);
  return (
    <div className="rounded-2xl border border-parchment bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg text-charcoal">{wedding.coupleNames}</h3>
          <p className="text-sm text-ink/70">
            {formatEventDate(wedding.eventDate)}
            {upcoming && d >= 0 && (
              <span className="ml-2 font-semibold text-terracotta">
                {d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} out`}
              </span>
            )}
          </p>
          <p className="text-sm text-ink/70">{wedding.venueName}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {wedding.packageType === "corporate" && (
            <span className="rounded-full bg-charcoal px-2.5 py-0.5 text-xs font-semibold text-cream">corporate</span>
          )}
          {statusChip(wedding.status)}
          <p className="text-sm font-semibold text-charcoal">{money(wedding.totalAmount)}</p>
          <ArchiveButton
            adminKey={adminKey}
            weddingId={wedding.id}
            archived={wedding.archivedAt !== null}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink/70">
        {wedding.contactEmail && (
          <a href={`mailto:${wedding.contactEmail}`} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
            {wedding.contactEmail}
          </a>
        )}
        {wedding.contactPhone && (
          <a href={`tel:${wedding.contactPhone}`} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
            {wedding.contactPhone}
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={wedding.isDepositPaid ? "rounded-full bg-terracotta/15 px-2 py-0.5 font-semibold text-terracotta" : "rounded-full bg-charcoal/5 px-2 py-0.5 text-ink/50"}>
          {wedding.officiant ? "DJ deposit" : "deposit"} {wedding.isDepositPaid ? "received" : "due"}
        </span>
        {wedding.officiant && (
          <span className={wedding.officiant.depositPaidAt ? "rounded-full bg-terracotta/15 px-2 py-0.5 font-semibold text-terracotta" : "rounded-full bg-charcoal/5 px-2 py-0.5 text-ink/50"}>
            officiant deposit {wedding.officiant.depositPaidAt ? "received" : "due"}
          </span>
        )}
        {wedding.addons.map((a) => (
          <span key={a.type} className="rounded-full bg-charcoal/5 px-2 py-0.5 text-ink/70">
            {ADDON_LABELS[a.type] ?? a.type}
            {a.fee != null ? ` $${a.fee}` : a.minFee != null ? ` from $${a.minFee}` : ""}
          </span>
        ))}
        {wedding.packageType !== "corporate" && (
        <span
          className={
            wedding.contractAcceptedAt
              ? "rounded-full bg-sage/25 px-2 py-0.5 font-semibold text-ink"
              : "rounded-full bg-gold/20 px-2 py-0.5 font-semibold text-ink"
          }
        >
          {wedding.officiant ? "DJ agreement" : "agreement"}{" "}
          {agreementState(wedding.contractAcceptedAt, wedding.contractCountersignedAt)}
        </span>
        )}
        {wedding.officiant && (
          <span
            className={
              wedding.officiant.acceptedAt && wedding.officiant.countersignedAt
                ? "rounded-full bg-sage/25 px-2 py-0.5 font-semibold text-ink"
                : "rounded-full bg-gold/20 px-2 py-0.5 font-semibold text-ink"
            }
          >
            officiant agreement {agreementState(wedding.officiant.acceptedAt, wedding.officiant.countersignedAt)}
          </span>
        )}
        {wedding.checkinsSent.length > 0 && (
          <span className="rounded-full bg-charcoal/5 px-2 py-0.5 text-ink/50">
            check-ins: {wedding.checkinsSent.join(", ")}d
          </span>
        )}
      </div>

      {wedding.customTerms && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gold/10 px-3 py-2 text-sm text-ink/80">
          <span className="font-semibold text-charcoal">Custom arrangement: </span>
          {wedding.customTerms}
        </p>
      )}
      {wedding.notes && <p className="mt-3 text-sm text-ink/60">{wedding.notes}</p>}
      {(wedding.leadSource || wedding.leadSrcTag) && (
        <p className="mt-2 text-xs text-ink/50">
          Found us via:{" "}
          {leadSourceLabel(wedding.leadSource) ?? "not answered"}
          {wedding.leadSourceDetail && ` (${wedding.leadSourceDetail})`}
          {wedding.leadSrcTag && ` \u00b7 link tag: ${wedding.leadSrcTag}`}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a
          href={`${basePath}/messages/${wedding.id}`}
          className="rounded-full bg-charcoal px-4 py-1.5 font-semibold text-cream hover:bg-ink"
        >
          Messages
          {wedding.unreadMessages > 0 && (
            <span className="ml-2 rounded-full bg-terracotta px-2 py-0.5 text-xs font-bold text-cream">
              {wedding.unreadMessages}
            </span>
          )}
        </a>
        <a href={`/hub/${wedding.accessToken}`} className="rounded-full bg-terracotta px-4 py-1.5 font-semibold text-cream hover:bg-terracotta-dark">
          Hub
        </a>
        <a href={`/hub/${wedding.accessToken}/runsheet`} className="rounded-full border border-terracotta px-4 py-1.5 font-semibold text-terracotta hover:bg-terracotta hover:text-cream">
          Run sheet
        </a>
        <a href={`/hub/${wedding.accessToken}/live`} className="rounded-full border border-terracotta px-4 py-1.5 font-semibold text-terracotta hover:bg-terracotta hover:text-cream">
          Live
        </a>
        {wedding.shareToken && (
          <>
            <a href={`/live/${wedding.shareToken}`} className="rounded-full border border-parchment px-4 py-1.5 font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta">
              Vendor view
            </a>
            <a href={`/schedule/${wedding.shareToken}`} className="rounded-full border border-parchment px-4 py-1.5 font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta">
              Guest schedule
            </a>
          </>
        )}
        {basePath !== "/admin/preview" && (
          <a
            href={`${basePath}/costing/${wedding.id}`}
            className="rounded-full border border-terracotta px-4 py-1.5 font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
          >
            Costing
          </a>
        )}
        {basePath !== "/admin/preview" && (
          <a
            href={`${basePath}/invoice/${wedding.id}`}
            className="rounded-full border border-terracotta px-4 py-1.5 font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
          >
            Invoice
          </a>
        )}
        {/* The agreement is written for weddings; a corporate event has no contract page yet. */}
        {basePath !== "/admin/preview" && wedding.packageType !== "corporate" && (
          <a
            href={`${basePath}/contract/${wedding.id}`}
            className="rounded-full border border-terracotta px-4 py-1.5 font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
          >
            DJ agreement
          </a>
        )}
        {basePath !== "/admin/preview" && wedding.packageType !== "corporate" && (
          <a
            href={`${basePath}/officiant/${wedding.id}`}
            className="rounded-full border border-parchment px-4 py-1.5 font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta"
          >
            Officiant agreement
          </a>
        )}
        <BookingEditor
          wedding={wedding}
          basePath={basePath}
          demo={basePath === "/admin/preview"}
        />
      </div>
    </div>
  );
}

// One row per channel: what couples said, falling back to what the link said.
// This is the number that decides which replacement for WeddingPro keeps its
// budget, so it counts every booking that is not archived, past ones included.
function SourceTally({ weddings }: { weddings: AdminWedding[] }) {
  const counts = new Map<string, { total: number; booked: number }>();
  for (const w of weddings) {
    const key =
      leadSourceLabel(w.leadSource) ??
      leadSourceLabel(sourceForTag(w.leadSrcTag)) ??
      "Not answered";
    const row = counts.get(key) ?? { total: 0, booked: 0 };
    row.total += 1;
    if (w.isDepositPaid) row.booked += 1;
    counts.set(key, row);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1].total - a[1].total);
  if (rows.length === 0) return null;
  return (
    <section id="sources" className="scroll-mt-24">
      <h2 className="mb-3 text-lg font-semibold text-charcoal">Where couples found us</h2>
      <div className="rounded-2xl border border-parchment bg-white p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/50">
              <th className="pb-2 font-medium">Channel</th>
              <th className="pb-2 text-right font-medium">Requests</th>
              <th className="pb-2 text-right font-medium">Deposit paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, r]) => (
              <tr key={label} className="border-t border-parchment">
                <td className="py-1.5 text-charcoal">{label}</td>
                <td className="py-1.5 text-right">{r.total}</td>
                <td className="py-1.5 text-right">{r.booked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink/50">
          Bookings made before November 2026 never got the question, so they show as not answered.
        </p>
      </div>
    </section>
  );
}

// Readiness for the coming year's weddings (2026-11-11, Jacob: "fully
// converted over for the 6 next year weddings"). One row per upcoming wedding,
// one column per thing that has to be true before the day, read straight from
// the booking. A missing email matters most: without one, /my-wedding cannot
// send the couple their hub link.
function Readiness({ weddings }: { weddings: AdminWedding[] }) {
  const rows = weddings.filter((w) => w.packageType !== "corporate" && w.status !== "cancelled");
  if (rows.length === 0) return null;
  const mark = (ok: boolean) => (
    <span className={ok ? "font-semibold text-charcoal" : "font-semibold text-terracotta-dark"}>{ok ? "Yes" : "No"}</span>
  );
  const ready = rows.filter((w) => w.contactEmail && w.contractAcceptedAt && w.contractCountersignedAt && w.isDepositPaid).length;
  return (
    <section id="ready" className="scroll-mt-24">
      <h2 className="mb-1 text-lg font-semibold text-charcoal">Ready for the day?</h2>
      <p className="mb-3 text-sm text-ink/60">
        {ready} of {rows.length} upcoming weddings have everything. Email on file is what lets a couple get their hub link
        themselves at /my-wedding; add it from their hub&apos;s Details if it&apos;s missing.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-parchment bg-white p-4">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-ink/50">
              <th className="pb-2 font-medium">Wedding</th>
              <th className="pb-2 font-medium">Email on file</th>
              <th className="pb-2 font-medium">They signed</th>
              <th className="pb-2 font-medium">We signed</th>
              <th className="pb-2 font-medium">Deposit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-parchment">
                <td className="py-1.5 pr-3">
                  <span className="font-semibold text-charcoal">{w.coupleNames}</span>
                  <span className="block text-xs text-ink/55">{formatEventDate(w.eventDate)}</span>
                </td>
                <td className="py-1.5">{mark(Boolean(w.contactEmail))}</td>
                <td className="py-1.5">{mark(Boolean(w.contractAcceptedAt))}</td>
                <td className="py-1.5">{mark(Boolean(w.contractCountersignedAt))}</td>
                <td className="py-1.5">{mark(w.isDepositPaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Intro calls booked from /book?with=<slug>. Corporate inquiries and venue
// referrals come in here rather than as weddings rows, so this is where a
// "?src=venue" link shows whether it worked.
function CallList({ calls }: { calls: AdminCall[] }) {
  return (
    <section id="calls" className="scroll-mt-24">
      <h2 className="mb-3 text-lg font-semibold text-charcoal">Booked intro calls</h2>
      {calls.length === 0 ? (
        <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">
          No intro calls booked. Calls booked on the site show up here with where the caller came
          from.
        </p>
      ) : (
        <div className="space-y-3">
          {calls.map((c) => {
            const when = new Date(c.startsAt).toLocaleString("en-US", {
              timeZone: VENUE_TIME_ZONE,
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const host = findScheduler(c.personSlug)?.name ?? c.personSlug;
            const source = c.srcTag
              ? `${leadSourceLabel(sourceForTag(c.srcTag)) ?? "Tagged link"} (link tag: ${c.srcTag})`
              : "No tagged link";
            return (
              <div key={c.id} className="rounded-2xl border border-parchment bg-white p-5 text-sm">
                <p className="font-semibold text-charcoal">
                  {when} · {c.name} with {host}
                </p>
                <p className="mt-1 break-words text-ink/70">
                  <a href={`mailto:${c.email}`} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
                    {c.email}
                  </a>
                  {c.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${c.phone}`} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
                        {c.phone}
                      </a>
                    </>
                  )}
                  {c.eventDate && ` · their date ${formatEventDate(c.eventDate)}`}
                </p>
                <p className="mt-1 text-ink/55">Came in through: {source}</p>
                {c.notes && <p className="mt-2 whitespace-pre-line break-words text-ink/80">{c.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** YYYY-MM-DD for an instant, on the venue's wall clock. */
function localDate(at: Date): string {
  return at.toLocaleDateString("en-CA", { timeZone: VENUE_TIME_ZONE });
}

const linkClass = "whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium text-ink/75 hover:bg-cream hover:text-terracotta";

export default function Dashboard({ data, basePath, platform = null }: { data: AdminData; basePath: string; platform?: PlatformStats | null }) {
  const today = localDate(new Date());
  const insights = buildInsights({
    weddings: [...data.upcoming, ...data.past],
    calls: data.calls,
    callDates: Object.fromEntries(data.calls.map((c) => [c.id, localDate(new Date(c.startsAt))])),
    today,
    yearCap: WEDDINGS_PER_YEAR_CAP,
  });
  const jump = [
    { href: "#today", label: "Today" },
    { href: "#upcoming", label: `Upcoming (${data.upcoming.length})` },
    ...(data.upcoming.some((w) => w.packageType !== "corporate" && w.status !== "cancelled") ? [{ href: "#ready", label: "Ready?" }] : []),
    { href: "#calls", label: `Calls (${data.calls.length})` },
    ...(data.upcoming.length + data.past.length > 0 ? [{ href: "#sources", label: "Sources" }] : []),
    ...(data.past.length > 0 ? [{ href: "#past", label: "Past" }] : []),
  ];
  // The house books sign in by email (HOUSE_BOOKS_EMAILS), not by this key.
  const erp = [
    { href: "/app/money", label: "Money" },
    { href: "/app/books", label: "Books" },
    { href: "/app/transactions", label: "Transactions" },
    { href: "/app/vendors", label: "Vendors" },
  ];
  const tools = [
    { href: `${basePath}/jobs`, label: "Job costing" },
    { href: `${basePath}/crew`, label: "Crew and materials" },
    { href: `${basePath}/hours`, label: "Call times" },
    { href: `${basePath}/reviews`, label: "Reviews to approve" },
    { href: `${basePath}/playbook`, label: "Lead playbook" },
    { href: `${basePath}/archived`, label: "Archived bookings" },
  ];
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h1 className="text-2xl text-charcoal">Command center</h1>
            <p className="text-sm text-ink/60">
              {new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
            </p>
          </div>
          <p className="text-sm text-ink/60">
            {data.upcoming.length} upcoming · {data.past.length} past or cancelled. This link is the key: don&apos;t share it.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink/45">Books</span>
            {erp.map((l) => (
              <a key={l.href} href={l.href} className={linkClass}>
                {l.label}
              </a>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-parchment sm:inline-block" aria-hidden />
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink/45">Tools</span>
            {tools.map((l) => (
              <a key={l.href} href={l.href} className={linkClass}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      <nav aria-label="Sections" className="sticky top-0 z-20 border-b border-parchment bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {jump.map((l) => (
            <a key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </a>
          ))}
          {insights.unreadMessages > 0 && (
            <a href="#today" className="ml-auto whitespace-nowrap rounded-full bg-terracotta px-3 py-1 text-sm font-semibold text-cream">
              {insights.unreadMessages} unread
            </a>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <CommandCenter insights={insights} basePath={basePath} />

        <section id="upcoming" className="scroll-mt-24">
          <h2 className="mb-3 text-lg font-semibold text-charcoal">Upcoming</h2>
          {data.upcoming.length === 0 ? (
            <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">
              No upcoming weddings on the books yet.
            </p>
          ) : (
            <div className="space-y-4">
              {data.upcoming.map((w) => (
                <WeddingCard key={w.id} wedding={w} upcoming basePath={basePath} />
              ))}
            </div>
          )}
        </section>

        <Readiness weddings={data.upcoming} />
        <CallList calls={data.calls} />
        <CorporateBookingForm basePath={basePath} />
        <SourceTally weddings={[...data.upcoming, ...data.past]} />
        <PlatformPanel stats={platform} />

        {data.leads.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-charcoal">Recent inquiries (legacy leads)</h2>
            <div className="overflow-x-auto rounded-2xl border border-parchment bg-white">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-parchment text-xs uppercase tracking-wide text-ink/50">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Venue</th>
                    <th className="px-4 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((l) => (
                    <tr key={l.id} className="border-b border-parchment/60 last:border-0">
                      <td className="px-4 py-2.5 text-charcoal">{l.name}</td>
                      <td className="px-4 py-2.5 text-ink/70">{l.email}</td>
                      <td className="px-4 py-2.5 text-ink/70">{l.eventDate ?? ""}</td>
                      <td className="px-4 py-2.5 text-ink/70">{l.venue ?? ""}</td>
                      <td className="px-4 py-2.5 text-ink/50">{l.source ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {data.past.length > 0 && (
          <section id="past" className="scroll-mt-24">
            <h2 className="mb-3 text-lg font-semibold text-charcoal">Past and cancelled</h2>
            <div className="space-y-4">
              {data.past.map((w) => (
                <WeddingCard key={w.id} wedding={w} upcoming={false} basePath={basePath} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/** One wording for both agreements' pills; either side may sign first. */
function agreementState(acceptedAt: string | null, countersignedAt: string | null): string {
  if (acceptedAt && countersignedAt) return "signed by both";
  if (acceptedAt) return "needs your signature";
  if (countersignedAt) return "waiting on the couple";
  return "unsigned";
}
