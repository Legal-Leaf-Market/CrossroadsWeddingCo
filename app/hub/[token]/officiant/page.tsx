import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContractView from "@/components/hub/ContractView";
import PrintButton from "@/components/hub/PrintButton";
import OfficiantInvoice from "@/components/compass/OfficiantInvoice";
import { COMPASS_FULL_NAME, COMPASS_NAME } from "@/lib/compass";
import { getWeddingByToken } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";
import { getOfficiantAgreement, officiantDetails, officiantSections, officiantVersion } from "@/lib/service-agreements";
import { isHouseTenant } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your officiant agreement",
  robots: { index: false, follow: false },
};

// The separate officiating agreement and its two-part invoice, at its own
// link inside the couple's existing hub. 404 until the owner sets one up.
export default async function OfficiantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wedding = await getWeddingByToken(token);
  if (!wedding || !isHouseTenant(wedding.tenantId)) notFound();
  const a = await getOfficiantAgreement(wedding.id);
  if (!a) notFound();
  const d = officiantDetails(a);

  return (
    <div className="min-h-screen bg-cream p-6 text-charcoal print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between print:hidden">
          <a href={`/hub/${token}`} className="text-sm font-semibold text-terracotta hover:text-terracotta-dark">
            Back to your hub
          </a>
          <PrintButton maskPath="/hub/officiant" />
        </div>
        <header className="mt-4 border-b-2 border-charcoal pb-3">
          <p className="text-sm font-semibold text-terracotta">{COMPASS_FULL_NAME}</p>
          <h1 className="text-2xl font-bold">Officiant agreement</h1>
          <p className="mt-1 text-sm text-ink/70">
            {wedding.coupleNames} · {formatEventDate(wedding.eventDate)} · {wedding.venueName}
          </p>
        </header>
        <div className="mt-6">
          <ContractView
            sections={officiantSections(a, wedding)}
            endpoint={`/api/hub/${token}/officiant`}
            acceptedAt={a.acceptedAt ? a.acceptedAt.toISOString() : null}
            acceptedName={a.acceptedName}
            coupleNames={wedding.coupleNames}
            countersigned={
              a.countersignedAt && a.countersignedName
                ? { name: a.countersignedName, at: a.countersignedAt.toISOString() }
                : null
            }
            countersignedTitle={a.countersignedTitle}
            version={officiantVersion(a)}
            companyName={COMPASS_FULL_NAME}
            companyShort={COMPASS_NAME}
          />
        </div>
        <OfficiantInvoice
          id={a.id}
          eventDate={wedding.eventDate}
          coupleNames={wedding.coupleNames}
          officiantName={d.officiantName}
          feeUsd={Number(a.feeUsd)}
          depositUsd={Number(a.depositUsd)}
          balanceHours={a.balanceDueHours}
          depositPaidAt={a.depositPaidAt ? a.depositPaidAt.toISOString() : null}
          balancePaidAt={a.balancePaidAt ? a.balancePaidAt.toISOString() : null}
        />
      </div>
    </div>
  );
}
