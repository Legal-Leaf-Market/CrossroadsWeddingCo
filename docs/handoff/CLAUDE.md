# Handoff for Claude (Claude Code): engineering

You are picking up the Crossroads Wedding and Event Co. platform ("Agency OS", the ERP) in
this repo. Read the root `CLAUDE.md` first (it is the project's memory and its standing
directives), then `docs/FINANCIALS_SPEC.md` (the accounting spec). This file is your task list.

## Who you are working for
- Jake (Jacob), CEO, the accounting experience. Prepares and triggers everything financial.
- Terry Winchester II, CBO acting as CFO. Approves or vetoes; where the buck stops.
- Nic, COO. Tie-breaker on financial decisions; never triggers cash.
Logins are their `@crossroadsweddingco.shop` addresses (default house books list in `lib/auth.ts`).

## Non-negotiables (owner directives, 2026-11-13)
1. **Accrual basis, US GAAP, matching principle, job costing.** Never build on a cash-basis
   assumption. Get the accounting logic right and tested BEFORE writing code.
2. **Nothing is ever deleted** from anything that carries money: modify or void. The database
   refuses DELETE on those tables (`forbid_delete` triggers); keep it that way.
3. **Live sync until a hard cutoff.** Journal entries are derived from their sources and update
   live while the month is open; after the close, corrections post in the current month. Never
   write a journal entry by hand in code; add a source and a posting rule.
4. **Audit everything** through `lib/audit.ts`. The log is append-only and hash-chained.
5. **Checks and balances:** Jake triggers, Terry approves or vetoes, Nic breaks ties. Whoever
   triggers can never approve. Expense reports: only Jake approves the report; Terry approves the
   payout, except Terry's own, which Nic approves.
6. **ETL first.** Every feature needs a way in and a way out. Syncs may post directly; one-off
   imports go through staging, a cached preview, approval and audit before anything posts.
7. **Proton and Google** for mail and calendar. Not Microsoft.
8. **Build on what exists.** Extend Books, Transactions, Vendors, the admin dashboard; do not
   stand up parallel apps.
9. No em dashes in anything a human reads. `pnpm check` and `pnpm build` before every push; every
   pure rules module gets a `scripts/verify-*.mjs` run with `node --experimental-strip-types`.

## What exists now (branch `claude/magical-feynman-z1vb3q`, PR #121)
- Owner command center: `/admin/[key]` (`lib/admin-insights.ts`).
- Job costing: crew and pay (`/admin/[key]/crew`), per-job plans (`/admin/[key]/costing/<id>`),
  job list (`/admin/[key]/jobs`). Pure rules `lib/costing-logic.ts`.
- Accrual ledger: `postLedger` in `lib/books/ledger.ts`, rules in `lib/books/accrual.ts`.
- Close: `/app/books/close` (`lib/books/close.ts`, `app/api/app/books/close`).
- Audit log: `/app/books/audit`.
- Expense reports: capture `/expense/<token>`, review `/app/books/expenses` (`lib/expenses.ts`,
  `lib/expense-logic.ts`).

## Your tasks, in order
1. **Production check after merge.** Confirm the Netlify build log shows the migration applied,
   open `/app/books` as jake@ and confirm the conversion posted (journal entries now carry
   `source_ref`; job revenue and cost entries exist for held jobs), and that `/app/books/audit`
   says the chain is intact.
2. **DONE 2026-11-13 (subledger slice).** **Make `/admin/[key]/jobs` tie to the ledger.** It still computes prepaid and accrued from the
   cost lines' "Paid" box. Read the same facts `postLedger` uses (matched bank lines and approved
   receipts), or better, read the posted journal by `source_ref`. Add a test that the page's
   totals equal the GL balances of 1100, 1300, 2300, 2400.
3. **DONE 2026-11-13 (subledger slice; see FINANCIALS_SPEC "Subledgers and the tie-out").** **Drill-down to true subledgers.** Report line -> GL account register (running balance) ->
   subledger for control accounts (1100, 1300, 2300, 2400 by job; 2500 by person; vendors by
   1099 vendor) -> journal entry -> lines -> source record -> that source's audit history.
   Pages under `/app/books/accounts/<id>` and `/app/books/entries/<id>`. Add a tie-out report
   (control account balance vs sum of its subledger) and make any difference a HARD close blocker
   in `closeBlockers`.
4. **Stripe clearing account.** Card payments land in Found net of fees. Add a 1200 Stripe
   clearing asset; post the gross payment against the job (rule 1 or 3), the fee to card and
   payment fees, and clear with the payout bank line. Stripe events are already received at
   `/api/webhooks/stripe`.
5. **Customer credits.** Overpayment goes to a 2350 Customer credits liability, not a negative
   receivable; refunds draw it down (or deferred revenue before the event).
6. **Compass Events division.** Owned solely by Terry Winchester II. Tag Compass jobs (officiant
   agreements in `service_agreements`) as their own division with their own revenue on the
   ceremony date, and an intercompany due to/from Compass account while its money lands in
   Crossroads' bank.
7. **Staged imports (ETL) and the data normalizer.** A `staged_batches` + `staged_rows` design:
   source (CSV/XLSX upload with column mapping, PDF statement or invoice, email message), parsed
   rows, a cached preview of the journal it would produce (run the posting rules without
   writing), approve (Jake) and post, all audited. Then connectors: Proton (no public API; use
   Proton Mail Bridge IMAP on a host the owner runs, or a forwarding address), Gmail API, Google
   Calendar. Exports: GL CSV exists; add trial balance, every subledger, the audit log, and a
   QuickBooks-importable journal.
8. **Materiality threshold** setting for "correct in the current month" vs "reopen".
9. **Cash payout requests** (any money out, not just reimbursements): Jake requests, Terry
   approves or vetoes, Nic breaks ties, before the bank line can be matched as that payout.

## How to verify locally
Postgres 16 is in the container: initdb a cluster owned by `postgres`, run
`DATABASE_URL=... node scripts/migrate.mjs` twice (it must be idempotent), set `ADMIN_DASH_KEY`
in `.env.local`, `pnpm dev`. Test the database guards with psql (deletes and closed-month writes
must error). Every `scripts/verify-*.mjs` must pass.
