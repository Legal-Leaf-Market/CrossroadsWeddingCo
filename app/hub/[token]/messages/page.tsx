import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChatThread from "@/components/messages/ChatThread";
import { getWeddingByToken } from "@/lib/hub";
import { getThread, markThreadRead } from "@/lib/messages";
import { SITE_NAME } from "@/lib/site";

// The couple's side of the one-master-thread conversation. Email only points
// here; this page IS the conversation.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function HubMessagesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const wedding = await getWeddingByToken(token);
  if (!wedding) notFound();

  const messages = await getThread(wedding.id);
  await markThreadRead(wedding.id, "couple");

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
            <h1 className="text-xl text-charcoal">Messages</h1>
            <p className="text-sm text-ink/60">
              Your direct line to Jake and Nic. We both see everything here.
            </p>
          </div>
          <a
            href={`/hub/${token}`}
            className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
          >
            Back to hub
          </a>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-4">
        <ChatThread
          endpoint={`/api/hub/${token}/messages`}
          viewer="couple"
          coupleNames={wedding.coupleNames}
          speakers={wedding.hubSpeakers ?? []}
          accessEndpoint={`/api/hub/${token}/access`}
          initialMessages={messages}
        />
      </main>
    </div>
  );
}
