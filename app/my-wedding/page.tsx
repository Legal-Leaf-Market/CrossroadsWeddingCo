import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FindMyWedding from "@/components/FindMyWedding";

// The one link Jake sends every couple (2026-11-09). A couple types the email
// on their booking and gets their own private planning hub link by email. No
// accounts and no passwords: the hub link is the key, and it only ever goes to
// an inbox already on the booking.
const TITLE = "Find your wedding";
const DESCRIPTION = "Couples booked with Crossroads: get the link to your private planning hub.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/my-wedding" },
  openGraph: { url: "/my-wedding", title: TITLE, description: DESCRIPTION },
  robots: { index: false, follow: true },
};

export default function MyWeddingPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="text-3xl text-charcoal sm:text-4xl">Find your wedding</h1>
        <p className="mt-3 text-ink/75">
          Booked with us? Type the email on your booking and we&apos;ll send you the link to your planning hub: your
          timeline, music, the names we&apos;ll announce, your agreement, and messages with our team.
        </p>
        <div className="mt-8">
          <FindMyWedding />
        </div>
        <p className="mt-6 text-sm text-ink/60">
          No password needed. Your hub link is private to you, so keep it between the two of you. Try the email you
          booked with, or one you invited to your hub. Can&apos;t find it? Text or call us and we&apos;ll resend it.
        </p>
      </main>
      <Footer />
    </>
  );
}
