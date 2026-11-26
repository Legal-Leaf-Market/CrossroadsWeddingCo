const SHARED_ACCOUNTS = [
  ["1000", "Operating cash"],
  ["1100", "Accounts receivable"],
  ["2000", "Accounts payable"],
  ["2200", "Sales tax payable"],
  ["3000", "Owner equity"],
  ["4000", "Operating revenue"],
  ["6000", "Operating expenses"],
] as const;

export const INDUSTRY_BASELINES = [
  {
    name: "Professional and field services",
    dimensions: ["Location", "Department", "Customer", "Job", "Service line"],
    accounts: [["1300", "Prepaid job costs"], ["2300", "Client deposits"], ["5000", "Direct job costs"]],
  },
  {
    name: "Retail and e-commerce",
    dimensions: ["Location", "Channel", "Product category", "Supplier"],
    accounts: [["1200", "Inventory"], ["4100", "Merchandise sales"], ["5000", "Cost of goods sold"], ["6100", "Processing fees"]],
  },
  {
    name: "Food and hospitality",
    dimensions: ["Location", "Department", "Sales channel", "Menu category"],
    accounts: [["1200", "Food and beverage inventory"], ["4100", "Food sales"], ["4200", "Beverage sales"], ["5000", "Food and beverage costs"]],
  },
  {
    name: "Weddings and events",
    dimensions: ["Location", "Customer", "Event", "Service line", "Lead source"],
    accounts: [["1050", "Undeposited funds"], ["2300", "Client deposits"], ["2400", "Accrued job costs"], ["2500", "Reimbursements payable"], ["2600", "Commissions payable"], ["4500", "Event revenue"], ["5000", "Direct event costs"], ["5100", "Sales commissions"]],
  },
] as const;

export { SHARED_ACCOUNTS };
