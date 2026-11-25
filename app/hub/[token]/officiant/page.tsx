import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContractView from "@/components/hub/ContractView";
import PrintButton from "@/components/hub/PrintButton";
import OfficiantInvoice from "@/components/compass/OfficiantInvoice";
import OfficiantPayButton from "@/components/compass/OfficiantPayButton";
import OfficiantSteps from "@/components/compass/OfficiantSteps";
import { GuideNote, StepGuide } from "@/components/guide/StepGuide";
import { COMPASS_FULL_NAME, COMPASS_NAME, officiantInvoiceParts } from "@/lib/compass";
import { getWeddingByToken } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";
import {
  getOfficiantAgreement,
  officiantCardPaymentsOn,
  officiantDetails,
  officiantPayablePart,
  officiantSections,
  officiantVersion,
} from "@/lib/service-agreements";
import { VENUE_TIME_ZONE } from "@/lib/site";
import { isHouseTenant } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your officiant agreement",
  robots: { index: false, follow: false },
};

// The separate officiating agreement and its two-part invoice, at its own
// link inside the couple's existing hub. 404 until the owner sets one up.
export default async function OfficiantPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string | string[] }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  const wedding = await getWeddingByToken(token);
  if (!wedding || !isHouseTenant(wedding.tenantId)) notFound();
  const a = await getOfficiantAgreement(wedding.id);
  if (!a) notFound();
  const d = officiantDetails(a);

  // Card payments (COMPASS_CARD_PAYMENTS=1): a button beside the one part that
  // can be paid now, or a nudge to accept first. Off, the invoice is exactly
  // as before: cash or check, no control.
  const cardOn = officiantCardPaymentsOn();
  const payable = cardOn ? officiantPayablePart(a) : null;
  const inv = officiantInvoiceParts({
    feeUsd: Number(a.feeUsd),
    depositUsd: Number(a.depositUsd),
    balanceHours: a.balanceDueHours,
    depositPaidAt: null,
    balancePaidAt: null,
  });
  // Indiana calendar date, so the balance step only says "do this now" from the wedding day on.
  const todayIn = new Intl.DateTimeFormat("en-CA", { timeZone: VENUE_TIME_ZONE }).format(new Date());
  const ceremonyDone = String(wedding.eventDate) <= todayIn;
  const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const returnedFromCard = paid === "deposit" || paid === "balance" ? paid : null;
  const stillShowsUnpaid =
    returnedFromCard === "deposit" ? !a.depositPaidAt : returnedFromCard === "balance" ? !a.balancePaidAt : false;

  // The one thing to do now, for the step guide (blur the rest, point at it).
  const depositAmt = usd(inv.parts[0].amount);
  const balanceAmt = usd(inv.parts[1].amount);
  const guideStep = !a.acceptedAt
    ? "sign"
    : !a.depositPaidAt
      ? "pay-deposit"
      : !a.balancePaidAt && ceremonyDone
        ? "pay-balance"
        : "";
  const guideNext =
    guideStep === "sign"
      ? { label: "sign the agreement", href: "#accept" }
      : guideStep === "pay-deposit"
        ? { label: `pay the ${depositAmt} deposit`, href: "#invoice" }
        : guideStep === "pay-balance"
          ? { label: `pay the ${balanceAmt} balance`, href: "#invoice" }
          : undefined;
  const payNote = (amt: string, part: string) =>
    cardOn ? (
      <>
        <p>Last thing for now: the {part}!</p>
        <p className="mt-2">
          Tap the orange <strong>Pay the {amt} {part} by card</strong> button just below. It opens a secure card
          page, and once you pay, it shows up here as received.
        </p>
        <p className="mt-2">Rather pay cash or check? That works too. Just message us in your hub.</p>
      </>
    ) : (
      <>
        <p>Last thing for now: the {amt} {part}.</p>
        <p className="mt-2">Pay us by cash or check. Your invoice is just below, and it shows the payment once we have it.</p>
      </>
    );

  return (
    <StepGuide step={guideStep} next={guideNext}>
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
        <OfficiantSteps
          steps={[
            {
              title: "Read and sign the agreement",
              detail: a.acceptedAt
                ? `Signed by ${a.acceptedName ?? "you"}.`
                : "Read it below, type your name, tick the box and press Accept and continue.",
              state: a.acceptedAt ? "done" : "next",
              href: "#accept",
              cta: "Go to the sign box",
            },
            {
              title: `Pay the ${usd(inv.parts[0].amount)} deposit`,
              detail: a.depositPaidAt
                ? "Received. Thank you."
                : !a.acceptedAt
                  ? "Unlocks once the agreement is signed."
                  : cardOn
                    ? "Pay by card with the button on the invoice below, or pay us by cash or check."
                    : "Pay by cash or check. The invoice is below.",
              state: a.depositPaidAt ? "done" : a.acceptedAt ? "next" : "later",
              href: "#invoice",
              cta: "Go to the invoice",
            },
            {
              title: `Pay the ${usd(inv.parts[1].amount)} balance`,
              detail: a.balancePaidAt
                ? "Received. You're all paid up."
                : ceremonyDone
                  ? `Due within ${a.balanceDueHours} hours after the ceremony.`
                  : `Due within ${a.balanceDueHours} hours after the ceremony. Nothing to do until then.`,
              state: a.balancePaidAt ? "done" : ceremonyDone && payable === "balance" ? "next" : "later",
              href: "#invoice",
              cta: "Go to the invoice",
            },
          ]}
        />
        {returnedFromCard && (
          <p role="status" className="mt-4 rounded-xl border border-sage bg-white p-3 text-sm text-charcoal print:hidden">
            Thank you, your card payment for the {returnedFromCard} went through.
            {stillShowsUnpaid
              ? " It can take a minute to show as received below. Refresh the page if it hasn't yet."
              : " It shows as received below."}
          </p>
        )}
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
            beforeAccept={
              <GuideNote forStep="sign">
                <p>Start here!</p>
                <ol className="mt-2 list-decimal space-y-1 pl-6">
                  <li>Read the agreement above.</li>
                  <li>Type your full name in the box below.</li>
                  <li>Tick the &quot;I agree&quot; box.</li>
                  <li>Press <strong>Accept and continue</strong>.</li>
                </ol>
                <p className="mt-2">Then I&apos;ll show you how to pay the {depositAmt} deposit.</p>
              </GuideNote>
            }
          />
        </div>
        <div id="invoice" className="scroll-mt-6" />
        <GuideNote forStep="pay-deposit">{payNote(depositAmt, "deposit")}</GuideNote>
        <GuideNote forStep="pay-balance">{payNote(balanceAmt, "balance")}</GuideNote>
        <div data-zone="invoice">
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
          cardPayments={cardOn}
          actions={
            cardOn
              ? (part, isPaid) => {
                  if (isPaid) return null;
                  const amount = inv.parts[part === "deposit" ? 0 : 1].amount;
                  if (amount < 0.5) return null;
                  const common = { token, part, amountLabel: usd(amount) };
                  if (part === payable) return <OfficiantPayButton {...common} />;
                  // Not payable yet: show the button greyed out with what unlocks it.
                  if (!a.acceptedAt) {
                    return (
                      <OfficiantPayButton
                        {...common}
                        lockedReason="Sign the agreement above first"
                        lockedHref="#accept"
                      />
                    );
                  }
                  if (part === "balance" && !a.depositPaidAt) {
                    return <OfficiantPayButton {...common} lockedReason="Pay the deposit first" />;
                  }
                  return null;
                }
              : undefined
          }
        />
        </div>
      </div>
    </div>
    </StepGuide>
  );
}
