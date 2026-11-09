import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import { AddCategory, ArchiveCategory, DeleteRule } from "@/components/account/BooksSettings";
import { getBooksWorkspace } from "@/lib/auth";
import { CATEGORY_KINDS, KIND_LABEL, type CategoryKind } from "@/lib/books/categories";
import { ensureDefaultCategories, listCategories, listRules } from "@/lib/books/review";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Categories and rules | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const DIRECTION: Record<string, string> = { any: "", in: " (money in)", out: " (money out)" };

export default async function RulesPage() {
  const ws = await getBooksWorkspace();
  if (!ws) redirect("/login");
  let loadFailed = false;
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let rules: Awaited<ReturnType<typeof listRules>> = [];
  try {
    await ensureDefaultCategories(ws.tenant.id);
    [categories, rules] = await Promise.all([listCategories(ws.tenant.id, { includeArchived: true }), listRules(ws.tenant.id)]);
  } catch (err) {
    console.error("[books] rules page failed:", err instanceof Error ? err.message : err);
    loadFailed = true;
  }

  return (
    <AccountShell signedIn house={ws.tenant.kind === "house"}>
      <Link href="/app/transactions" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; Transactions
      </Link>
      <h1 className="mt-3 text-3xl text-charcoal">Categories and rules</h1>
      {loadFailed ? (
        <p className="mt-6 text-sm text-ink/70">We couldn&apos;t load these just now. Refresh in a minute.</p>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border border-parchment bg-white p-6">
            <h2 className="text-xl text-charcoal">Rules</h2>
            <p className="mt-1 text-sm text-ink/65">
              Made from &ldquo;Always do this&rdquo; when you sort a transaction. A rule only sorts new lines waiting for you; it
              never changes one you sorted or moved back yourself.
            </p>
            {rules.length === 0 ? (
              <p className="mt-4 text-sm text-ink/60">No rules yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-parchment text-sm">
                {rules.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0 break-words text-charcoal">
                      {r.matchField === "merchant" ? "Merchant" : "Description"} {r.matchType === "equals" ? "is" : "contains"}{" "}
                      <strong>&ldquo;{r.pattern}&rdquo;</strong>
                      {DIRECTION[r.direction] ?? ""} &rarr; {r.action === "exclude" ? "Not business" : r.categoryName ?? "a removed category"}
                      <span className="text-ink/50"> · sorted {r.appliedCount}</span>
                    </span>
                    <DeleteRule id={r.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-parchment bg-white p-6">
            <h2 className="text-xl text-charcoal">Categories</h2>
            <p className="mt-1 text-sm text-ink/65">
              Tax line hints are a starting point for your accountant, not tax advice. Hiding a category keeps every
              transaction already sorted into it.
            </p>
            <AddCategory />
            {CATEGORY_KINDS.map((k) => {
              const list = categories.filter((c) => c.kind === k);
              if (!list.length) return null;
              return (
                <div key={k} className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">{KIND_LABEL[k as CategoryKind]}</h3>
                  <ul className="mt-2 divide-y divide-parchment text-sm">
                    {list.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                        <span className={`min-w-0 break-words ${c.isArchived ? "text-ink/45 line-through" : "text-charcoal"}`}>
                          {c.name}
                          {c.taxLine && <span className="ml-2 text-xs text-ink/50">{c.taxLine}</span>}
                        </span>
                        <ArchiveCategory id={c.id} archived={c.isArchived} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </>
      )}
    </AccountShell>
  );
}
