export const BOOKS_HELP = {
  overview: {
    title: "Where do I start?",
    description: "Use Books for the big picture. Choose a period to see its profit and loss, or open an account to follow the posted entries back to their source.",
    link: { href: "/app/books", label: "Open Books" },
  },
  profit: {
    title: "What does profit and loss show?",
    description: "It shows income and expenses for the period you picked. In Crossroads Books, a job’s revenue and direct costs are grouped on the event date. Open a line to see how its total was built.",
    link: { href: "/app/books", label: "See profit and loss" },
  },
  transactions: {
    title: "What does sorting a transaction do?",
    description: "Sorting tells Books what a bank line represents. You can choose a category, match a customer payment to its job, or mark money moved between your own accounts as a transfer.",
    link: { href: "/app/transactions", label: "Open transactions" },
  },
  accounts: {
    title: "What are the trial balance and account register?",
    description: "The trial balance lists the accounts with posted activity through the date you choose. Open any account to see its individual entries and running balance.",
    link: { href: "/app/books/accounts", label: "Open trial balance" },
  },
  reconciliation: {
    title: "What should match the bank?",
    description: "The bank check on Books compares connected bank balances with the amounts recorded in the ledger. Look at the same account and check the displayed difference before moving on.",
    link: { href: "/app/books", label: "See the bank check" },
  },
  tieOut: {
    title: "What does tie-out mean?",
    description: "Tie-out compares a ledger total with the detailed list behind it, such as the deposits still held for individual jobs. The screen shows the difference and links to the underlying detail.",
    link: { href: "/app/books/tie-out", label: "Open tie-out" },
  },
  close: {
    title: "What does closing a month do?",
    description: "The close screen puts the month’s checks in one place. Use it to see what still needs review before you close the selected period.",
    link: { href: "/app/books/close", label: "Open month-end close" },
  },
  expenses: {
    title: "When do expense reports show in Books?",
    description: "Approved expense reports feed into Books. Open a report to see what was submitted and check the attached evidence.",
    link: { href: "/app/books/expenses", label: "Open expense reports" },
  },
  audit: {
    title: "Where can I trace a change?",
    description: "The audit log records supported bookkeeping actions. The pre-audit page brings reports and evidence together for a review of a selected period.",
    link: { href: "/app/books/audit", label: "Open the audit log" },
  },
} as const;

export type BooksHelpTopic = keyof typeof BOOKS_HELP;
