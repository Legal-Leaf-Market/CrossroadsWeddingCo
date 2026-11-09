import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import ConnectionActions from "@/components/account/ConnectionActions";
import PlaidConnect from "@/components/account/PlaidConnect";
import { getBooksWorkspace } from "@/lib/auth";
import { listConnections, recentTransactions, unreviewedCount, type ConnectionView } from "@/lib/integrations/bank-feed";
import { providers } from "@/lib/integrations/registry";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Integrations | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const usd = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS: Record<string, string> = {
  active: "Connected",
  needs_reauth: "Needs you to log in again",
  error: "Last refresh failed",
  disconnected: "Disconnected",
};

export default async function IntegrationsPage() {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  const list = providers();
  const plaid = list.find((p) => p.key === "plaid")!;

  let conns: ConnectionView[] = [];
  let txs: Awaited<ReturnType<typeof recentTransactions>> = [];
  let unreviewed = 0;
  let loadFailed = false;
  try {
    [conns, txs, unreviewed] = await Promise.all([
      listConnections(ws.tenant.id),
      recentTransactions(ws.tenant.id, 15),
      unreviewedCount(ws.tenant.id),
    ]);
  } catch (err) {
    console.error("[integrations] load failed:", err);
    loadFailed = true;
  }

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href={ws.tenant.kind === "house" ? "/app/books" : "/app"} className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; {ws.tenant.kind === "house" ? "Books" : "Workspace"}
      </Link>
      <h1 className="mt-3 text-3xl text-charcoal">Integrations</h1>
      <p className="mt-2 text-ink/70">Connect the services your business already runs on.</p>

      <section className="mt-8 rounded-2xl border border-parchment bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <h2 className="text-xl text-charcoal">{plaid.name}</h2>
            <p className="mt-1 text-sm text-ink/70">{plaid.what}</p>
            {plaid.setupNote && <p className="mt-2 text-sm text-ink/55">{plaid.setupNote}</p>}
          </div>
          {plaid.status === "available" ? (
            <PlaidConnect />
          ) : (
            <span className="rounded-full bg-parchment/70 px-3 py-1 text-xs font-semibold text-ink/60">Not available yet</span>
          )}
        </div>

        {loadFailed ? (
          <p className="mt-6 text-sm text-ink/70">We couldn&apos;t load your connections just now. Refresh in a minute.</p>
        ) : conns.length === 0 ? (
          plaid.status === "available" && <p className="mt-6 text-sm text-ink/60">No accounts connected yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-parchment">
            {conns.map((c) => (
              <li key={c.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal">{c.institutionName ?? "Bank"}</p>
                    <p className={`text-sm ${c.status === "active" ? "text-ink/60" : "font-semibold text-terracotta-dark"}`}>
                      {STATUS[c.status] ?? c.status}
                      {c.lastSyncedAt && c.status === "active"
                        ? ` · refreshed ${new Date(c.lastSyncedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                        : ""}
                    </p>
                  </div>
                  {c.status === "needs_reauth" && plaid.status === "available" ? (
                    <PlaidConnect repair={c.id} />
                  ) : c.status !== "disconnected" && plaid.status === "available" ? (
                    <ConnectionActions id={c.id} institution={c.institutionName ?? "this bank"} />
                  ) : null}
                </div>
                {c.accounts.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-ink/70">
                    {c.accounts.map((a) => (
                      <li key={a.id} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {a.name}
                          {a.mask ? ` ····${a.mask}` : ""}
                          {!a.isActive ? " (off)" : ""}
                        </span>
                        <span className="tabular-nums">{usd(a.currentBalanceCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {txs.length > 0 && (
        <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
          <h2 className="text-xl text-charcoal">Latest transactions</h2>
          <p className="mt-1 text-sm text-ink/60">
            {unreviewed} waiting to be sorted.{" "}
            <Link href="/app/transactions" className="font-semibold text-terracotta-dark hover:underline">
              Sort them
            </Link>
          </p>
          <ul className="mt-4 divide-y divide-parchment text-sm">
            {txs.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0 break-words text-charcoal">
                  {t.merchant || t.description}
                  {t.pending && <span className="ml-2 text-xs text-ink/50">pending</span>}
                </span>
                <span className="flex gap-3 text-ink/60">
                  <span>{t.postedDate}</span>
                  <span className={`tabular-nums ${t.amountCents >= 0 ? "text-charcoal" : ""}`}>{usd(t.amountCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {list
          .filter((p) => p.key !== "plaid")
          .map((p) => (
            <div key={p.key} className="rounded-2xl border border-parchment bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg text-charcoal">{p.name}</h2>
                <span className="rounded-full bg-parchment/70 px-2.5 py-0.5 text-xs font-semibold text-ink/60">Coming</span>
              </div>
              <p className="mt-1 text-sm text-ink/70">{p.what}</p>
            </div>
          ))}
      </section>
    </AccountShell>
  );
}
