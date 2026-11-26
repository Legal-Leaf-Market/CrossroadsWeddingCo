import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, lt, sql, type SQL } from "drizzle-orm";
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

const PAGE_SIZE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const linkClass = "text-terracotta-dark underline underline-offset-2";

function auditHref(type?: string, id?: string, before?: number, tax = false) {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (id) query.set("id", id);
  if (before) query.set("before", String(before));
  if (tax) query.set("tax", "flagged");
  const search = query.toString();
  return search ? `/app/books/audit?${search}` : "/app/books/audit";
}

function recordHref(type: string, id: string | null) {
  if (!id || !UUID.test(id)) return null;
  if (type === "job") return `/app/books/jobs/${id}`;
  if (type === "journal_entry") return `/app/books/entries/${id}`;
  return null;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; id?: string | string[]; before?: string | string[]; tax?: string | string[] }>;
}) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const query = await searchParams;
  const type = typeof query.type === "string" ? query.type.slice(0, 40) : undefined;
  const id = typeof query.id === "string" ? query.id.slice(0, 80) : undefined;
  const before = typeof query.before === "string" && /^[1-9][0-9]*$/.test(query.before) ? Number(query.before) : 0;
  const cursor = Number.isSafeInteger(before) ? before : 0;
  const tax = query.tax === "flagged";
  const conds: SQL[] = [eq(auditLog.tenantId, ws.tenant.id)];
  if (type) conds.push(eq(auditLog.entityType, type));
  if (id) conds.push(eq(auditLog.entityId, id));
  if (tax) conds.push(eq(auditLog.action, "bank.treatment_approved"), sql`${auditLog.after}->>'taxReviewRequested' = 'true'`);
  if (cursor > 0) conds.push(lt(auditLog.id, cursor));
  const [records, chain] = await Promise.all([
    db.select().from(auditLog).where(and(...conds)).orderBy(desc(auditLog.id)).limit(PAGE_SIZE + 1),
    verifyAudit(ws.tenant.id),
  ]);
  const rows = records.slice(0, PAGE_SIZE);
  const next = records.length > PAGE_SIZE ? rows.at(-1)?.id : undefined;

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Books
      </Link>
      <h1 className="mt-2 text-2xl text-charcoal">Audit log</h1>
      <p className="mt-1 text-sm text-ink/60">
        See who made each recorded change, when it happened, and its before-and-after values. The application records changes in an append-only log.
      </p>
      <p className={`mt-3 rounded-xl border p-3 text-sm ${chain.brokenAt ? "border-terracotta bg-white text-terracotta-dark" : "border-parchment bg-white text-sage-dark"}`}>
        {chain.brokenAt ? `Chain broken at row ${chain.brokenAt}: ${chain.why}` : `Chain intact: all ${chain.rows.toLocaleString("en-US")} rows check out.`}
      </p>
      <Link href={auditHref(type, id, undefined, !tax)} className={`mt-3 inline-block text-sm ${linkClass}`}>
        {tax ? "Include all audit decisions" : "Show decisions flagged for tax review"}
      </Link>
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
            {rows.map((r) => {
              const record = recordHref(r.entityType, r.entityId);
              return (
                <tr key={r.id} className="border-b border-parchment/60 align-top last:border-0">
                  <td className="px-3 py-2 tabular-nums text-ink/50">{r.id}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink/70">{r.at.toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}</td>
                  <td className="px-3 py-2 text-charcoal">{r.actor}</td>
                  <td className="px-3 py-2 font-semibold text-charcoal">{r.action}</td>
                  <td className="px-3 py-2">
                    <Link href={auditHref(r.entityType, r.entityId ?? undefined)} className={linkClass}>
                      {r.entityType}
                      {r.entityId ? ` ${r.entityId.slice(0, 12)}` : ""}
                    </Link>
                    {record && <Link href={record} className={`mt-1 block ${linkClass}`}>Open record</Link>}
                  </td>
                  <td className="max-w-[420px] break-words px-3 py-2 text-ink/70">
                    {r.reason && <span className="block">Why: {r.reason}</span>}
                    {r.cause && <span className="block">Cause: {r.cause}</span>}
                    {(r.before != null || r.after != null) && (
                      <details className="mt-1">
                        <summary className="cursor-pointer font-semibold">Before and after</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-cream p-2">{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-ink/70">No audit entries match this view.</td></tr>}
          </tbody>
        </table>
      </div>
      {(next || cursor > 0) && (
        <nav aria-label="Audit log pages" className="mt-3 flex gap-4 text-sm">
          {cursor > 0 && <Link href={auditHref(type, id, undefined, tax)} className={linkClass}>Newest entries</Link>}
          {next && <Link href={auditHref(type, id, next, tax)} className={linkClass}>Older entries</Link>}
        </nav>
      )}
    </AccountShell>
  );
}
