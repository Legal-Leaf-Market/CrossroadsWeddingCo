# Brief for Gemini: integrations, data formats and the normalizer test set

## Context
Crossroads Wedding and Event Co. runs its own ERP (Next.js 15, TypeScript, Postgres via Drizzle,
deployed on Netlify). Its books are accrual basis under US GAAP with job costing. The owner's
principle: **ETL first**. Every feature must take data in and send data out. A live sync may post
on its own; anything else (a spreadsheet, a PDF, an email, an export from another app) lands in a
staging area, produces a cached preview of the journal it would post, waits for approval, and is
audited before anything posts. Mail and calendar target **Proton and Google only** (no Microsoft).

Current feeds: Plaid for bank and card transactions (Found is reached through Plaid; Found has no
public API), Stripe for card payments and subscriptions (webhook), Resend for email out, Spotify
for playlists.

## Your tasks (deliver each as its own Markdown document; no em dashes)
1. **Proton integration options.** Proton Mail has no public mail API. Compare: Proton Mail Bridge
   (IMAP/SMTP on a machine the owner runs; plan requirements; how a server could reach it safely),
   forwarding rules to a dedicated inbound address (e.g. an inbound-parse webhook), and Proton
   Calendar (subscriptions, ICS links, what can and cannot be read or written). Recommend one path
   per use case: receipts and invoices arriving by email; client inquiries; calendar sync for
   event dates and office hours. Cite official Proton documentation.
2. **Google integration.** Gmail API (scopes for read-only label watching, push notifications via
   Pub/Sub, attachment download) and Google Calendar API (two-way sync of event dates). Include
   OAuth verification requirements for restricted scopes and how to minimize them.
3. **File formats the importer must read**, each with a field mapping into this schema:
   bank line = { postedDate, amountCents (positive = money in), merchant, description, account };
   receipt = { spentOn, amountCents, merchant, category hint, job hint }. Cover: Found CSV export,
   Plaid transaction object, Stripe balance transactions and payouts (gross, fee, net), Rocket
   Money CSV export, QuickBooks Online exports (transactions list, journal, IIF if still relevant),
   generic bank OFX/QFX and CSV, and common PDF bank statements. For each: sample header row,
   date and sign conventions, de-duplication key, and gotchas.
4. **PDF normalizer test set.** A list of 25 realistic, fully synthetic test documents (statements,
   vendor invoices, venue invoices, fuel and supply receipts, a Stripe payout report) with the exact
   values a correct parser must extract, for an automated test suite. Use invented businesses and
   numbers only; never real people or real account numbers.
5. **Export targets.** What an accountant wants out of the system: QuickBooks Online journal import
   format, Xero manual journal CSV, a trial balance and general ledger layout, and 1099-NEC data
   for contractors. Give the exact columns.

Mark anything you cannot confirm from an official source as unverified.
