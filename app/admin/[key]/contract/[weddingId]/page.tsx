import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CountersignForm from "@/components/admin/CountersignForm";
import SignatureBlock from "@/components/contract/SignatureBlock";
import PrintButton from "@/components/hub/PrintButton";
import { adminKeyMatches, getAdminWeddingRow } from "@/lib/admin";
import { contractSectionsForWedding, contractVersionForWedding } from "@/lib/contract";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agreement",
  robots: { index: false, follow: false },
};

// The owner's copy of a couple's agreement: the exact accepted text, both
// signatures, the countersign box, and a print button. This is the page the
// hard copy handed to a couple is printed from.
export default async function AdminContractPage({
  params,
}: {
  params: Promise<{ key: string; weddingId: string }>;
}) {
  const { key, weddingId } = await params;
  if (!adminKeyMatches(key)) notFound();
  const wedding = await getAdminWeddingRow(weddingId);
  if (!wedding) notFound();

  const sections = contractSectionsForWedding(wedding);
  const client =
    wedding.contractAcceptedAt && wedding.contractAcceptedName
      ? { name: wedding.contractAcceptedName, at: wedding.contractAcceptedAt.toISOString() }
      : null;
  const company =
    wedding.contractCountersignedAt && wedding.contractCountersignedName
      ? { name: wedding.contractCountersignedName, at: wedding.contractCountersignedAt.toISOString() }
      : null;

  return (
    <div className="min-h-screen bg-cream p-6 text-charcoal print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between print:hidden">
          <a
            href={`/admin/${key}`}
            className="text-sm font-semibold text-terracotta hover:text-terracotta-dark"
          >
            Back to bookings
          </a>
          {/* The admin key is in this URL; print headers must never show it. */}
          <PrintButton maskPath="/agreement" />
        </div>

        {!client && (
          <p className="mt-4 rounded-xl bg-gold/15 px-4 py-3 text-sm text-ink print:hidden">
            The couple hasn&apos;t accepted this agreement in their hub yet. You can print it for
            pen signatures, or wait for them to accept and then sign here.
          </p>
        )}

        <header className="mt-4 border-b-2 border-charcoal pb-3">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl font-bold">Service agreement</h1>
          <p className="mt-1 text-sm text-ink/70">
            {wedding.coupleNames} · {formatEventDate(wedding.eventDate)} · {wedding.venueName}
          </p>
        </header>

        <article className="mt-6 space-y-6">
          {sections.map((section) => (
            <section key={section.heading} className="break-inside-avoid">
              <h2 className="text-lg font-semibold text-charcoal">{section.heading}</h2>
              <div className="mt-2 space-y-2">
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink/80">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <SignatureBlock
          coupleNames={wedding.coupleNames}
          client={client}
          company={company}
          companyTitle={wedding.contractCountersignedTitle}
          version={contractVersionForWedding(wedding)}
        />

        {client && !company && <CountersignForm adminKey={key} weddingId={wedding.id} />}
      </div>
    </div>
  );
}
