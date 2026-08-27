import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LiveRunSheet from "@/components/hub/LiveRunSheet";
import ShareLink from "@/components/hub/ShareLink";
import { getLiveBlocks, getWeddingByToken } from "@/lib/hub";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crossroads Live",
  robots: { index: false, follow: false },
};

export default async function HubLivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) notFound();
  const blocks = await getLiveBlocks(wedding.id);

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-terracotta">{SITE_NAME} Live</p>
            <h1 className="text-2xl text-charcoal">{wedding.coupleNames}</h1>
            <p className="text-sm text-ink/60">
              Tap Start as each moment begins; every later time shifts with you, on every
              screen watching.
            </p>
          </div>
          <a
            href={`/hub/${token}`}
            className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
          >
            Back to your hub
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <LiveRunSheet
          initialBlocks={blocks}
          pollPath={`/api/hub/${token}/live`}
          controlPath={`/api/hub/${token}/live`}
        />
        {wedding.shareToken && (
          <section className="rounded-2xl border border-parchment bg-white p-6 shadow-sm">
            <h2 className="text-lg text-charcoal">Share with your vendors</h2>
            <p className="mb-3 mt-1 text-sm text-ink/60">
              Photographer, venue, caterer: this link shows them the live timeline, read
              only. They see every shift the moment it happens, and they can never change
              anything.
            </p>
            <ShareLink url={`${SITE_URL}/live/${wedding.shareToken}`} />
          </section>
        )}
      </main>
    </div>
  );
}
