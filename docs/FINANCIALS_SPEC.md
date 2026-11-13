# Financials spec: the ledger under the bank review queue

Written 2026-11-09 by Claude Code, on Jacob's instruction: "do your own financial spec, keep
moving". It replaces the "Crossroads Financials" spec and GL posting rules from the claude.ai
chat, which never reached this repo. If those turn up and disagree, the owner decides and this
file gets corrected.

## What it is for

A wedding or event business on the platform should be able to answer three questions without
hiring a bookkeeper first:

1. **Did I make money this month, and this year?** (profit and loss)
2. **What do I have and what do I owe?** (account balances)
3. **Do my books match the bank?** (reconciliation)

And hand its accountant a general ledger at tax time.

## Decisions

1. **Double entry. SUPERSEDED 2026-11-13: the books are ACCRUAL basis under US GAAP** (owner:
   "force accrual and US GAAP in the software ... we are not a cash basis gl"). See "Accrual
   basis, live sync and the close" below. The original cash-basis reasoning is kept for history:
   **Double entry, cash basis.** Every posting is a balanced journal entry (debits equal credits,
   checked by the database, not only by the code). Cash basis because that is how almost every
   small event business files Schedule C, and because accrual needs invoices and booking
   deposits matched to bank lines, which is not built yet. Accrual (client deposits held as a
   liability until the event) is v2 and slots in as new posting rules, not a new ledger.
2. **The bank feed is the source.** A journal entry is DERIVED from a sorted bank line. Sorting
   is still a label (the review queue); posting turns the label into books. A person never
   types debits and credits for a bank line.
3. **What posts:** a bank line that is categorized, posted (not pending) and not removed.
   **What does not post:** unreviewed lines, lines marked "Not business", pending lines, lines the
   bank withdrew.
4. **The journal is append-only.** When a posted line changes (re-sorted, moved back, set aside,
   withdrawn, its amount or date corrected by the bank), its entry is VOIDED, never edited or
   deleted, and a new one is posted if the line still qualifies. The voided entry stays as the
   audit trail. One posted entry per bank line at a time, enforced by a partial unique index.
5. **Chart of accounts per account (tenant), generated, editable by name only.**
   - Each connected bank or card account gets its own ledger account: depository accounts are
     assets (1000s), credit cards and loans are liabilities (2000s).
   - Each income category is an income account (4000s), each expense category an expense
     account (6000s), each owner category an equity account (3000s).
   - Every "Moving money" category (transfer between my accounts, credit card payment) posts to
     ONE clearing account, 1900 Transfers in transit. When both legs of a transfer are on
     connected accounts, the clearing account nets to zero; a balance left in it is a transfer
     with a missing leg, which the books page points out.
   - System accounts: 1900 Transfers in transit, 3900 Opening balance equity.
   - Codes are assigned in steps of 10 inside each range and never reused.
6. **Posting rules**, with bank amounts in integer cents, positive meaning money INTO the
   bank account (the convention the feed already uses):

   | Bank line | Debit | Credit |
   |---|---|---|
   | money in (amount > 0) | the bank's ledger account | the category's account |
   | money out (amount < 0) | the category's account | the bank's ledger account |

   This is correct for both kinds of bank account. A card charge is money out: debit the
   expense, credit the card (a liability grows with a credit). A card payment received is money
   in: debit the card (the liability shrinks), credit the clearing account.
7. **Opening balances are entered, not guessed.** The feed only knows the transactions it pulled,
   so the ledger balance of a bank account starts at zero. The owner enters the balance from a
   statement on a date; that posts one entry against 3900 Opening balance equity. It is not
   computed from the bank's current balance, because a line set aside as "Not business" on a
   business account still moved money, and a computed opening balance would silently absorb
   that difference instead of showing it.
8. **Reconciliation is shown, not forced.** For each bank account: the ledger balance next to the
   balance the bank reports, and the difference. A difference means one of three things, and
   the page says which to check: no opening balance, lines still waiting to be sorted, or lines
   set aside as "Not business" that actually belong in the books (personal spending from a
   business account is an owner draw, not "Not business").
9. **Reports read only posted entries.** Profit and loss for a period: income minus expenses.
   Balances as of today: assets, liabilities, equity, with the period's net income shown so the
   equation visibly balances. General ledger CSV: every posted line, for the accountant.
10. **Tenancy.** Every ledger row carries the account's `tenant_id`, every query is scoped by the
    session's tenant, and the balance trigger also refuses a line whose ledger account belongs to
    a different tenant than its entry.
11. **Posting is serialized per tenant** (a transaction-scoped advisory lock), so a webhook sync
    and a person's sort landing in the same second cannot double post or race a void.

## Matching payments to bookings (added 2026-11-09)

12. **A match is a link, not a new kind of posting.** A money-in bank line can be tied to one of
    the account's bookings as a deposit or a balance payment. Matching also sorts the line into an
    income category (the one chosen, else Event income), so on cash basis it posts exactly like
    any other income; the booking's name goes into the entry's memo. Money out is never matched.
