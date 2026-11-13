import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getBooksWorkspace } from "@/lib/auth";
import { auditQuietly } from "@/lib/audit";
import { db } from "@/lib/db";
import { ledgerToday, postBankLedger } from "@/lib/books/ledger";
import { tieOutReport, trialBalance } from "@/lib/books/subledger";
import { csvOf, dollars } from "@/lib/books/subledger-logic";

// Reports out as CSV (2026-11-13, owner principle "ETL first": every feature
// has a way out). The general ledger is /api/app/books/ledger; this adds the
// trial balance, every subledger and the audit log. Each export is audited.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORTS = ["trial-balance", "subledgers", "audit-log"] as const;
type Report = (typeof REPORTS)[number];

export async function GET(req: NextRequest) {
  const ws = await getBooksWorkspace();
  if (!ws) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const params = req.nextUrl.searchParams;
  const report = params.get("report") as Report | null;
  if (!report || !REPORTS.includes(report)) return NextResponse.json({ error: `Pick a report: ${REPORTS.join(", ")}` }, { status: 400 });
  const today = ledgerToday();
  const raw = params.get("asof");
  const asOf = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  const tenantId = ws.tenant.id;
  if (report !== "audit-log") await postBankLedger(tenantId);

  let csv: string;
  if (report === "trial-balance") {
    const tb = await trialBalance(tenantId, asOf);
    csv = csvOf(
      ["As of", "Account code", "Account", "Type", "Debits", "Credits", "Balance"],
      tb.map((a) => [asOf, a.code, a.name, a.type, dollars(a.debit), dollars(a.credit), dollars(a.balance)]),
    );
  } else if (report === "subledgers") {
    const { rows, labels } = await tieOutReport(tenantId, asOf);
    const out: unknown[][] = [];
    for (const r of rows) {
      for (const p of r.parties) out.push([asOf, r.code, r.name, r.by, p.sub, labels.get(p.sub) ?? "", dollars(p.balance)]);
      if (r.unkeyed) out.push([asOf, r.code, r.name, r.by, "", "No subledger key (tie-out difference)", dollars(r.unkeyed)]);
      out.push([asOf, r.code, r.name, r.by, "TOTAL", `General ledger ${dollars(r.control)}, difference ${dollars(r.difference)}`, dollars(r.subledger)]);
    }
    csv = csvOf(["As of", "Account code", "Account", "Kept by", "Key", "Name", "Balance"], out);
  } else {
    const res = await db.execute(sql`
      select id, at::text, actor, action, entity_type, entity_id, reason, cause, before::text as before, after::text as after, prev_hash, hash
      from audit_log where tenant_id = ${tenantId} order by id`);
    const r = res.rows as Record<string, unknown>[];
    csv = csvOf(
      ["Row", "At", "Actor", "Action", "Entity type", "Entity", "Reason", "Cause", "Before", "After", "Previous hash", "Hash"],
      r.map((x) => [x.id, x.at, x.actor, x.action, x.entity_type, x.entity_id, x.reason, x.cause, x.before, x.after, x.prev_hash, x.hash]),
    );
  }
  await auditQuietly({ tenantId, actor: ws.user.email, action: "report.export", entityType: "report", entityId: report, after: { asOf } });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report}-${asOf}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
