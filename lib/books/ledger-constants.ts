// Client-safe ledger constants (docs/FINANCIALS_SPEC.md). No database imports.

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

/** Code ranges per account type. 1900 and 3900 are taken by the two system accounts. */
export const ACCOUNT_RANGES: Record<AccountType, [number, number]> = {
  asset: [1000, 1899],
  liability: [2000, 2999],
  equity: [3000, 3899],
  income: [4000, 4999],
  expense: [6000, 7999],
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: "What you have",
  liability: "What you owe",
  equity: "Owner",
  income: "Income",
  expense: "Expenses",
};

/** Plaid account type to ledger type: cards and loans are owed, everything else is held. */
export function accountTypeForBank(plaidType: string | null | undefined): "asset" | "liability" {
  return plaidType === "credit" || plaidType === "loan" ? "liability" : "asset";
}
