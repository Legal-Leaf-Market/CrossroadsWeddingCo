import Link from "next/link";
import BooksHelp from "@/components/account/BooksHelp";
import { periodEnd, type Blocker } from "@/lib/books/accrual";
import type { BooksHelpTopic } from "@/lib/books/help-topics";

const STEPS: { id: string; question: string; summary: string; topic: BooksHelpTopic; keys: string[] }[] = [
  {
    id: "transactions",
    question: "Have the money and expenses been reviewed?",
    summary: "Sort cleared bank lines, match recorded payments, and review submitted expense reports.",
    topic: "transactions",
    keys: ["unreviewed", "pending", "hand_payments", "claims"],
  },
  {
    id: "jobs",
    question: "Are the jobs costed?",
    summary: "Check the month’s held jobs for missing cost plans or missing amounts on existing plans.",
    topic: "jobCosts",
    keys: ["uncosted", "no_plan"],
  },
  {
    id: "balances",
    question: "Do the totals agree?",
    summary: "Compare account totals with their underlying entries, check transfers, and review today’s bank differences.",
    topic: "tieOut",
    keys: ["unbalanced", "tie_out", "transfers", "bank"],
  },
  {
    id: "review",
    question: "What’s left before close?",
    summary: "Review what still needs attention. The close screen handles preparation, approval, and reopening.",
    topic: "close",
    keys: [],
  },
];

const issueLink = (key: string, end: string) => {
  switch (key) {
    case "claims": return { href: "/app/books/expenses", label: "Review expense reports" };
    case "unreviewed":
    case "pending":
    case "hand_payments": return { href: "/app/transactions", label: "Open transactions" };
    case "tie_out": return { href: `/app/books/tie-out?asof=${end}`, label: "Open tie-out" };
    case "unbalanced": return { href: `/app/books/accounts?asof=${end}`, label: "Open trial balance" };
    case "transfers":
    case "bank": return { href: "/app/books#bank-check", label: "See the bank check" };
  }
};

export default function GuidedBookkeeping({
  period, month, status, locked, blockers, requested, syncFailed, house,
}: {
  period: string;
  month: string;
  status: string;
  locked: boolean;
  blockers: Blocker[];
  requested: string;
  syncFailed: boolean;
  house: boolean;
}) {
  const priority = blockers.some(blocker => blocker.hard) ? blockers.filter(blocker => blocker.hard) : blockers;
  const firstFlagged = STEPS.findIndex(step => priority.some(blocker => step.keys.includes(blocker.key)));
  const requestedIndex = STEPS.findIndex(step => step.id === requested);
  const current = locked ? STEPS.length - 1 : requestedIndex >= 0 ? requestedIndex : Math.max(0, firstFlagged);
  const step = STEPS[current];
  const review = current === STEPS.length - 1;
  const visible = locked ? [] : review ? blockers : blockers.filter(blocker => step.keys.includes(blocker.key));
  const end = periodEnd(period);
  const closeUrl = `/app/books/close?m=${period}`;
  const stepUrl = (id: string) => `${closeUrl}&guide=${id}`;

  return (
    <section className="space-y-4" aria-label="Guided bookkeeping steps">
      <div className="rounded-2xl border border-parchment bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold text-terracotta-dark">Step {current + 1} of {STEPS.length}</p>
          <p className="text-ink/70">{month} · {status}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-xl text-charcoal">{step.question}</h2>
          <BooksHelp topic={step.topic} />
        </div>
        <p className="mt-2 text-sm text-ink/75">{locked ? "This month is locked. Use the close screen to see its history or the reopening actions available to you." : step.summary}</p>
        {syncFailed && (
          <p role="status" className="mt-4 rounded-lg border border-terracotta bg-cream p-3 text-sm text-terracotta-dark">
            Books couldn’t finish syncing. Refresh before relying on these checks.
          </p>
        )}
        {visible.length > 0 && (
          <ul className="mt-4 divide-y divide-parchment border-y border-parchment">
            {visible.map(blocker => {
              const action = issueLink(blocker.key, end);
              return (
                <li key={blocker.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span>
                    <strong className={blocker.hard ? "text-terracotta-dark" : "text-charcoal"}>{blocker.hard ? "Fix" : "Acknowledge"}</strong>
                    {" · "}{blocker.label} ({blocker.count})
                  </span>
                  {action && <Link href={action.href} className="font-semibold text-terracotta-dark underline underline-offset-2">{action.label}</Link>}
                </li>
              );
            })}
          </ul>
        )}
        {!locked && !syncFailed && visible.length === 0 && (
          <p className="mt-4 rounded-lg bg-sage/15 p-3 text-sm text-sage-dark">No issues flagged {review ? "by these checks" : "for this step"}.</p>
        )}
        {!locked && visible.some(blocker => blocker.key === "uncosted" || blocker.key === "no_plan") && (
          <p className="mt-3 text-sm text-ink/75">
            {house ? "Open the affected booking in Crossroads admin to review its cost plan." : <>Open the affected booking from <Link href="/app" className="font-semibold text-terracotta-dark underline">your workspace</Link> to review its cost plan.</>}
          </p>
        )}
        <nav className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold" aria-label="Guide navigation">
          {!locked && current > 0 && <Link href={stepUrl(STEPS[current - 1].id)} className="text-terracotta-dark underline underline-offset-2">Previous step</Link>}
          <Link
            href={review ? closeUrl : stepUrl(STEPS[current + 1].id)}
            className="ml-auto rounded-full bg-terracotta px-4 py-2 text-cream hover:bg-terracotta-dark"
          >
            {review ? "Open close screen" : "Next step"}
          </Link>
        </nav>
      </div>
    </section>
  );
}
