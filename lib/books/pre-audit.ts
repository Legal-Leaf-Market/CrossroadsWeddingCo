import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseClaims, receipts } from "@/lib/db/schema";
import { ledgerToday } from "@/lib/books/ledger";

export function preAuditRange(raw: unknown) {
  const today = ledgerToday();
  const currentYear = Number(today.slice(0, 4));
  const parsed = typeof raw === "string" && /^\d{4}$/.test(raw) ? Number(raw) : currentYear;
  const year = parsed >= 1900 && parsed <= currentYear ? parsed : currentYear;
  return { currentYear, year, from: `${year}-01-01`, through: year === currentYear ? today : `${year}-12-31` };
}

export function preAuditReports({ from, through }: ReturnType<typeof preAuditRange>) {
  return [
    ["Trial balance CSV", `/api/app/books/export?report=trial-balance&asof=${through}`],
    ["General ledger CSV", `/api/app/books/ledger?from=${from}&to=${through}`],
    ["Subledger CSV", `/api/app/books/export?report=subledgers&asof=${through}`],
    ["Control account tie-out", `/app/books/tie-out?asof=${through}`],
    ["CPA comparison worksheet", `/api/app/books/export?report=cpa-tie-out&asof=${through}`],
    ["Audit log CSV · full history", "/api/app/books/export?report=audit-log"],
    ["Decisions flagged for tax review · full history", "/app/books/audit?tax=flagged"],
    ["Period close evidence", "/app/books/close"],
  ] as const;
}

export const externalEvidence = [
  "Bank and credit-card statements, processor settlement reports, and payroll registers.",
  "Open invoices and vendor bills, service agreements, and deposit support.",
  "Asset invoices and depreciation schedules, tax filings, and prior-year closing entries as applicable.",
] as const;

export async function preAuditEvidence(
  tenantId: string,
  { from, through }: ReturnType<typeof preAuditRange>,
  limit?: number,
  ex: Pick<typeof db, "select"> = db,
) {
  const query = ex.select({
    id: expenseClaims.id,
    day: expenseClaims.spentOn,
    merchant: expenseClaims.merchant,
    description: expenseClaims.description,
    status: expenseClaims.status,
    fileName: receipts.fileName,
    receiptId: receipts.id,
    amountCents: expenseClaims.amountCents,
  }).from(expenseClaims)
    .leftJoin(receipts, and(eq(expenseClaims.receiptId, receipts.id), eq(receipts.tenantId, tenantId)))
    .where(and(eq(expenseClaims.tenantId, tenantId), gte(expenseClaims.spentOn, from), lte(expenseClaims.spentOn, through)))
    .orderBy(asc(expenseClaims.spentOn), asc(expenseClaims.id));
  return limit === undefined ? query : query.limit(limit);
}
