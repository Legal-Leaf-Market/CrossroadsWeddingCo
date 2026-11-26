import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import JournalPreflight from "@/components/account/JournalPreflight";
import { getBooksWorkspace } from "@/lib/auth";
import { INDUSTRY_BASELINES, SHARED_ACCOUNTS } from "@/lib/books/industry-baselines";
import { accountsMeta } from "@/lib/books/subledger";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Journal import preflight", robots: { index: false, follow: false } };

export default async function JournalImportPage() {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const accounts = await accountsMeta(ws.tenant.id);

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/books" className="text-sm font-semibold text-terracotta-dark underline">Books</Link>
      <h1 className="mt-2 text-2xl text-charcoal">Journal import preflight</h1>
      <p className="mt-1 text-sm text-ink/70">
        Map a QuickBooks export or another journal to this template, then check it before migration.
        The file stays in this browser. This check does not post entries or validate closed periods and imports already on file.
      </p>
      <JournalPreflight accountCodes={accounts.map((account) => account.code)} />
      <details className="mt-5 rounded-2xl border border-parchment bg-white p-4">
        <summary className="cursor-pointer font-semibold text-charcoal">Your chart of accounts</summary>
        {accounts.length ? (
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            {accounts.map((account) => <li key={account.id}>{account.code} · {account.name}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-ink/70">There are no ledger accounts in this workspace yet.</p>}
      </details>
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-charcoal">Industry starter charts</h2>
        <p className="mt-1 text-sm text-ink/70">Use these sample codes and reporting dimensions when planning a new chart or mapping a migration. Previewing a chart leaves your workspace accounts untouched.</p>
        <div className="mt-3 space-y-2">
          {INDUSTRY_BASELINES.map((baseline) => (
            <details key={baseline.name} className="rounded-2xl border border-parchment bg-white p-4">
              <summary className="cursor-pointer font-semibold text-charcoal">{baseline.name}</summary>
              <p className="mt-2 text-sm text-ink/70">Suggested dimensions: {baseline.dimensions.join(", ")}</p>
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {[...SHARED_ACCOUNTS, ...baseline.accounts]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([code, name]) => <li key={code}>{code} · {name}</li>)}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </AccountShell>
  );
}
