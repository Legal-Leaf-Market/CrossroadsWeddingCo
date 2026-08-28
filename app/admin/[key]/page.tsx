import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Dashboard from "@/components/admin/Dashboard";
import { adminKeyMatches, getAdminData } from "@/lib/admin";

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

export default async function AdminPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();
  const data = await getAdminData();
  return <Dashboard data={data} basePath={`/admin/${key}`} />;
}
