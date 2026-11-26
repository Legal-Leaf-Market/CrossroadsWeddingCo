import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { getBooksWorkspace } from "@/lib/auth";
import { jobJournalTrail } from "@/lib/books/subledger";
import { formatEventDate } from "@/lib/hub-constants";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Booking journal | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const linkClass = "font-semibold text-terracotta-dark underline underline-offset-2";

export default async function BookingJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const trail = await jobJournalTrail(ws.tenant.id, id);
  if (!trail) notFound();
  const { job, entries } = trail;
  const house = ws.tenant.kind === "house";

  return (
    <AccountShell signedIn house={house}>
      <nav aria-label="Booking journal links" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/app/books" className={linkClass}>Books</Link>
        {!house && <Link href={`/app/bookings/${id}`} className={linkClass}>Booking record</Link>}
        <Link href={`/app/books/audit?booking=${id}`} className={linkClass}>Booking audit history</Link>
      </nav>
      <h1 className="mt-3 break-words text-2xl text-charcoal">{String(job.names)}</h1>
      <p className="mt-1 text-sm text-ink/70">{formatEventDate(String(job.eventDate))}</p>
      <h2 className="mt-6 text-lg font-semibold text-charcoal">Journal entries</h2>
      <p className="mt-1 text-sm text-ink/70">Open a posting to see its debits, credits, source and revisions.</p>
      {entries.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-parchment bg-white p-4 text-sm">No journal entries are linked to this booking.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-parchment bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-parchment text-ink/70">
              <tr>
                <th scope="col" className="px-4 py-2">Posting date</th>
                <th scope="col" className="px-4 py-2">Entry</th>
                <th scope="col" className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-parchment last:border-0">
                  <td className="whitespace-nowrap px-4 py-3">{formatEventDate(entry.date)}</td>
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <Link href={`/app/books/entries/${entry.id}`} className={linkClass}>{entry.memo || "Journal entry"}</Link>
                  </th>
                  <td className="px-4 py-3">
                    <span className="capitalize">{entry.status}</span>
                    {entry.sourceType === "adjustment" && <span className="block text-ink/70">Adjustment{entry.adjustsPeriod ? ` · ${entry.adjustsPeriod.slice(0, 7)}` : ""}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
