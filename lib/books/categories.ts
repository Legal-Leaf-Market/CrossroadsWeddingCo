// Client-safe constants for the bank review queue. No database imports here:
// components/ may import this file, and importing lib/books/review.ts from a
// client component would drag pg into the browser bundle (§9.3).

export const CATEGORY_KINDS = ["income", "expense", "transfer", "equity"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const KIND_LABEL: Record<CategoryKind, string> = {
  income: "Money in",
  expense: "Money out",
  transfer: "Moving money",
  equity: "Owner",
};

export const REVIEW_STATUSES = ["unreviewed", "categorized", "excluded"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Starter categories for a wedding and event business, seeded the first time
 * an account opens its review queue. The account can rename, add and archive.
 * tax_line is a Schedule C hint for the owner's accountant, shown as a hint:
 * where the right line depends on facts we do not have (gear can be supplies
 * or depreciation), there is no hint rather than a wrong one.
 */
export const STARTER_CATEGORIES: { name: string; kind: CategoryKind; taxLine: string | null }[] = [
  { name: "Event income", kind: "income", taxLine: "Line 1, gross receipts" },
  { name: "Tips", kind: "income", taxLine: "Line 1, gross receipts" },
  { name: "Other income", kind: "income", taxLine: "Line 6, other income" },
  { name: "Advertising and marketing", kind: "expense", taxLine: "Line 8, advertising" },
  { name: "Vehicle and fuel", kind: "expense", taxLine: "Line 9, car and truck" },
  { name: "Card and payment fees", kind: "expense", taxLine: "Line 10, commissions and fees" },
  { name: "Contractors and second shooters", kind: "expense", taxLine: "Line 11, contract labor" },
  { name: "Insurance", kind: "expense", taxLine: "Line 15, insurance" },
  { name: "Legal and accounting", kind: "expense", taxLine: "Line 17, legal and professional" },
  { name: "Office", kind: "expense", taxLine: "Line 18, office expense" },
  { name: "Gear rental", kind: "expense", taxLine: "Line 20a, rent of equipment" },
  { name: "Gear and equipment", kind: "expense", taxLine: null },
  { name: "Repairs", kind: "expense", taxLine: "Line 21, repairs" },
  { name: "Event supplies", kind: "expense", taxLine: "Line 22, supplies" },
  { name: "Licenses and permits", kind: "expense", taxLine: "Line 23, taxes and licenses" },
  { name: "Travel", kind: "expense", taxLine: "Line 24a, travel" },
  { name: "Meals", kind: "expense", taxLine: "Line 24b, meals" },
  { name: "Phone and internet", kind: "expense", taxLine: "Line 25, utilities" },
  { name: "Software and subscriptions", kind: "expense", taxLine: "Line 27a, other" },
  { name: "Music and licensing", kind: "expense", taxLine: "Line 27a, other" },
  { name: "Refunds to clients", kind: "expense", taxLine: "Line 2, returns and allowances" },
  { name: "Transfer between my accounts", kind: "transfer", taxLine: null },
  { name: "Credit card payment", kind: "transfer", taxLine: null },
  { name: "Owner draw", kind: "equity", taxLine: null },
  { name: "Owner contribution", kind: "equity", taxLine: null },
];


export { normalizeMatchText } from "./logic";
