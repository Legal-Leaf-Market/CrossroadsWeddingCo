import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CountersignForm from "@/components/admin/CountersignForm";
import OfficiantInvoice from "@/components/compass/OfficiantInvoice";
import OfficiantPaymentButton from "@/components/compass/OfficiantPaymentButton";
import OfficiantSetupForm from "@/components/compass/OfficiantSetupForm";
import SignatureBlock from "@/components/contract/SignatureBlock";
import PrintButton from "@/components/hub/PrintButton";
import { adminKeyMatches, getAdminWeddingRow } from "@/lib/admin";
import {
  COMPASS_FULL_NAME,
  COMPASS_SIGNER_TITLE,
  OFFICIANT_BALANCE_HOURS,
  OFFICIANT_DEFAULT_NAME,
  OFFICIANT_DEPOSIT_USD,
  OFFICIANT_USD,
} from "@/lib/compass";
import { formatEventDate } from "@/lib/hub-constants";
import { officiantSignUrl } from "@/lib/officiant-sign";
import { getOfficiantAgreement, officiantDetails, officiantSections, officiantVersion } from "@/lib/service-agreements";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Officiant agreement",
  robots: { index: false, follow: false },
};

// The owner's copy of a couple's officiating agreement (Compass Events): set
// it up, copy the hub link to send, sign for Compass Events, mark payments.
export default async function AdminOfficiantPage({
  params,
}: {
  params: Promise<{ key: string; weddingId: string }>;
}) {
  const { key, weddingId } = await params;
  if (!adminKeyMatches(key)) notFound();
  const wedding = await getAdminWeddingRow(weddingId);
  if (!wedding) notFound();
  const a = await getOfficiantAgreement(wedding.id);
  const endpoint = `/api/admin/${encodeURIComponent(key)}/officiant/${wedding.id}`;
  const d = a ? officiantDetails(a) : null;
  const hubLink = `${SITE_URL.replace(/\/$/, "")}/hub/${wedding.accessToken}/officiant`;
  const signLink = officiantSignUrl(wedding.id);

  return (
    <div className="min-h-screen bg-cream p-6 text-charcoal print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <a href={`/admin/${key}`} className="text-sm font-semibold text-terracotta hover:text-terracotta-dark">
            Back to bookings
          </a>
          {a && <PrintButton maskPath="/officiant-agreement" />}
        </div>

        <header className="border-b-2 border-charcoal pb-3">
          <p className="text-sm font-semibold text-terracotta">{COMPASS_FULL_NAME}</p>
          <h1 className="text-2xl font-bold">Officiant agreement</h1>
          <p className="mt-1 text-sm text-ink/70">
            {wedding.coupleNames} · {formatEventDate(wedding.eventDate)} · {wedding.venueName}
          </p>
        </header>

        {a && (
          <div className="rounded-2xl border border-parchment bg-white p-5 text-sm print:hidden">
            <p className="font-semibold text-charcoal">Send the couple this link (to accept)</p>
            <p className="mt-1 break-all font-mono text-ink/80">{hubLink}</p>
            <p className="mt-2 text-ink/60">
              It opens inside their existing planning hub. It&apos;s their private hub key, so send it only to them.
              Status:{" "}
              {a.countersignedAt
                ? "signed by both."
                : a.acceptedAt
                  ? "accepted by the couple; sign below."
                  : "waiting for the couple to accept."}
            </p>
            {!d?.credential && (
              <p className="mt-2 rounded-lg bg-gold/15 px-3 py-2 text-ink">
                No officiant authorization is filled in. Before the ceremony, confirm the officiant is legally able to
                solemnize marriages in Indiana (IC 31-11-6-1) and add how, so it prints on the agreement.
              </p>
            )}
          </div>
        )}

        {a && signLink && (
          <div className="rounded-2xl border-2 border-terracotta bg-white p-5 text-sm print:hidden">
            <p className="font-semibold text-charcoal">Send {d?.officiantName ?? "the officiant"} this link to sign</p>
            <p className="mt-1 break-all font-mono text-ink/80">{signLink}</p>
            <p className="mt-2 text-ink/60">
              It opens only this officiant agreement, with a sign box once the couple has accepted. No dashboard
              access comes with it. When it is signed, the couple gets an email saying so.
            </p>
          </div>
        )}

        {!a?.acceptedAt && (
          <OfficiantSetupForm
            endpoint={endpoint}
            exists={Boolean(a)}
            initial={{
              officiantName: d?.officiantName ?? OFFICIANT_DEFAULT_NAME,
              credential: d?.credential ?? "",
              rehearsal: d?.rehearsal ?? "",
              notes: d?.notes ?? "",
              feeUsd: a ? Number(a.feeUsd) : OFFICIANT_USD,
              depositUsd: a ? Number(a.depositUsd) : OFFICIANT_DEPOSIT_USD,
              balanceDueHours: a?.balanceDueHours ?? OFFICIANT_BALANCE_HOURS,
            }}
          />
        )}

        {a && d && (
          <>
            <article className="space-y-6">
              {officiantSections(a, wedding).map((section) => (
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
              client={a.acceptedAt && a.acceptedName ? { name: a.acceptedName, at: a.acceptedAt.toISOString() } : null}
              company={
                a.countersignedAt && a.countersignedName
                  ? { name: a.countersignedName, at: a.countersignedAt.toISOString() }
                  : null
              }
              companyTitle={a.countersignedTitle}
              version={officiantVersion(a)}
              companyName={COMPASS_FULL_NAME}
            />

            {a.acceptedAt && !a.countersignedAt && (
              <CountersignForm
                adminKey={key}
                weddingId={wedding.id}
                endpoint={endpoint}
                companyName={COMPASS_FULL_NAME}
                defaultName={d.officiantName}
                defaultTitle={COMPASS_SIGNER_TITLE}
              />
            )}

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
              actions={(part, paid) => <OfficiantPaymentButton endpoint={endpoint} part={part} paid={paid} />}
            />
          </>
        )}
      </div>
    </div>
  );
}
