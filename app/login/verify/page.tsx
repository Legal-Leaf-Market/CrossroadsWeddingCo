import type { Metadata } from "next";
import AccountShell from "@/components/account/AccountShell";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Finish signing in to ${PLATFORM_NAME}`,
  robots: { index: false, follow: false },
  // The token is in this page's URL; never hand it to another site.
  referrer: "no-referrer",
};

// The emailed link opens this page, and the button spends the token. Mail
// scanners fetch links but don't press buttons, so the token survives until a
// person does.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" && /^[0-9a-f]{64}$/.test(t) ? t : "";
  return (
    <AccountShell>
      <div className="mx-auto max-w-md rounded-2xl border border-parchment bg-white p-6">
        {token ? (
          <>
            <h1 className="text-2xl text-charcoal">One tap to finish.</h1>
            <form action="/api/auth/verify" method="post" className="mt-6">
              <input type="hidden" name="t" value={token} />
              <button
                type="submit"
                className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                Sign in
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl text-charcoal">That link isn&apos;t complete.</h1>
            <p className="mt-2 text-ink/70">
              Open it straight from the email, or{" "}
              <a href="/login" className="font-semibold text-terracotta-dark underline">
                ask for a new one
              </a>
              .
            </p>
          </>
        )}
      </div>
    </AccountShell>
  );
}
