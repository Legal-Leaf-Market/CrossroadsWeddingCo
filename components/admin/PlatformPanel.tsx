import type { PlatformStats } from "@/lib/platform-stats";
import { businessTypeLabel } from "@/lib/tenant-constants";
import { VENUE_TIME_ZONE } from "@/lib/site";

// The scoreboard for the platform side of the business: business accounts
// that signed up for the software, and where they came from. Shown on the
// Crossroads dashboard only.
export default function PlatformPanel({ stats }: { stats: PlatformStats | null }) {
  if (!stats) return null;
  const tiles = [
    { label: "Business accounts", value: stats.total },
    { label: "New this week", value: stats.last7 },
    { label: "On a free trial", value: stats.onTrial },
    { label: "Paying", value: stats.paying },
  ];
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold text-charcoal">Platform signups</h2>
      <p className="mb-3 text-sm text-ink/60">
        Businesses using the software. Signups are {stats.total === 0 ? "closed or haven't started" : `${stats.last30} in the last 30 days`}
        {stats.trialEnded > 0 ? `; ${stats.trialEnded} trial${stats.trialEnded === 1 ? "" : "s"} ended without paying` : ""}.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-parchment bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-ink/55">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{t.value.toLocaleString("en-US")}</p>
          </div>
        ))}
      </div>
      {stats.total > 0 && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-parchment bg-white p-4">
            <p className="text-sm font-semibold text-charcoal">Where they came from</p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {stats.bySource.map((r) => (
                  <tr key={r.src} className="border-t border-parchment">
                    <td className="py-1.5 text-charcoal">{r.src === "none" ? "No tag (typed the address or searched)" : r.src}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink/50">Hand out links like /signup?src=expo-feb or ?src=meetup-indy to count each channel.</p>
          </div>
          <div className="rounded-2xl border border-parchment bg-white p-4">
            <p className="text-sm font-semibold text-charcoal">What kind of business</p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {stats.byType.map((r) => (
                  <tr key={r.type} className="border-t border-parchment">
                    <td className="py-1.5 text-charcoal">{businessTypeLabel(r.type)}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-parchment bg-white p-4 md:col-span-2">
            <p className="text-sm font-semibold text-charcoal">Latest signups</p>
            <table className="mt-2 w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-ink/50">
                  <th className="pb-1 font-medium">Business</th>
                  <th className="pb-1 font-medium">Type</th>
                  <th className="pb-1 font-medium">Source</th>
                  <th className="pb-1 font-medium">Signed up</th>
                  <th className="pb-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r, i) => (
                  <tr key={i} className="border-t border-parchment">
                    <td className="py-1.5 pr-2 font-semibold text-charcoal">{r.name}</td>
                    <td className="py-1.5 pr-2">{businessTypeLabel(r.type)}</td>
                    <td className="py-1.5 pr-2">{r.src ?? "none"}</td>
                    <td className="py-1.5 pr-2">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: VENUE_TIME_ZONE })}</td>
                    <td className="py-1.5">
                      {r.billingStatus === "active"
                        ? "Paying"
                        : r.billingStatus === "past_due"
                          ? "Card failed"
                          : r.billingStatus === "trialing"
                            ? "On trial, card added"
                            : r.billingStatus === "canceled" || r.billingStatus === "unpaid"
                              ? "Cancelled"
                              : r.trialEndsAt && new Date(r.trialEndsAt) <= new Date()
                                ? "Trial ended"
                                : "On trial"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
