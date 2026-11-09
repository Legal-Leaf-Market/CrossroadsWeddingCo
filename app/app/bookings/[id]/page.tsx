import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import ArchiveButton from "@/components/account/ArchiveButton";
import BookingEditor from "@/components/account/BookingEditor";
import CopyLink from "@/components/account/CopyLink";
import { getCustomerWorkspace } from "@/lib/auth";
import { bookingPayments } from "@/lib/books/matching";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_URL } from "@/lib/site";
import { PLATFORM_NAME, bookingStatusLabel, eventTypeLabel } from "@/lib/tenant-constants";
import { getBooking } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Booking | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await getCustomerWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const b = await getBooking(ws.tenant.id, id);
  if (!b) notFound();
  let paid: Awaited<ReturnType<typeof bookingPayments>> | null = null;
  try {
    paid = await bookingPayments(ws.tenant.id, b.id);
  } catch (err) {
    console.error("[books] booking payments failed:", err instanceof Error ? err.message : err);
  }
  const totalCents = Math.round(Number(b.totalAmount) * 100);
  // A deposit marked paid by hand with no deposit matched from the bank was paid in cash or check.
  const outsideCents =
    paid && b.isDepositPaid && !paid.payments.some((p) => p.kind === "deposit") ? Math.round(Number(b.depositAmount) * 100) : 0;
  const creditedCents = (paid?.receivedCents ?? 0) + outsideCents;
  const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  const links = [
    {
      label: "Client planning hub",
      note: "Your client fills in the timeline, music and names here. Anyone with this link can edit, so send it only to them.",
      path: `/hub/${b.accessToken}`,
    },
    { label: "Run sheet", note: "Printable one-pager for you and the venue.", path: `/hub/${b.accessToken}/runsheet` },
    { label: "Live console", note: "Tap Start as each part begins; every later time shifts.", path: `/hub/${b.accessToken}/live` },
    ...(b.shareToken
      ? [
          { label: "Vendor live view", note: "Read-only. Safe to send to the photographer and venue.", path: `/live/${b.shareToken}` },
          { label: "Guest schedule", note: "Times and titles only, for guests.", path: `/schedule/${b.shareToken}` },
        ]
      : []),
  ];

  return (
    <AccountShell signedIn>
      <Link href="/app" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; All bookings
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-3xl text-charcoal">{b.coupleNames}</h1>
          <p className="mt-1 text-ink/70">
            {eventTypeLabel(b.packageType)} · {formatEventDate(b.eventDate)} at {b.venueName}
          </p>
          <p className="mt-1 text-sm font-semibold text-terracotta-dark">
            {bookingStatusLabel(b.status)}
            {b.archivedAt ? " · Archived" : ""}
          </p>
        </div>
        <ArchiveButton bookingId={b.id} archived={Boolean(b.archivedAt)} />
      </div>

      <section className="mt-8 rounded-2xl border border-parchment bg-white p-6">
        <h2 className="text-xl text-charcoal">Links</h2>
        <ul className="mt-4 divide-y divide-parchment">
          {links.map((l) => (
            <li key={l.path} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <a href={l.path} target="_blank" rel="noreferrer" className="font-semibold text-charcoal underline decoration-parchment underline-offset-2 hover:text-terracotta-dark">
                  {l.label}
                </a>
                <p className="text-sm text-ink/60">{l.note}</p>
              </div>
              <CopyLink url={`${SITE_URL}${l.path}`} label={l.label} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
        <h2 className="text-xl text-charcoal">Payments received</h2>
        {!paid ? (
          <p className="mt-2 text-sm text-ink/65">We couldn&apos;t load payments just now.</p>
        ) : paid.payments.length === 0 && outsideCents === 0 ? (
          <p className="mt-2 text-sm text-ink/65">
            None matched yet. When this client&apos;s payment lands in a connected bank account, match it from{" "}
            <Link href="/app/transactions" className="font-semibold text-terracotta-dark hover:underline">
              Transactions
            </Link>
            . Cash and checks you never deposit won&apos;t show here; mark those paid below.
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-parchment text-sm">
              {outsideCents > 0 && (
                <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span className="min-w-0 break-words text-charcoal">
                    Deposit · marked paid by hand
                    <span className="block text-xs text-ink/55">Cash or check, not matched to a bank line</span>
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-800">{usd(outsideCents)}</span>
                </li>
              )}
              {paid.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span className="min-w-0 break-words text-charcoal">
                    {p.kind === "deposit" ? "Deposit" : "Payment"} · {p.label}
                    <span className="block text-xs text-ink/55">
                      {p.postedDate} · {p.accountName}
                      {p.mask ? ` ····${p.mask}` : ""}
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-800">{usd(p.amountCents)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-parchment pt-3 text-sm font-semibold text-charcoal">
              Received {usd(creditedCents)} of {usd(totalCents)}
              {b.isBalancePaid && creditedCents < totalCents
                ? " · marked paid in full"
                : totalCents - creditedCents > 0
                  ? ` · ${usd(totalCents - creditedCents)} still owed`
                  : creditedCents > totalCents
                    ? ` · ${usd(creditedCents - totalCents)} more than the total`
                    : " · paid in full"}
            </p>
          </>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-xl text-charcoal">Details and money</h2>
        <BookingEditor
          bookingId={b.id}
          initial={{
            clientNames: b.coupleNames,
            eventType: b.packageType ?? "wedding",
            eventDate: b.eventDate,
            venueName: b.venueName,
            venueAddress: b.venueAddress ?? "",
            contactEmail: b.contactEmail ?? "",
            contactPhone: b.contactPhone ?? "",
            totalUsd: b.totalAmount,
            depositUsd: b.depositAmount,
            isDepositPaid: b.isDepositPaid ?? false,
            isBalancePaid: b.isBalancePaid ?? false,
            status: b.status,
            notes: b.notes ?? "",
          }}
        />
      </section>
    </AccountShell>
  );
}
