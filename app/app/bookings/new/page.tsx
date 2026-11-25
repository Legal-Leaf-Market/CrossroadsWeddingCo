import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import BookingEditor from "@/components/account/BookingEditor";
import { getCustomerWorkspace } from "@/lib/auth";
import { PLATFORM_NAME } from "@/lib/tenant-constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Add a booking | ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

export default async function NewBookingPage() {
  const ws = await getCustomerWorkspace();
  if (!ws) redirect("/login");
  return (
    <AccountShell signedIn>
      <Link href="/app" className="text-sm font-semibold text-ink/60 hover:text-terracotta-dark">
        &larr; All bookings
      </Link>
      <h1 className="mt-3 text-3xl text-charcoal">Add a booking</h1>
      <p className="mt-2 text-ink/70">
        Saving creates your client&apos;s planning hub. Nothing is sent to them: you share the link when you&apos;re ready.
      </p>
      <div className="mt-6">
        <BookingEditor />
      </div>
    </AccountShell>
  );
}
