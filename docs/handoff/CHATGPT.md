# Brief for ChatGPT: accounting policies, procedures and plain-English guides

## Context
Crossroads Wedding and Event Co. (Columbus, Indiana) runs DJ, MC, acoustic and bar service for
weddings and corporate events. Its own software (the "Agency OS" ERP) now keeps the books on an
**accrual basis under US GAAP**, with job costing and a controlled month-end close. The owners:
Jake (CEO, accounting background, prepares), Terry Winchester II (CBO acting as CFO, approves or
vetoes, final authority), Nic (COO, tie-breaker; never initiates cash). Everyone is a 1099
contractor paid through Found (a fintech; Lead Bank holds the accounts). Compass Events, the
officiating brand, is a separate division to be owned solely by Terry Winchester II.

How the software books things (give this to the reader as fact, it is how the system works):
- One booking is one job. Client money before the event is deferred revenue; on the event date
  the whole contract is recognized (ASC 606, point in time), the uncollected part as accounts
  receivable; later payments settle the receivable.
- Direct job costs (contractor pay, materials, job receipts) are matched to the job's revenue on
  the event date: paid-before is released from prepaid job costs, unpaid is accrued.
- Expense reports: the person submits from a phone link; Jake approves the report; Terry
  approves the payout (Nic approves Terry's own); approval books the expense and a
  reimbursement payable, the bank payout clears it.
- Entries update live while a month is open. The close is a hard cutoff enforced by the
  database: Jake prepares (blockers must be cleared, warnings acknowledged in writing), the month's
  numbers are frozen with a fingerprint, Terry approves or vetoes, Nic breaks ties after an
  escalation. After the close, anything that changes posts as a dated correction in the current
  month; a material error requires a reopen (Jake requests with a reason, Terry decides).
- Nothing financial is ever deleted, only edited or voided. Every change is in an append-only,
  tamper-evident audit log.
- Cash and check payments must be deposited and matched to the booking before a month can close.

## Your tasks (deliver each as its own Markdown document; no em dashes; plain English)
1. **Accounting policy manual** for the company: revenue recognition, deferred revenue and
   receivables, job costing and the matching principle, estimates vs errors (ASC 250) and the
   correction-vs-reopen decision, cancellations and kept deposits, refunds and customer credits,
   contractor (1099) payments, expense reimbursement, owners' split vs expenses (flag what depends
   on entity type: LLC taxed as a partnership vs S corporation, and list the questions for their
   tax preparer), intercompany treatment for Compass Events. Cite ASC topics where relevant; do
   not invent thresholds, propose them as "to be set by Terry".
2. **Month-end close SOP**: a checklist by role and by day (who does what, in what order, what
   evidence to keep), matching the software's blockers and approval flow above.
3. **Expense and reimbursement policy** for staff: what is reimbursable, receipts, deadlines,
   the two-stage approval, and what happens on a veto.
4. **One-page guides** for each owner: Jake (preparing the close), Terry (approving or vetoing),
   Nic (breaking a tie), and for any crew member (submitting a receipt from a phone).
5. **A list of questions** the owners should answer before year end (entity type, materiality,
   Stripe fee treatment, sales tax on bar service in Indiana, Compass ownership paperwork).

Do not state anything about the company that is not in this brief. Where a fact is missing, ask
or mark it "to confirm".
