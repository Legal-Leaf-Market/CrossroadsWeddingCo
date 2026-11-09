import { NextResponse } from "next/server";
import { getCustomerWorkspace } from "@/lib/auth";
import { generalLedgerCsv, postBankLedger } from "@/lib/books/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await getCustomerWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  await postBankLedger(ws.tenant.id); // export what the bank lines say right now, not a stale journal
  const csv = await generalLedgerCsv(ws.tenant.id);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="general-ledger-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
