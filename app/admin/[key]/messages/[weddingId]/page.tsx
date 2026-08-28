import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChatThread from "@/components/messages/ChatThread";
import { adminKeyMatches, getAdminWedding } from "@/lib/admin";
import { formatEventDate } from "@/lib/hub-constants";
import { getThread, markThreadRead } from "@/lib/messages";

// The team's side of the one-master-thread conversation: Jake and Nic both
// read and reply here, and the couple sees one fluid Crossroads thread.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ key: string; weddingId: string }>;
}) {
  const { key, weddingId } = await params;
  if (!adminKeyMatches(key)) notFound();
  const wedding = await getAdminWedding(weddingId);
  if (!wedding) notFound();

  const messages = await getThread(wedding.id);
  await markThreadRead(wedding.id, "team");

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-terracotta">Messages</p>
            <h1 className="text-xl text-charcoal">{wedding.coupleNames}</h1>
            <p className="text-sm text-ink/60">
              {formatEventDate(wedding.eventDate)} at {wedding.venueName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/admin/${key}`}
              className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
            >
              All bookings
            </a>
            <a
              href={`/hub/${wedding.accessToken}`}
              className="rounded-full border border-parchment px-4 py-1.5 text-sm font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta"
            >
              Their hub
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-4">
        <ChatThread
          endpoint={`/api/admin/${key}/messages/${wedding.id}`}
          viewer="team"
          coupleNames={wedding.coupleNames}
          initialMessages={messages}
        />
      </main>
    </div>
  );
}
