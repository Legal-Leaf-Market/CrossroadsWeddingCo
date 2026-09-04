import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChatThread from "@/components/messages/ChatThread";
import { SITE_NAME } from "@/lib/site";
import { SAMPLE_THREAD } from "../../../admin/preview/messages/sample";

// Dev-only demo of the couple's Messages page (no database, local echo).
export const metadata: Metadata = {
  title: "Messages preview",
  robots: { index: false, follow: false },
};

export default function HubMessagesPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="flex h-dvh flex-col bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
            <h1 className="text-xl text-charcoal">Messages</h1>
            <p className="text-sm text-ink/60">
              Your direct line to the Crossroads team. We all see everything here.
            </p>
          </div>
          <a
            href="/hub/preview"
            className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
          >
            Back to hub
          </a>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-4">
        <ChatThread
          endpoint=""
          demo
          viewer="couple"
          coupleNames="Jordan Hayes & Taylor Morgan"
          speakers={["Jordan", "Taylor"]}
          initialMessages={SAMPLE_THREAD}
        />
      </main>
    </div>
  );
}
