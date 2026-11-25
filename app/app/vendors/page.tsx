import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import VendorForm from "@/components/account/VendorForm";
import { getBooksWorkspace } from "@/lib/auth";
import { VENDOR_KIND_LABEL, type VendorKind } from "@/lib/books/vendor-logic";
import { PLATFORM_NAME } from "@/lib/tenant-constants";
import { listVendors, type VendorRow } from "@/lib/vendors";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Vendors | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function Status({ v }: { v: VendorRow }) {
  const y = v.thisYear;
  if (!v.is1099 || !y) return null;
  if (y.status === "over" && !v.w9OnFile)
    return <span className="rounded-full bg-terracotta/15 px-2.5 py-0.5 text-xs font-semibold text-terracotta-dark">1099 due, no W-9</span>;
  if (y.status === "over") return <span className="rounded-full bg-parchment px-2.5 py-0.5 text-xs font-semibold text-charcoal">1099 due</span>;
  if (y.status === "unknown") return <span className="rounded-full bg-parchment px-2.5 py-0.5 text-xs text-ink/70">Check the IRS threshold</span>;
  return null;
}

export default async function VendorsPage() {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  let rows: VendorRow[] | null = null;
  try {
    rows = await listVendors(ws.tenant.id);
  } catch (err) {
    console.error("[vendors] load failed:", err);
  }
  const year = new Date().toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" }).slice(0, 4);

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <h1 className="text-3xl text-charcoal">Vendors</h1>
      <p className="mt-2 text-ink/70">
        The people and companies you pay. Payments are found on your bank feed, and contractors are flagged when they need a
        1099.
      </p>

      <section className="mt-8 rounded-2xl border border-parchment bg-white p-6">
        <h2 className="text-xl text-charcoal">Paid in {year}</h2>
        {!rows ? (
          <p className="mt-3 text-ink/70">Vendors didn&apos;t load just now. Refresh in a minute.</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-ink/70">No vendors yet. Add your second DJs, techs and rental companies below.</p>
        ) : (
          <ul className="mt-4 divide-y divide-parchment">
            {rows.map((v) => (
              <li key={v.id}>
                <Link href={`/app/vendors/${v.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 hover:bg-cream/50">
                  <span className="min-w-0">
                    <span className="block break-words font-semibold text-charcoal">{v.name}</span>
                    <span className="text-xs text-ink/55">{VENDOR_KIND_LABEL[v.kind as VendorKind] ?? v.kind}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    <Status v={v} />
                    <span className="tabular-nums text-charcoal">{usd(v.thisYear?.paidCents ?? 0)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl text-charcoal">Add a vendor</h2>
        <VendorForm />
      </section>
    </AccountShell>
  );
}
