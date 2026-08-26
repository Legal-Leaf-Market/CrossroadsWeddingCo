import { ACOUSTIC_ADDON_USD, BARTENDER_MIN_USD, DEPOSIT_USD, DJ_DAY_RATE_USD } from "@/lib/site";

export default function Pricing() {
  return (
    <section id="pricing" className="bg-cream py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl text-charcoal">Straightforward pricing</h2>
        <p className="mx-auto mt-3 max-w-xl text-ink/70">
          No tiered packages designed to upsell you. One honest day rate for
          DJ services — add live music or bar service if you want them.
        </p>
        <div className="mx-auto mt-10 max-w-sm rounded-2xl border-2 border-terracotta bg-parchment/40 p-8">
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
              <span className="font-semibold text-charcoal">Live acoustic set</span> — flat $
              {ACOUSTIC_ADDON_USD}
            </p>
            <p>
              <span className="font-semibold text-charcoal">Bar service</span> — from $
              {BARTENDER_MIN_USD}, fully quoted on your intro call
            </p>
          </div>
          <a
            href="/book"
            className="mt-6 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark"
          >
            Check your date
          </a>
        </div>
      </div>
    </section>
  );
}
