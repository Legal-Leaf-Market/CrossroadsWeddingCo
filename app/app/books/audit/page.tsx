import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, type SQL } from "drizzle-orm";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { verifyAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// The audit log (2026-11-13): every change to anything that carries money,
// before and after every cutoff. Append-only and hash-chained in the
// database; "Chain" re-walks every hash on each visit.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Audit log | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

function short(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = JSON.stringify(v);
  return s.length > 400 ? `${s.slice(0, 400)}...` : s;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; id?: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { type, id } = await searchParams;
  const conds: SQL[] = [eq(auditLog.tenantId, ws.tenant.id)];
  if (type) conds.push(eq(auditLog.entityType, type.slice(0, 40)));
  if (id) conds.push(eq(auditLog.entityId, id.slice(0, 80)));
  const [rows, chain] = await Promise.all([
    db.select().from(auditLog).where(and(...conds)).orderBy(desc(auditLog.id)).limit(300),
    verifyAudit(ws.tenant.id),
  ]);

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Books
      </Link>
      <h1 className="mt-2 text-2xl text-charcoal">Audit log</h1>
      <p className="mt-1 text-sm text-ink/60">
        Who changed what, when, from what to what, and why. Nothing here can be edited or removed, by anyone, including the app.
      </p>
      <p className={`mt-3 rounded-xl border p-3 text-sm ${chain.brokenAt ? "border-terracotta bg-white text-terracotta-dark" : "border-parchment bg-white text-sage-dark"}`}>
        {chain.brokenAt ? `Chain broken at row ${chain.brokenAt}: ${chain.why}` : `Chain intact: all ${chain.rows.toLocaleString("en-US")} rows check out.`}
      </p>
      {(type || id) && (
        <p className="mt-2 text-sm">
          Showing {type} {id}.{" "}
          <Link href="/app/books/audit" className="text-terracotta underline">
            Show everything
          </Link>
        </p>
      )}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-parchment bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-parchment text-ink/55">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">What</th>
              <th className="px-3 py-2 font-medium">On</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-parchment/60 align-top last:border-0">
                <td className="px-3 py-2 tabular-nums text-ink/50">{r.id}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink/70">{r.at.toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}</td>
                <td className="px-3 py-2 text-charcoal">{r.actor}</td>
                <td className="px-3 py-2 font-semibold text-charcoal">{r.action}</td>
                <td className="px-3 py-2">
                  <Link href={`/app/books/audit?type=${encodeURIComponent(r.entityType)}${r.entityId ? `&id=${encodeURIComponent(r.entityId)}` : ""}`} className="text-terracotta underline">
                    {r.entityType}
                    {r.entityId ? ` ${r.entityId.slice(0, 12)}` : ""}
                  </Link>
                </td>
                <td className="max-w-[420px] break-words px-3 py-2 text-ink/70">
                  {r.reason && <span className="block">Why: {r.reason}</span>}
                  {r.cause && <span className="block">Cause: {r.cause}</span>}
                  {r.before != null && <span className="block">Before: {short(r.before)}</span>}
                  {r.after != null && <span className="block">After: {short(r.after)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AccountShell>
  );
}
