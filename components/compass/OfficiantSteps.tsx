// The three steps of the officiant agreement, at the top of the couple's page,
// so the order is plain before anyone scrolls: sign, pay the deposit, pay the
// balance after the ceremony. Each step says whether it is done, next, or
// waiting, and the one that is next says what to do and where.
type Step = { title: string; detail: string; state: "done" | "next" | "later"; href?: string; cta?: string };

export default function OfficiantSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-6 grid gap-3 sm:grid-cols-3 print:hidden" aria-label="What to do, in order">
      {steps.map((s, i) => (
        <li
          key={s.title}
          className={`rounded-2xl border-2 p-4 ${
            s.state === "next"
              ? "border-terracotta bg-white"
              : s.state === "done"
                ? "border-sage bg-sage/10"
                : "border-parchment bg-white/60 text-ink/60"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">
            Step {i + 1} · {s.state === "done" ? "Done" : s.state === "next" ? "Do this now" : "Later"}
          </p>
          <p className="mt-1 font-semibold text-charcoal">{s.title}</p>
          <p className="mt-1 text-sm text-ink/70">{s.detail}</p>
          {s.state === "next" && s.href && s.cta && (
            <a
              href={s.href}
              className="mt-3 inline-block rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-white hover:bg-terracotta-dark"
            >
              {s.cta}
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
