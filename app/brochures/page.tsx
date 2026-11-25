import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrochureSheet from "@/components/brochures/BrochureSheet";
import ShareKit from "@/components/brochures/ShareKit";
import { BROCHURE_FACES } from "@/lib/brochure-html";
import { BROCHURES } from "@/lib/brochures";

const TITLE = "Our brochures: weddings and corporate events";
const DESCRIPTION =
  "Everything Crossroads does, on two trifolds: one for weddings, one for company events. Share them with a bride, a boss or a friend.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/brochures" },
  openGraph: { url: "/brochures", title: TITLE, description: DESCRIPTION },
};

export default function BrochuresPage() {
  return (
    <>
      <Header />
      <main>
        <section className="bg-charcoal py-14 text-cream sm:py-16">
          <div className="mx-auto max-w-5xl px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">Share us. Seriously.</p>
            <h1 className="mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">
              Know a bride? A boss? A party waiting to happen?
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-cream/80">
              Everything we do fits on two brochures. Pick who you&rsquo;re sending it to and we&rsquo;ll
              write the message for you.
            </p>
          </div>
        </section>

        <section className="bg-cream py-10">
          <div className="mx-auto max-w-5xl px-6">
            <ShareKit kind="all" />
          </div>
        </section>

        <section className="bg-cream pb-16">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 md:grid-cols-2">
            {(["wedding", "corporate"] as const).map((kind) => {
              const b = BROCHURES[kind];
              return (
                <a
                  key={kind}
                  href={b.path}
                  className="group flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-charcoal/10 hover:ring-terracotta"
                >
                  <BrochureSheet html={BROCHURE_FACES[kind].outside} label={`${b.short}, outside`} />
                  <div>
                    <h2 className="text-2xl text-charcoal group-hover:text-terracotta-dark">{b.short}</h2>
                    <p className="mt-1 text-sm text-ink/80">{b.priceLine}</p>
                    <p className="mt-3 text-sm font-semibold text-terracotta-dark">Open it and share it &rarr;</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
