import type { Action, Insights } from "@/lib/admin-insights";

// Top of the owner dashboard: the money, what needs doing, and how the next
// twelve months are filling. Every number comes from lib/admin-insights.ts,
// which is checked by scripts/verify-admin-insights.mjs.

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

const LEVEL_STYLE: Record<Action["level"], { dot: string; label: string }> = {
  now: { dot: "bg-terracotta", label: "Now" },
  soon: { dot: "bg-gold", label: "Soon" },
  fyi: { dot: "bg-sage", label: "Heads up" },
};

const SHOW_FIRST = 8;

function ActionRow({ a, basePath }: { a: Action; basePath: string }) {
  const style = LEVEL_STYLE[a.level];
  const href = a.underBase ? `${basePath}${a.href}` : a.href;
  return (
    <li>
      <a
        href={href}
        className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-cream focus-visible:bg-cream focus-visible:outline-none"
      >
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-charcoal">{a.title}</span>
          <span className="block text-ink/60">{a.detail}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-ink/45">{style.label}</span>
      </a>
    </li>
  );
}

function Tile({ label, value, note, alert = false }: { label: string; value: string; note: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 ${alert ? "border-terracotta" : "border-parchment"}`}>
      <p className="text-xs uppercase tracking-wider text-ink/55">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? "text-terracotta-dark" : "text-charcoal"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-ink/55">{note}</p>
    </div>
  );
}

function Season({ months }: { months: Insights["months"] }) {
  const peak = Math.max(1, ...months.map((m) => m.booked + m.pending));
  const BAR = 96; // px of plot height for the busiest month
  return (
    <div className="rounded-2xl border border-parchment bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-charcoal">Next 12 months</p>
        <p className="flex items-center gap-4 text-xs text-ink/60">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-terracotta" aria-hidden /> Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-dashed border-gold" aria-hidden /> Inquiry
          </span>
        </p>
      </div>
      <div className="mt-3 grid grid-cols-12 items-start gap-1 sm:gap-2" role="list" aria-label="Events per month, next 12 months">
        {months.map((m) => {
          const total = m.booked + m.pending;
          const tip = `${m.label} ${m.year}: ${m.booked} booked${m.bookedRevenue ? ` (${usd(m.bookedRevenue)})` : ""}, ${m.pending} inquir${m.pending === 1 ? "y" : "ies"}`;
          return (
            <div key={m.key} role="listitem" title={tip} aria-label={tip} className="group flex flex-col items-center">
              <span className="mb-1 h-4 text-xs font-semibold tabular-nums text-charcoal">{total > 0 ? total : ""}</span>
              <div className="flex w-full max-w-7 flex-col justify-end gap-0.5" style={{ height: BAR }}>
                {m.pending > 0 && (
                  <div
                    className="w-full rounded-t border-2 border-dashed border-gold bg-gold/10"
                    style={{ height: Math.max(6, (m.pending / peak) * BAR) }}
                  />
                )}
                {m.booked > 0 && (
                  <div
                    className={`w-full bg-terracotta group-hover:bg-terracotta-dark ${m.pending > 0 ? "" : "rounded-t"}`}
                    style={{ height: Math.max(6, (m.booked / peak) * BAR) }}
                  />
                )}
              </div>
              <span className="mt-1 h-px w-full bg-parchment" aria-hidden />
              <span className="mt-1 text-[11px] text-ink/60">{m.label}</span>
              {m.label === "Jan" && <span className="text-[10px] font-semibold text-ink/45">{m.year}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pacing({ seasons }: { seasons: Insights["seasons"] }) {
  return (
    <div className="rounded-2xl border border-parchment bg-white p-4">
      <p className="text-sm font-semibold text-charcoal">Weddings booked vs. the year&apos;s cap</p>
      <div className="mt-3 space-y-3">
        {seasons.map((s) => {
          const pct = Math.min(100, (s.booked / Math.max(1, s.cap)) * 100);
          const over = s.booked > s.cap;
          return (
            <div key={s.year}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-charcoal">{s.year}</span>
                <span className="tabular-nums text-ink/70">
                  <span className={`font-semibold ${over ? "text-terracotta-dark" : "text-charcoal"}`}>{s.booked}</span> of {s.cap}
                  {!over && s.booked < s.cap && <span className="text-ink/50"> · {s.cap - s.booked} open</span>}
                  {over && <span className="font-semibold text-terracotta-dark"> · over the cap</span>}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-parchment" aria-hidden>
                <div className="h-full rounded-full bg-terracotta" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink/50">Corporate events don&apos;t count toward it. The cap is a pace, not a lock.</p>
    </div>
  );
}

export default function CommandCenter({ insights, basePath }: { insights: Insights; basePath: string }) {
  const { actions } = insights;
  const nowCount = actions.filter((a) => a.level === "now").length;
  const first = actions.slice(0, SHOW_FIRST);
  const rest = actions.slice(SHOW_FIRST);
  return (
    <section id="today" className="scroll-mt-24 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Booked ahead"
          value={usd(insights.bookedAhead.revenue)}
          note={`${insights.bookedAhead.count} event${insights.bookedAhead.count === 1 ? "" : "s"} with the date held`}
        />
        <Tile
          label="Still to collect"
          value={usd(insights.owed)}
          note={`${usd(insights.collected)} in so far`}
        />
        <Tile
          label="Past due"
          value={usd(insights.pastDue.amount)}
          note={insights.pastDue.count === 0 ? "Nothing late" : `${insights.pastDue.count} balance${insights.pastDue.count === 1 ? "" : "s"} after the event`}
          alert={insights.pastDue.count > 0}
        />
        <Tile
          label="In the pipeline"
          value={usd(insights.pipeline.revenue)}
          note={`${insights.pipeline.count} inquir${insights.pipeline.count === 1 ? "y" : "ies"} without a deposit`}
        />
      </div>

      <div className="rounded-2xl border border-parchment bg-white p-2 sm:p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 pt-2">
          <h2 className="text-lg font-semibold text-charcoal">Do this next</h2>
          <p className="text-sm text-ink/60">
            {actions.length === 0
              ? "All caught up."
              : `${nowCount} need${nowCount === 1 ? "s" : ""} you now · ${actions.length} total`}
          </p>
        </div>
        {actions.length > 0 ? (
          <>
            <ul className="mt-1 text-sm">
              {first.map((a, i) => (
                <ActionRow key={`${a.href}-${a.title}-${i}`} a={a} basePath={basePath} />
              ))}
            </ul>
            {rest.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer px-3 py-2 font-semibold text-terracotta">
                  {rest.length} more
                </summary>
                <ul>
                  {rest.map((a, i) => (
                    <ActionRow key={`${a.href}-${a.title}-${i}`} a={a} basePath={basePath} />
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="px-3 pb-3 pt-1 text-sm text-ink/60">
            No unread messages, nothing to sign, no deposits or balances waiting.
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[3fr_2fr]">
        <Season months={insights.months} />
        <Pacing seasons={insights.seasons} />
      </div>
    </section>
  );
}
