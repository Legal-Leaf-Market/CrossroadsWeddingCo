import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getBooksWorkspace } from "@/lib/auth";
import { externalEvidence, preAuditEvidence, preAuditRange, preAuditReports } from "@/lib/books/pre-audit";
import { csvOf, dollars } from "@/lib/books/subledger-logic";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ws = await getBooksWorkspace();
  const noStore = { "Cache-Control": "no-store" };
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: noStore });
  const raw = req.nextUrl.searchParams.get("year");
  const range = preAuditRange(raw);
  if (raw !== null && raw !== String(range.year)) {
    return NextResponse.json({ error: "Choose a valid review year." }, { status: 400, headers: noStore });
  }

  const items = await preAuditEvidence(ws.tenant.id, range);
  const rows: unknown[][] = preAuditReports(range).map(([title, path]) => [
    "ERP report", "", title, "", "", "Live link", "", `${SITE_URL}${path}`, "",
  ]);
  for (const item of items) {
    rows.push([
      "Expense claim", item.day, item.merchant || "Expense", dollars(item.amountCents), item.status,
      item.receiptId ? "Receipt linked" : "Receipt missing",
      item.description,
      item.receiptId ? `${SITE_URL}/api/app/expenses/${item.id}/receipt` : "",
      `${SITE_URL}/app/books/audit?type=expense_claim&id=${item.id}`,
    ]);
  }
  for (const item of externalEvidence) {
    rows.push(["External evidence", "", item, "", "", "Collect if applicable", "", "", ""]);
  }

  const file = csvOf(
    ["From", "Through", "Section", "Date", "Item", "Amount", "Claim status", "Evidence status", "Notes", "Open source", "Open audit history"],
    rows.map((row) => [range.from, range.through, ...row]),
  );
  await audit(null, {
    tenantId: ws.tenant.id, actor: ws.user.email, action: "report.export", entityType: "report",
    entityId: "pre-audit-index", after: { from: range.from, through: range.through, expenseClaims: items.length },
  });
  return new NextResponse(file, {
    headers: {
      ...noStore,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pre-audit-index-${range.year}.csv"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
