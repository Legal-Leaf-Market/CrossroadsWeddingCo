import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LiveRunSheet from "@/components/hub/LiveRunSheet";
import { getLiveBlocks, getWeddingByShareToken } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";
import { brandForTenant, brandForToken, brandedMetadata } from "@/lib/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return brandedMetadata(await brandForToken(token, "share"), "Live timeline");
}

// Zero-auth vendor view: the share token grants exactly this read-only page.
export default async function LivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wedding = await getWeddingByShareToken(token);
  if (!wedding) notFound();
  const brand = await brandForTenant(wedding.tenantId);
  const blocks = await getLiveBlocks(wedding.id);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <p className="text-sm font-semibold text-terracotta">{brand.name} Live</p>
          <h1 className="text-2xl text-charcoal">{wedding.coupleNames}</h1>
          <p className="text-sm text-ink/60">
            {formatEventDate(wedding.eventDate)} at {wedding.venueName}. Times update live as the
            day runs; no refresh needed.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <LiveRunSheet initialBlocks={blocks} pollPath={`/api/live/${token}`} />
        <p className="pt-8 text-center text-xs text-ink/40">
          Read-only view shared by the couple · {brand.name}
        </p>
      </main>
    </div>
  );
}
