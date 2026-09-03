import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArchiveButton from "@/components/admin/ArchiveButton";
import { adminKeyMatches, getArchivedWeddings } from "@/lib/admin";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME } from "@/lib/site";

// The other half of archiving: a separate screen, so the dashboard shows only
// live bookings and nothing has to be deleted to get there.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Archived bookings",
  robots: { index: false, follow: false },
};

export default async function ArchivedPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();
  const weddings = await getArchivedWeddings();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Archived bookings</h1>
          <p className="text-sm text-ink/60">
            Hidden from the dashboard, and nothing else. Their hub links, messages and run sheets
            all still work, so restoring one brings back exactly what was there.
          </p>
          <a
            href={`/admin/${key}`}
            className="mt-2 inline-block text-sm font-medium text-terracotta underline decoration-parchment underline-offset-2"
          >
            Back to bookings
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {weddings.length === 0 ? (
          <p className="rounded-2xl border border-parchment bg-white p-5 text-sm text-ink/60">
            Nothing archived. Anything you archive from the dashboard lands here.
          </p>
        ) : (
          <div className="space-y-4">
            {weddings.map((w) => (
              <div key={w.id} className="rounded-2xl border border-parchment bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg text-charcoal">{w.coupleNames}</h2>
                    <p className="text-sm text-ink/70">
                      {formatEventDate(w.eventDate)} &middot; {w.venueName}
                    </p>
                    {w.contactEmail && <p className="text-sm text-ink/50">{w.contactEmail}</p>}
                  </div>
                  <ArchiveButton adminKey={key} weddingId={w.id} archived />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
