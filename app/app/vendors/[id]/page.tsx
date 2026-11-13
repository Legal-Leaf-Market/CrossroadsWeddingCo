import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import VendorForm from "@/components/account/VendorForm";
import { getBooksWorkspace } from "@/lib/auth";
import { PLATFORM_NAME } from "@/lib/tenant-constants";
import { getVendor } from "@/lib/vendors";
import { liveEntriesFor } from "@/lib/books/subledger";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Vendor | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const data = await getVendor(ws.tenant.id, (await params).id);
  if (!data) notFound();
  const { vendor: v, years, payments } = data;
  // The vendor subledger's drill-down: each payment opens the journal entry it posted.
  const entries = await liveEntriesFor(ws.tenant.id, payments.map((p) => `bank_transaction:${p.id}`));

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/vendors" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; All vendors
      </Link>
      <h1 className="mt-3 break-words text-3xl text-charcoal">{v.name}</h1>

      <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
        <h2 className="text-xl text-charcoal">Paid by year</h2>
        {years.length === 0 ? (
          <p className="mt-3 text-ink/70">
            No payments found yet. If you&apos;ve paid them, check how they show up on your bank statement below.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-ink/55">
                  <th className="pb-2 font-medium">Year</th>
                  <th className="pb-2 text-right font-medium">From the bank</th>
                  <th className="pb-2 text-right font-medium">By card</th>
                  <th className="pb-2 text-right font-medium">1099 line</th>
                  {v.is1099 && <th className="pb-2 text-right font-medium">1099-NEC</th>}
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year} className="border-t border-parchment tabular-nums">
                    <td className="py-2 font-semibold text-charcoal">{y.year}</td>
                    <td className="py-2 text-right">{usd(y.bankPaidCents)}</td>
                    <td className="py-2 text-right">{usd(y.cardPaidCents)}</td>
                    <td className="py-2 text-right">{y.thresholdCents === null ? "Not published yet" : usd(y.thresholdCents)}</td>
                    {v.is1099 && (
                      <td className={`py-2 text-right font-semibold ${y.status === "over" ? "text-terracotta-dark" : "text-ink/70"}`}>
                        {y.status === "over" ? (v.w9OnFile ? "Due" : "Due, get a W-9") : y.status === "unknown" ? "Check" : "Not yet"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink/55">
          A 1099-NEC counts payments from your bank (check, ACH, Zelle). Card payments are reported by the card company on a
          1099-K, so they don&apos;t count here. Have your accountant confirm before you file.
        </p>
      </section>

      {payments.length > 0 && (
        <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
          <h2 className="text-xl text-charcoal">Payments found</h2>
          <ul className="mt-3 divide-y divide-parchment text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0 break-words text-charcoal">
                  {entries.get(`bank_transaction:${p.id}`) ? (
                    <Link href={`/app/books/entries/${entries.get(`bank_transaction:${p.id}`)}`} className="underline decoration-parchment underline-offset-2 hover:text-terracotta">
                      {p.merchant || p.description}
                    </Link>
                  ) : (
                    <>{p.merchant || p.description}</>
                  )}{" "}
                  <span className="text-ink/50">· {p.accountType === "credit" ? "card" : "bank"}</span>
                  {!entries.get(`bank_transaction:${p.id}`) && <span className="text-ink/50"> · not in the books yet (sort it)</span>}
                </span>
                <span className="flex gap-3 text-ink/60">
                  <span>{p.postedDate}</span>
                  <span className="tabular-nums text-charcoal">{usd(-p.amountCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-xl text-charcoal">Details</h2>
        <VendorForm
          vendorId={v.id}
          initial={{
            name: v.name,
            kind: v.kind,
            email: v.email ?? "",
            phone: v.phone ?? "",
            matchText: v.matchText,
            is1099: v.is1099,
            w9OnFile: v.w9OnFile,
            notes: v.notes,
          }}
        />
      </section>
    </AccountShell>
  );
}
