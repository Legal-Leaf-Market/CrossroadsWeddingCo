import { NextResponse, type NextRequest } from "next/server";
import { getBooksWorkspace } from "@/lib/auth";
import { generalLedgerCsv, postBankLedger } from "@/lib/books/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateParam(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01";
}

export async function GET(req: NextRequest) {
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const range = dateParam(from) && dateParam(to) && from <= to ? { from, to } : undefined;
  if ((from !== null || to !== null) && !range) {
    return NextResponse.json({ error: "Choose a valid start and end date." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  await postBankLedger(ws.tenant.id); // export what the bank lines say right now, not a stale journal
  const csv = await generalLedgerCsv(ws.tenant.id, range);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="general-ledger-${range ? `${range.from}-to-${range.to}` : day}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
