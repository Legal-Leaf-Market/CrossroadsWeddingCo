import type { CategoryKind } from "./categories";

const records = { label: "IRS business recordkeeping", href: "https://www.irs.gov/publications/p583" };

export function treatmentGuidance(category: { kind: CategoryKind; name: string }, amountCents: number) {
  const incoming = amountCents > 0;
  switch (category.kind) {
    case "income":
      return {
        financial: incoming ? "Increases income and reported profit." : "Reduces income and reported profit.",
        managerial: "Changes reported revenue. Add the customer, event, or sales context in the note.",
        tax: "Verify what the payment represents and when it belongs in income. A customer deposit, refund, or repayment may need different treatment.",
        source: records,
      };
    case "transfer":
      return {
        financial: "Posts to transfers in transit with no direct effect on profit.",
        managerial: "Changes cash or card balances. Match the other account’s movement so it can clear.",
        tax: "Moving money between accounts of the same business generally creates no revenue or deduction. Verify ownership and keep both sides of the transfer.",
        source: records,
      };
    case "equity":
      return {
        financial: "Changes owner equity with no direct effect on reported profit.",
        managerial: "Tracks owner activity separately from operating performance.",
        tax: "Confirm whether this is a contribution, draw, distribution, pay, or loan. The entity and purpose can change how it is reported.",
        source: records,
      };
    case "expense": {
      const name = category.name.trim().toLowerCase();
      const travel = ["meals", "travel", "vehicle and fuel"].includes(name);
      const equipment = name === "gear and equipment";
      const tax = travel
        ? "Keep the receipt and record the business purpose. Meals, travel, and vehicle costs can have different limits and documentation rules."
        : equipment
          ? "Equipment may need to be recorded as an asset and depreciated. Confirm the asset details, business use, and placed-in-service date before deciding."
          : incoming
            ? "Check that the credit relates to the original expense. Its effect can depend on the original treatment and reporting period."
            : "Keep the receipt and record the business purpose. Deductibility depends on the expense, business use, and applicable tax rules.";
      return {
        financial: incoming ? "Reduces the selected expense and increases reported profit." : "Increases the selected expense and reduces reported profit.",
        managerial: "Changes spend and margin reports. Add the job or department in the note when relevant.",
        tax,
        source: travel
          ? { label: "IRS travel, meals and vehicle guidance", href: "https://www.irs.gov/publications/p463" }
          : equipment
            ? { label: "IRS depreciation guidance", href: "https://www.irs.gov/publications/p946" }
            : records,
      };
    }
  }
}
