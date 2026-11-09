import Link from "next/link";
import type { ReactNode } from "react";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

// Frame for the business-account pages (/signup, /login, /app). Deliberately
// not the Crossroads header and footer: these pages belong to the software
// other businesses sign up for, not to the wedding company.
export default function AccountShell({
  children,
  signedIn = false,
  house = false,
}: {
  children: ReactNode;
  signedIn?: boolean;
  /** The Crossroads house account: its bookings live in /admin, so no Bookings link here. */
  house?: boolean;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={signedIn ? "/app" : "/signup"} className="text-lg font-semibold text-charcoal">
            {PLATFORM_NAME}
          </Link>
          {signedIn ? (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
              {!house && (
                <Link href="/app" className="text-sm font-semibold text-ink/70 hover:text-terracotta-dark">
                  Bookings
                </Link>
              )}
              <Link href="/app/transactions" className="text-sm font-semibold text-ink/70 hover:text-terracotta-dark">
                Transactions
              </Link>
              <Link href="/app/books" className="text-sm font-semibold text-ink/70 hover:text-terracotta-dark">
                Books
              </Link>
              <Link href="/app/integrations" className="text-sm font-semibold text-ink/70 hover:text-terracotta-dark">
                Integrations
              </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-sm font-semibold text-ink/70 hover:text-terracotta-dark">
                Sign out
              </button>
            </form>
            </div>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-ink/70 hover:text-terracotta-dark">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>
    </div>
  );
}