13. **Suggested, never applied.** The queue suggests bookings only on evidence: the exact amount
    still owed (deposit, balance, or the whole), or a client's name on the bank line, with dates
    far from the event counting against it. Each suggestion says why. A person presses Match.
14. **The booking shows what actually came in.** Received is the sum of matched lines the bank has
    not withdrawn. When it covers the deposit, the booking is marked deposit paid (and moves from
    inquiry to deposit paid); when it covers the total, balance paid. Those flags are only ever
    SET by matching, never cleared: the owner may have marked a cash payment paid by hand, and
    unmatching a bank line must not silently undo that. The received figure sits beside the
    flags so a stale one is visible.
15. **Re-sorting a matched line clears the match** (sort, set aside, move back), and its ledger
    entry is voided and reposted like any other change.

## Not in v1

Accrual and booking deposits as a liability; one bank line paying several bookings; refunds to a
client matched back to the booking; split lines;
manual journal entries; invoices posting receivables; the house account (Crossroads runs from
`/admin`, which has no bank feed); closing a period (locking months); sales tax.


## Accrual basis, live sync and the close (2026-11-13)

Owner directives: accrual under US GAAP, the matching principle, job costing, accruals; every
entry linked to its source and updating live "until things are finalized and fully approved in
the proper workflow", then a hard cutoff; "a damn good audit log before and after the cutoff,
and damn good controls on that cutoff"; "no one can delete, only modify or void". Pure rules:
`lib/books/accrual.ts` (checked by `scripts/verify-accrual.mjs`). Engine: `postLedger` in
`lib/books/ledger.ts`. Close: `lib/books/close.ts`. Audit: `lib/audit.ts`.

### Accounts added (system accounts, per tenant)
1100 Accounts receivable, 1300 Prepaid job costs, 2300 Deferred revenue (client deposits),
2400 Accrued job costs, 2500 Reimbursements payable, 4500 Event revenue, 5000 Cost of revenue:
job costs, 6990 Uncategorized expense (receipts).

### Posting rules (one booking = one job)
| Event | Debit | Credit |
|---|---|---|
| 1. Client pays on or before the event date (matched bank line) | Cash | Deferred revenue |
| 2. Event date (ASC 606, point in time) | Deferred revenue (collected by then), Accounts receivable (rest) | Event revenue (whole contract) |
| 3. Client pays after the event | Cash | Accounts receivable |
| 4. Job cost paid on or before the event (matched money out) | Prepaid job costs | Cash |
| 5. Event date, matching | Cost of revenue (job cost) | Prepaid job costs (paid by then), Accrued job costs (rest) |
| 6. Job cost paid after the event | Accrued job costs | Cash |
| 7. Expense report approved (Jake) | The expense; or Prepaid job costs (job, before the event); or Cost of revenue (job, after) | Reimbursements payable |
| 8. Reimbursement paid (after payout approval) | Reimbursements payable | Cash |
| 9. Job cancelled | Deferred revenue (payments kept) / Cost of revenue (prepaid written off) | Event revenue / Prepaid job costs |
| 10. Anything not tied to a job | As before: the bank line against its category | |
| 11. Deposit or balance marked paid by hand (cash, check), not matched from the bank | 1050 Undeposited funds | Deferred revenue (on or before the event) / Accounts receivable (after) |

Job cost = each cost-plan line's paid (actual) amount, else its planned cost (an estimate,
trued up as a change in estimate), plus job-linked receipts dated on or before the event.
Owners' split is never a job cost. Card and Stripe payments: see open items.

### Live sync and the hard cutoff
Every journal entry names its source (`source_ref`: `bank_transaction:<id>`, `job_revenue:<id>`,
`job_cost:<id>`, `expense_claim:<id>`). `postLedger` recomputes what every source should post
and calls `planPosting`: while all of a source's entries sit in open months, the entry follows
the source (void and repost). Once any is in a locked month, that history is never touched; the
difference posts as ONE correcting entry dated today with `adjusts_period` naming the closed
month (a change in estimate per ASC 250; a material error is handled by reopening). A source
first seen with a date inside a locked month posts today, saying so. The database enforces the
cutoff itself (`ledger_period_locked`, `journal_entry_period_guard`, `journal_line_guard`): no
insert, void or edit dated in a locked month, entries' money fields never change, lines are
append-only, nothing is ever deleted.

### The close (who does what)
Jake (CEO) prepares and triggers; Terry Winchester II (CBO, acting CFO, where the buck stops)
approves or vetoes; Nic (COO) breaks a tie only after Jake escalates a veto, and can never
trigger. Seats live in `finance_roles`; whoever triggers a step can never approve it. Months
close in order, only after they end. Hard blockers: unbalanced entries, unsorted bank lines,
expense reports awaiting approval, held jobs with an unset cost, bookings marked paid by hand
without a deposited and matched bank line ("always deposit and match before close"). Soft
blockers must each be acknowledged in writing: jobs with no cost plan, pending lines, transfers
in transit, bank-vs-books differences. Preparing freezes the month's activity with a SHA-256 of
its trial balance and entry ids; approval is refused if the hash moved. Reopen: Jake requests
with a reason, Terry approves or vetoes, Nic breaks ties; only the latest closed month reopens.

