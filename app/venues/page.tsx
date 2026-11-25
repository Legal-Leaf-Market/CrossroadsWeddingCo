import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ACOUSTIC_ADDON_USD,
  BARTENDER_ONE_USD,
  BARTENDER_TWO_USD,
  CONTACT_EMAIL,
  CORPORATE_DJ_SOUND_USD,
  DJ_DAY_RATE_USD,
  SERVICE_RADIUS_BLURB,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import { REVIEW_EVENTS } from "@/lib/review-constants";

// The venue pitch (2026-11-11, Jacob: "hire us as your in-house DJ, a venue
// page"). For a venue that wants one DJ team it can hand every couple without
// putting a DJ on payroll. Every line is something we already do or already
// publish: the prices are the lib/site.ts constants, the coordinator tools are
// the real run sheet and vendor live view, the proof is our own event pages.
// Nothing here promises insurance paperwork, exclusivity or a referral fee:
// none of those is decided, and the call is where they get settled.
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const TITLE = `Your in-house DJ, without the payroll | ${SITE_NAME}`;
const DESCRIPTION = `One DJ and MC team for every wedding and event at your venue. Flat published prices (${usd(DJ_DAY_RATE_USD)} weddings, ${usd(CORPORATE_DJ_SOUND_USD)} corporate), a live run sheet your coordinator can watch, and a crew that works inside your house rules.`;
// Tags are printed and shared: add, never rename (lib/lead-sources.ts).
const REFERRAL_LINK = `${SITE_URL.replace(/^https?:\/\//, "")}/?src=venue`;
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("In-house DJ for our venue")}`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/venues" },
  openGraph: { url: "/venues", title: TITLE, description: DESCRIPTION },
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-terracotta" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export default function VenuesPage() {
  const proof = REVIEW_EVENTS.filter((e) => e.media.some((m) => m.kind === "image"));
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-20 text-cream">
          <div className="mx-auto max-w-4xl px-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold">For venues</p>
            <h1 className="max-w-3xl text-4xl leading-tight sm:text-5xl">Your in-house DJ, without the payroll.</h1>
            <p className="mt-6 max-w-2xl text-lg text-cream/80">
              One DJ and MC team for every wedding, party and company night in your space. Couples get a price they can
              read before anyone talks, and your coordinator gets a run sheet that updates itself.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="/book?with=jake&src=venue" className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark">
                Book a call with Jake
              </a>
              <a href={MAILTO} className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70">
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </section>

        <section className="bg-cream py-16">
          <div className="mx-auto grid max-w-5xl gap-10 px-6 md:grid-cols-2">
            <div>
              <h2 className="text-3xl text-charcoal">What your couples get</h2>
              <ul className="mt-6 space-y-3 text-ink/80">
                <Bullet>
                  DJ and MC for the whole wedding day, <strong className="text-charcoal">{usd(DJ_DAY_RATE_USD)} flat</strong>. The
                  price on our site is the price.
                </Bullet>
                <Bullet>A live solo acoustic set for the ceremony or cocktail hour, {usd(ACOUSTIC_ADDON_USD)}.</Bullet>
                <Bullet>
                  Bar staff at {usd(BARTENDER_ONE_USD)} for one bartender or {usd(BARTENDER_TWO_USD)} for two. Serve only: the
                  couple or your venue provides the alcohol, and at a licensed venue we work under your permit.
                </Bullet>
                <Bullet>
                  A private planning hub where they build the timeline, the music and the names we say out loud, from their
                  phone.
                </Bullet>
                <Bullet>Corporate and holiday events at {usd(CORPORATE_DJ_SOUND_USD)} flat for DJ and sound, MC included.</Bullet>
              </ul>
            </div>
            <div>
              <h2 className="text-3xl text-charcoal">What your coordinator gets</h2>
              <ul className="mt-6 space-y-3 text-ink/80">
                <Bullet>
                  A <strong className="text-charcoal">live timeline link</strong>. When toasts run long, every later time on it
                  shifts, on every phone that has it open.
                </Bullet>
                <Bullet>A printed run sheet for your binder: times, names with pronunciation, every music cue.</Bullet>
                <Bullet>Load-in on your schedule, your sound limits and hard stops kept, and one contact the whole way.</Bullet>
                <Bullet>An MC who takes the welcomes, toasts and announcements, so your team doesn&apos;t have to.</Bullet>
              </ul>
            </div>
          </div>
        </section>

        {proof.length > 0 && (
          <section className="bg-parchment/40 py-16">
            <div className="mx-auto max-w-5xl px-6">
              <h2 className="text-3xl text-charcoal">Rooms we&apos;ve worked</h2>
              <p className="mt-2 text-ink/70">Real photos from our own events, not stock.</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {proof.map((e) => {
                  const img = e.media.find((m) => m.kind === "image")!;
                  return (
                    <a key={e.slug} href={`/weddings/${e.slug}`} className="group overflow-hidden rounded-2xl border border-parchment bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={img.alt} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
                      <div className="p-4">
                        <p className="font-semibold text-charcoal">{e.title}</p>
                        <p className="text-sm text-ink/60">{e.date}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="bg-cream py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl text-charcoal">How it works</h2>
            <ol className="mt-6 space-y-4 text-ink/80">
              <li>
                <strong className="text-charcoal">1. A 30-minute call.</strong> Your room, your rules, your season, and how you
                want couples to reach us.
              </li>
              <li>
                <strong className="text-charcoal">2. A walk-through.</strong> We see the space, the power and the load-in before
                your first couple books.
              </li>
              <li>
                <strong className="text-charcoal">3. Hand couples one link.</strong> Every booking that comes from you is marked
                as yours, so we both know where it came from.
              </li>
            </ol>
            <p className="mt-8 text-ink/80">The link to hand your couples:</p>
            <p className="mt-2 text-sm font-semibold text-charcoal [overflow-wrap:anywhere] sm:text-base">{REFERRAL_LINK}</p>
            <p className="mt-6 text-sm text-ink/60">{SERVICE_RADIUS_BLURB}</p>
          </div>
        </section>

        <section className="bg-charcoal py-16 text-cream">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl">Let&apos;s talk about your room.</h2>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <a href="/book?with=jake&src=venue" className="rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark">
                Book a call with Jake
              </a>
              <a href="/events" className="rounded-full border border-cream/40 px-6 py-3 text-sm font-semibold text-cream hover:border-cream/70">
                Corporate events
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
