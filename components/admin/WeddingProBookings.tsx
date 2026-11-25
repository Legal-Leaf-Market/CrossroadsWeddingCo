import type { AdminWedding } from "@/lib/admin";
import { formatEventDate } from "@/lib/hub-constants";
import { weddingProReconciliation } from "@/lib/weddingpro-reconciliation";

export default function WeddingProBookings({ weddings }: { weddings: AdminWedding[] }) {
  const rows = weddingProReconciliation(weddings);
  const ready = rows.filter((row) => row.ready).length;

  return (
    <section id="weddingpro-bookings" className="scroll-mt-24">
      <details className="rounded-2xl border border-parchment bg-white p-5">
        <summary className="cursor-pointer text-lg font-semibold text-charcoal">
          WeddingPro reconciliation
          <span className="ml-2 text-sm font-normal text-ink/70">
            {ready} with booking evidence · {rows.length - ready} to review
          </span>
        </summary>
        <p className="mt-3 text-sm text-ink/70">
          Match the couple and event date in WeddingPro before marking the inquiry booked.
          Review source conflicts and missing sources on the booking card.
        </p>
        <a
          href="https://www.weddingpro.com/inbox"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm font-semibold text-terracotta-dark underline"
        >
          Open WeddingPro inbox
        </a>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink/70">No WeddingPro leads or booked weddings with a missing source.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-ink/70">
                <tr>
                  <th scope="col" className="pb-2 pr-4">Couple and venue</th>
                  <th scope="col" className="pb-2 pr-4">Event date</th>
                  <th scope="col" className="pb-2 pr-4">Source</th>
                  <th scope="col" className="pb-2">Crossroads booking evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-parchment align-top">
                    <th scope="row" className="py-2 pr-4 font-medium text-charcoal">
                      <a href={`#booking-${row.id}`} className="underline hover:text-terracotta-dark">
                        {row.coupleNames}
                      </a>
                      <span className="block font-normal text-ink/70">{row.venueName}</span>
                    </th>
                    <td className="whitespace-nowrap py-2 pr-4">{formatEventDate(row.eventDate)}</td>
                    <td className="py-2 pr-4">
                      {row.channel ?? "Source missing"}
                      {row.sourceConflict && <span className="block font-medium text-terracotta-dark">Conflicting source</span>}
                    </td>
                    <td className="py-2">{row.evidence ?? "Inquiry awaiting confirmation"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}
