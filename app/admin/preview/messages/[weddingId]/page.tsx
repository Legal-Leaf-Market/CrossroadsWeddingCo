import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChatThread from "@/components/messages/ChatThread";
import { SAMPLE_THREAD } from "../sample";

// Dev-only demo of the team inbox thread (no database, local echo).
export const metadata: Metadata = {
  title: "Admin messages preview",
  robots: { index: false, follow: false },
};

export default function AdminMessagesPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="flex h-dvh flex-col bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-terracotta">Messages</p>
            <h1 className="text-xl text-charcoal">Jordan Hayes &amp; Taylor Morgan</h1>
            <p className="text-sm text-ink/60">Saturday, June 12, 2027 at The Sycamore Barn</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admin/preview"
              className="rounded-full border border-terracotta px-4 py-1.5 text-sm font-semibold text-terracotta hover:bg-terracotta hover:text-cream"
            >
              All bookings
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-4">
        <ChatThread
          endpoint=""
          demo
          viewer="team"
          coupleNames="Jordan Hayes & Taylor Morgan"
          initialMessages={SAMPLE_THREAD}
        />
      </main>
    </div>
  );
}
