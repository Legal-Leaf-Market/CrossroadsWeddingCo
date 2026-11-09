import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import SignupForm from "@/components/account/SignupForm";
import { getWorkspace, signupOpen } from "@/lib/auth";
import { PLATFORM_NAME, TRIAL_DAYS } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Start a free trial of ${PLATFORM_NAME}`,
  description: `Bookings, client planning hubs and live day-of timelines for wedding and event businesses. ${TRIAL_DAYS} days free, no card.`,
  // Not launched: stays out of search until the product has its own name and page.
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  const ws = await getWorkspace().catch(() => null);
  if (ws) redirect("/app");
  const open = signupOpen();
  return (
    <AccountShell>
      <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-start">
        <div>
          <h1 className="text-3xl leading-tight text-charcoal sm:text-4xl">Run every wedding from one place.</h1>
          <p className="mt-4 text-ink/75">
            Bookings, contracts and invoices, a planning hub your couples fill in from their phones, and a day-of
            timeline that moves for every vendor when the night runs late.
          </p>
          <p className="mt-4 text-sm text-ink/60">
            {TRIAL_DAYS} days free. No card. Free for your clients.
          </p>
        </div>
        {open ? (
          <SignupForm />
        ) : (
          <div className="rounded-2xl border border-parchment bg-white p-6" role="status">
            <h2 className="text-xl text-charcoal">Signups aren&apos;t open yet.</h2>
            <p className="mt-2 text-ink/70">
              We&apos;re letting in a small group of founding businesses first. Already have an account?{" "}
              <a href="/login" className="font-semibold text-terracotta-dark underline">
                Sign in
              </a>
              .
            </p>
          </div>
        )}
      </div>
    </AccountShell>
  );
}