### Audit log
`audit_log` is append-only (UPDATE, DELETE and TRUNCATE refused by triggers) and hash-chained per
account: each row's hash covers its content and the previous row's hash, computed in the
database. `/app/books/audit` re-walks the chain on every visit. Written for every journal post,
void and correction (with the source and cause), every close step, cost-plan saves, crew and
materials saves, booking money edits, bank-to-job matches, and every expense report step.

### Expense reports (Expensify-style)
Capture link per crew member (`/expense/<id>.<hmac>`), receipts stored in `receipts`. Jake alone
approves reports; Terry approves payouts except his own, which Nic approves; vetoes escalate from
Jake to Nic. Posting: rules 7 and 8.

### Data in and out (owner principle: ETL first)
Every feature has a way in and a way out. A live sync (Plaid) may post on its own. Anything that
is NOT a sync (a spreadsheet, a PDF, an email, a Rocket Money or QuickBooks export) lands in a
staging area first, gets a cached preview report of exactly what would post, needs an approval,
and is audited. Not built yet; see docs/handoff.

### Subledgers and the tie-out (2026-11-13)
Every journal line on a control account carries a subledger key (`journal_lines.sub_ref`):
`job:<booking id>` on 1100, 1300, 2300 and 2400 (and the job's 4500 and 5000 lines, so job
profit reads straight from the ledger), `crew:<crew member id>` on 2500. The posting rules set
the key (`matchedBankEntry`, `jobEntries`, `keyedClaimEntry`, `payoutEntry` in
`lib/books/accrual.ts`), and netting, fingerprints and corrections all work per account AND
key, so a reclassification between jobs is a real posting even when the account total does not
move. A reimbursement payout that covers more than its claims puts the extra on the one person
it paid, or, when it covered several people, leaves it unkeyed (nobody can say whose it is).

Tie-out: each control account's balance against the sum of its subledger
(`tieOut` in `lib/books/subledger-logic.ts`). They can only differ by lines with no key, or a
key of the wrong kind; any difference is a HARD close blocker ("Control accounts that don't tie
to their subledgers"), checked as of the month's end. Books posted before keys existed convert
by themselves: an open-month entry is voided and reposted with its keys once; a closed month
keeps its entry and gets one dated reclassification. Untagged entries keep their old fingerprint
exactly, so bank lines that are not tied to a job do not churn. Fingerprints longer than the
200-character column are stored as a hash instead of being cut off (a cut-off one could never
match its source again and would repost on every run).

Drill-down: report line (`/app/books`) -> account register with running balance
(`/app/books/accounts/<id>`, `?from=&to=&sub=`) -> the subledger for control accounts (by job or
person, `?sub=none` lists the lines the tie-out counts as a difference) -> journal entry
(`/app/books/entries/<id>`: lines with keys, every version from the same source, the source
record, the audit history of entry and source). Trial balance at `/app/books/accounts`, tie-out
report at `/app/books/tie-out`, vendors link each 1099 payment to its entry. CSV out:
`/api/app/books/export?report=trial-balance|subledgers|audit-log`. The job costing page
(`/admin/[key]/jobs`) reads its balances from the ledger by key and states whether it ties.
Checked by `scripts/verify-subledger.mjs`.

### Bookings into the books (2026-11-13, "make sure our bookings convert over correctly")
- **Hand-paid money is a source** (rule 11): `hand_deposit:<booking>` and `hand_balance:<booking>`,
  amounts by the same rule as `creditFor`, keyed to the job, counted as collected for revenue
  recognition. Dated the day the box was ticked (`weddings.deposit_paid_on`/`balance_paid_on`,
  recorded from 2026-11-13); boxes ticked earlier post on the booking's date (deposit) or the day
  after the event (balance), and the memo says "date assumed". When the bank deposit is matched to
  the booking, the hand-paid amount drops and the bank line carries the payment: no double count.
  1050 is a control account (by job) and "deposit and match before close" stays a hard blocker.
- **Not a real job**: the owner can leave a test booking out of the books from the job costing
  page (`weddings.books_excluded_at`, reason required, audited, refused while bank lines or
  approved receipts are tied to it). Its entries void; it can be put back.

### Open items
Stripe clearing account (card payments arrive net of fees); customer credits for overpayment;
Compass Events as its own division owned by Terry Winchester II, with an intercompany due
to/from account while its money lands in Crossroads; materiality threshold for reopen vs
correction; QuickBooks-importable journal export; a job cost paid from the bank with no cost-plan
line leaves a debit on 2400 after the event (the cost plan is the cost; add the line).
