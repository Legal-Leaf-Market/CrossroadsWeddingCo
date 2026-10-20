import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContractView from "@/components/hub/ContractView";
import PrintButton from "@/components/hub/PrintButton";
import { contractSectionsForWedding, contractVersionForWedding } from "@/lib/contract";
import { getWeddingByToken } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your agreement",
  robots: { index: false, follow: false },
};

export default async function ContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) notFound();

  const sections = contractSectionsForWedding(wedding);

  return (
    <div className="min-h-screen bg-cream p-6 text-charcoal print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between print:hidden">
          <a
            href={`/hub/${token}`}
            className="text-sm font-semibold text-terracotta hover:text-terracotta-dark"
          >
            Back to your hub
          </a>
          <PrintButton />
        </div>
        <header className="mt-4 border-b-2 border-charcoal pb-3">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl font-bold">Service agreement</h1>
          <p className="mt-1 text-sm text-ink/70">
            {wedding.coupleNames} · {formatEventDate(wedding.eventDate)} · {wedding.venueName}
          </p>
        </header>
        <div className="mt-6">
          <ContractView
            sections={sections}
            endpoint={`/api/hub/${token}/contract`}
            acceptedAt={wedding.contractAcceptedAt ? wedding.contractAcceptedAt.toISOString() : null}
            acceptedName={wedding.contractAcceptedName}
            coupleNames={wedding.coupleNames}
            countersigned={
              wedding.contractCountersignedAt && wedding.contractCountersignedName
                ? {
                    name: wedding.contractCountersignedName,
                    at: wedding.contractCountersignedAt.toISOString(),
                  }
                : null
            }
            countersignedTitle={wedding.contractCountersignedTitle}
            version={contractVersionForWedding(wedding)}
          />
        </div>
      </div>
    </div>
  );
}
