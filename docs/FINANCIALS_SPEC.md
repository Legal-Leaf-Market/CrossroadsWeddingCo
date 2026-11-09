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

1. **Double entry, cash basis.** Every posting is a balanced journal entry (debits equal credits,
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

## Not in v1

Accrual and booking deposits as a liability; matching bank deposits to bookings; split lines;
manual journal entries; invoices posting receivables; the house account (Crossroads runs from
`/admin`, which has no bank feed); closing a period (locking months); sales tax.
