import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import ReviewQueue from "@/components/account/ReviewQueue";
import { getCustomerWorkspace } from "@/lib/auth";
import { REVIEW_STATUSES, type CategoryKind, type ReviewStatus } from "@/lib/books/categories";
import { ensureDefaultCategories, listCategories, listQueue, queueCounts } from "@/lib/books/review";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Transactions | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "unreviewed", label: "To sort" },
  { key: "categorized", label: "Sorted" },
  { key: "excluded", label: "Not business" },
];
const LIMIT = 200;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ws = await getCustomerWorkspace();
  if (!ws) redirect("/login");
  const { view: raw } = await searchParams;
  const view: ReviewStatus = (REVIEW_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as ReviewStatus) : "unreviewed";

  let loadFailed = false;
  let data: {
    counts: Awaited<ReturnType<typeof queueCounts>>;
    items: Awaited<ReturnType<typeof listQueue>>;
    categories: Awaited<ReturnType<typeof listCategories>>;
  } | null = null;
  try {
    await ensureDefaultCategories(ws.tenant.id);
    const [counts, items, categories] = await Promise.all([
      queueCounts(ws.tenant.id),
      listQueue(ws.tenant.id, view, LIMIT),
      listCategories(ws.tenant.id),
    ]);
    data = { counts, items, categories };
  } catch (err) {
    console.error("[books] transactions page failed:", err instanceof Error ? err.message : err);
    loadFailed = true;
  }
  const total = data ? data.counts.unreviewed + data.counts.categorized + data.counts.excluded : 0;

  return (
    <AccountShell signedIn>
      <Link href="/app" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Workspace
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl text-charcoal">Transactions</h1>
          <p className="mt-2 max-w-xl text-ink/70">
            Sort each bank line into what it is. Sorted lines post to your Books once the bank clears them.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/app/transactions/rules" className="text-ink/70 hover:text-terracotta-dark">
            Categories and rules
          </Link>
          {total > 0 && (
            <a href="/api/app/transactions/export" className="text-ink/70 hover:text-terracotta-dark">
              Download CSV
            </a>
          )}
        </div>
      </div>

      {loadFailed || !data ? (
        <p className="mt-8 text-sm text-ink/70">We couldn&apos;t load your transactions just now. Refresh in a minute.</p>
      ) : total === 0 ? (
        <div className="mt-8 rounded-2xl border border-parchment bg-white p-6 text-sm text-ink/70">
          <p>No bank transactions yet.</p>
          <p className="mt-2">
            <Link href="/app/integrations" className="font-semibold text-terracotta-dark hover:underline">
              Connect a bank or card
            </Link>{" "}
            and they show up here to sort.
          </p>
        </div>
      ) : (
        <>
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Transaction views">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "unreviewed" ? "/app/transactions" : `/app/transactions?view=${t.key}`}
                aria-current={t.key === view ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  t.key === view ? "bg-charcoal text-cream" : "border border-parchment bg-white text-ink/70 hover:border-terracotta"
                }`}
              >
                {t.label} <span className="tabular-nums opacity-70">{data.counts[t.key]}</span>
              </Link>
            ))}
          </nav>
          {data.items.length === LIMIT && data.counts[view] > LIMIT && (
            <p className="mt-3 text-sm text-ink/60">
              Showing the first {LIMIT} of {data.counts[view]}. Sort these and the next ones appear.
            </p>
          )}
          <ReviewQueue
            key={view}
            view={view}
            items={data.items}
            categories={data.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind as CategoryKind }))}
          />
        </>
      )}
    </AccountShell>
  );
}
