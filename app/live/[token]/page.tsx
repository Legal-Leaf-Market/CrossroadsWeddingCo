import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LiveRunSheet from "@/components/hub/LiveRunSheet";
import { getLiveBlocks, getWeddingByShareToken } from "@/lib/hub";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live timeline",
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Zero-auth vendor view: the share token grants exactly this read-only page.
export default async function LivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wedding = await getWeddingByShareToken(token);
  if (!wedding) notFound();
  const blocks = await getLiveBlocks(wedding.id);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME} Live</p>
          <h1 className="text-2xl text-charcoal">{wedding.coupleNames}</h1>
          <p className="text-sm text-ink/60">
            {formatDate(wedding.eventDate)} at {wedding.venueName}. Times update live as the
            day runs; no refresh needed.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <LiveRunSheet initialBlocks={blocks} pollPath={`/api/live/${token}`} />
        <p className="pt-8 text-center text-xs text-ink/40">
          Read-only view shared by the couple · {SITE_NAME}
        </p>
      </main>
    </div>
  );
}
