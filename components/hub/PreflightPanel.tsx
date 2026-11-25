import type { Check } from "@/lib/preflight";

// The run sheet's pre-flight panel. Server component: no state, it only
// renders what lib/preflight.ts found.
//
// Proof mode prints the panel and a PROOF banner, so a sheet nobody has
// signed off cannot pass for the final one on a venue's clipboard. Final mode
// hides both from print and keeps the panel on screen only, so the DJ still
// sees any open issue while the paper stays clean.

const TONE: Record<Check["severity"], { label: string; cls: string }> = {
  error: { label: "Fix", cls: "border-red-700 text-red-800" },
  warn: { label: "Check", cls: "border-amber-600 text-amber-800" },
  info: { label: "Note", cls: "border-ink/30 text-ink/70" },
};

export default function PreflightPanel({
  checks,
  isFinal,
  base,
}: {
  checks: Check[];
  isFinal: boolean;
  /** The run sheet's own path, for the proof/final switch. */
  base: string;
}) {
  const errors = checks.filter((c) => c.severity === "error").length;
  return (
    <>
      {!isFinal && (
        <div className="mt-4 border-2 border-dashed border-terracotta px-3 py-1.5 text-center text-xs font-bold uppercase tracking-widest text-terracotta">
          Proof, not final. Check every line before the day.
        </div>
      )}
      <section
        className={`mt-4 rounded-lg border border-parchment p-3 text-sm ${isFinal ? "print:hidden" : ""}`}
        aria-label="Pre-flight checks"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-terracotta">
            Pre-flight checks
          </h2>
          <span className="text-xs print:hidden">
            {isFinal ? (
              <a href={base} className="font-semibold text-terracotta hover:text-terracotta-dark">
                Back to proof
              </a>
            ) : (
              <a href={`${base}?final=1`} className="font-semibold text-terracotta hover:text-terracotta-dark">
                {errors > 0 ? `Mark final anyway (${errors} to fix)` : "Mark final"}
              </a>
            )}
          </span>
        </div>
        {checks.length === 0 ? (
          <p className="mt-1 text-ink/60">Nothing flagged.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {checks.map((c, i) => (
              <li key={i} className={`border-l-4 pl-2 ${TONE[c.severity].cls}`}>
                <span className="font-semibold">{TONE[c.severity].label}:</span> {c.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
