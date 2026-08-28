import type { AdminData, AdminWedding } from "@/lib/admin";
import { daysOut, formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME } from "@/lib/site";

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

function WeddingCard({ wedding, upcoming }: { wedding: AdminWedding; upcoming: boolean }) {
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
          {statusChip(wedding.status)}
          <p className="text-sm font-semibold text-charcoal">{money(wedding.totalAmount)}</p>
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
          deposit {wedding.isDepositPaid ? "received" : "due"}
        </span>
        {wedding.addons.map((a) => (
          <span key={a.type} className="rounded-full bg-charcoal/5 px-2 py-0.5 text-ink/70">
            {ADDON_LABELS[a.type] ?? a.type}
            {a.fee != null ? ` $${a.fee}` : a.minFee != null ? ` from $${a.minFee}` : ""}
          </span>
        ))}
        {wedding.checkinsSent.length > 0 && (
          <span className="rounded-full bg-charcoal/5 px-2 py-0.5 text-ink/50">
            check-ins: {wedding.checkinsSent.join(", ")}d
          </span>
        )}
      </div>

      {wedding.notes && <p className="mt-3 text-sm text-ink/60">{wedding.notes}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
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
          <a href={`/live/${wedding.shareToken}`} className="rounded-full border border-parchment px-4 py-1.5 font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta">
            Vendor view
          </a>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ data }: { data: AdminData }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Bookings</h1>
          <p className="text-sm text-ink/60">
            {data.upcoming.length} upcoming · {data.past.length} past or cancelled. This page is
            read-only and this link is the key: don&apos;t share it.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-charcoal">Upcoming</h2>
          {data.upcoming.length === 0 ? (
            <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">
              No upcoming weddings on the books yet.
            </p>
          ) : (
            <div className="space-y-4">
              {data.upcoming.map((w) => (
                <WeddingCard key={w.id} wedding={w} upcoming />
              ))}
            </div>
          )}
        </section>

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
          <section>
            <h2 className="mb-3 text-lg font-semibold text-charcoal">Past and cancelled</h2>
            <div className="space-y-4">
              {data.past.map((w) => (
                <WeddingCard key={w.id} wedding={w} upcoming={false} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
