import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CountersignForm from "@/components/admin/CountersignForm";
import SignatureBlock from "@/components/contract/SignatureBlock";
import { COMPASS_FULL_NAME, COMPASS_SIGNER_TITLE } from "@/lib/compass";
import { formatEventDate } from "@/lib/hub-constants";
import { loadForSigning } from "@/lib/officiant-sign";
import { officiantDetails, officiantSections, officiantVersion } from "@/lib/service-agreements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign as officiant",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The officiant's own page (lib/officiant-sign.ts): one wedding's Compass
// Events officiant agreement and one thing to do with it. It says in the first
// line which agreement this is, because a couple who books DJ and officiant has
// two, and the DJ one is signed by Crossroads, not by the officiant.
export default async function OfficiantSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await loadForSigning(token);
  if (!found) notFound();
  const { wedding, agreement: a } = found;
  const d = officiantDetails(a);
  const first = d.officiantName.trim().split(/\s+/)[0] || "Officiant";

  const state = a.countersignedAt ? "signed" : a.acceptedAt ? "ready" : "first";

  return (
    <div className="min-h-screen bg-cream px-4 py-8 text-charcoal sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border-2 border-terracotta bg-white p-5">
          <p className="text-sm font-semibold text-terracotta">{COMPASS_FULL_NAME}</p>
          <h1 className="mt-1 text-2xl font-bold">
            {state === "signed" ? `Signed. Thank you, ${first}.` : `${first}, sign here as the officiant`}
          </h1>
          <p className="mt-2 text-sm text-ink/80">
            This is the <strong>officiant agreement</strong> for {wedding.coupleNames}, {formatEventDate(wedding.eventDate)}{" "}
            at {wedding.venueName}. It is the only thing on this page. The couple&apos;s DJ agreement with Crossroads is
            separate and is not signed here.
          </p>
          <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm text-ink">
            {state === "signed" &&
              (a.acceptedAt
                ? "Both signatures are on it. The couple got an email saying you signed, and their copy in the planning hub shows your signature."
                : "Your signature is on it. The couple got an email saying you signed, and they accept it from their planning hub. The terms are locked now.")}
            {state === "ready" && "The couple has accepted. Scroll to the bottom, type your name, tick the box and press Sign agreement."}
            {state === "first" &&
              "The couple hasn't accepted yet, and that's fine: you can sign first. Scroll to the bottom, type your name, tick the box and press Sign agreement. Once you sign, the terms are locked and the couple accepts exactly this."}
          </p>
        </div>

        <article className="space-y-6 rounded-2xl bg-white p-5">
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

        {state !== "signed" && (
          <CountersignForm
            adminKey=""
            weddingId={wedding.id}
            endpoint={`/api/sign/officiant/${token}`}
            companyName={COMPASS_FULL_NAME}
            defaultName={d.officiantName}
            defaultTitle={COMPASS_SIGNER_TITLE}
          />
        )}
      </div>
    </div>
  );
}
