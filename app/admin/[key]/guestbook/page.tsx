import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuestbookModeration from "@/components/admin/GuestbookModeration";
import { adminKeyMatches } from "@/lib/admin";
import { listEntriesForAdmin } from "@/lib/guestbook";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guestbook", robots: { index: false, follow: false } };

export default async function GuestbookAdminPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!adminKeyMatches(key)) notFound();
  const entries = await listEntriesForAdmin();
  return <GuestbookModeration entries={entries} basePath={`/admin/${key}`} />;
}
