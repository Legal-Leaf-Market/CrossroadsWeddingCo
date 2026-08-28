import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Dashboard from "@/components/admin/Dashboard";
import { getAdminData } from "@/lib/admin";

// Owner dashboard behind a secret path segment, the same trust model as the
// hub's magic links: the URL is the credential. Gated on ADMIN_DASH_KEY in
// Vercel (32+ random hex chars; `openssl rand -hex 24` makes one). While the
// env var is unset, or on any mismatch, the route is indistinguishable from a
// 404. Read-only by design.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

function keyMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_DASH_KEY;
  // A short key is treated as unconfigured rather than accepted: this page
  // must never end up guarding real bookings with "test" or "1234".
  if (!expected || expected.length < 16) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function AdminPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!keyMatches(key)) notFound();
  const data = await getAdminData();
  return <Dashboard data={data} />;
}
