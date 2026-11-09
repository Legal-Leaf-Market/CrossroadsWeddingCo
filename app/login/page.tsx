import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import LoginForm from "@/components/account/LoginForm";
import { getWorkspace } from "@/lib/auth";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Sign in to ${PLATFORM_NAME}`,
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; signedout?: string }>;
}) {
  const ws = await getWorkspace().catch(() => null);
  if (ws) redirect("/app");
  const { expired, signedout } = await searchParams;
  return (
    <AccountShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl text-charcoal">Sign in</h1>
        <p className="mt-2 text-ink/70">We&apos;ll email you a link. No password to remember.</p>
        {expired && (
          <p className="mt-4 rounded-lg bg-terracotta/10 px-4 py-3 text-sm text-terracotta-dark" role="alert">
            That link has expired or was already used. Ask for a new one below.
          </p>
        )}
        {signedout && (
          <p className="mt-4 rounded-lg bg-parchment/60 px-4 py-3 text-sm text-ink/75" role="status">
            You&apos;re signed out.
          </p>
        )}
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-sm text-ink/60">
          New here?{" "}
          <a href="/signup" className="font-semibold text-terracotta-dark underline">
            Start a free trial
          </a>
          .
        </p>
      </div>
    </AccountShell>
  );
}
