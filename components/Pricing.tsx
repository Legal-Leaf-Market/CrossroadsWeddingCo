import {
  ACOUSTIC_ADDON_USD,
  BARTENDER_ONE_USD,
  BARTENDER_TWO_USD,
  DEPOSIT_USD,
  CORPORATE_DEPOSIT_USD,
  CORPORATE_DJ_SOUND_USD,
  DJ_DAY_RATE_USD,
} from "@/lib/site";

export default function Pricing() {
  return (
    <section id="pricing" className="bg-cream py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl text-charcoal">Straightforward pricing</h2>
        <p className="mx-auto mt-3 max-w-xl text-ink/70">
          No tiered packages designed to upsell you. One flat price for each
          kind of event.
        </p>
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 text-left md:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border-2 border-terracotta bg-parchment/40 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-sage-dark">
            Wedding DJ
          </p>
          <p className="mt-2 text-5xl text-charcoal">
            ${DJ_DAY_RATE_USD.toLocaleString("en-US")}
            <span className="text-lg text-ink/60"> / day</span>
          </p>
          <p className="mt-4 text-sm text-ink/70">
            Ceremony through last dance, sound equipment, MC, and day-of
            timeline coordination included. A ${DEPOSIT_USD} deposit locks
            your date.
          </p>
          <div className="mt-5 space-y-2 border-t border-terracotta/30 pt-4 text-left text-sm text-ink/70">
            <p>
              <span className="font-semibold text-charcoal">Live solo acoustic set</span>: flat $
              {ACOUSTIC_ADDON_USD}, ceremony or cocktail hour
            </p>
            <p>
              <span className="font-semibold text-charcoal">Bar service</span>: $
              {BARTENDER_ONE_USD} for one bartender, ${BARTENDER_TWO_USD} for two
            </p>
          </div>
          <a
            href="/book"
            className="mt-6 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Check your wedding date
          </a>
        </div>
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-parchment bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-dark">Corporate &amp; holiday</p>
            <p className="mt-2 text-3xl text-charcoal">${CORPORATE_DJ_SOUND_USD.toLocaleString("en-US")} <span className="text-base text-ink/60">flat</span></p>
            <p className="mt-2 text-sm text-ink/70">DJ and sound. A ${CORPORATE_DEPOSIT_USD.toLocaleString("en-US")} deposit locks the date. Acoustic and bar quoted per event.</p>
            <a href="/events" className="mt-3 inline-block text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2">Corporate events</a>
          </div>
          <div className="rounded-2xl border border-parchment bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-sage-dark">Private parties</p>
            <p className="mt-2 text-3xl text-charcoal">Quoted <span className="text-base text-ink/60">on a short call</span></p>
            <p className="mt-2 text-sm text-ink/70">Birthdays, graduations, anniversaries. DJ, bar or both.</p>
            <a href="/parties" className="mt-3 inline-block text-sm font-semibold text-terracotta underline decoration-terracotta/40 underline-offset-2">Private parties</a>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
