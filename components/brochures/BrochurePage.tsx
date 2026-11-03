import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BrochureSheet from "@/components/brochures/BrochureSheet";
import PrintBrochure from "@/components/brochures/PrintBrochure";
import ShareKit from "@/components/brochures/ShareKit";
import { BROCHURE_FACES } from "@/lib/brochure-html";
import { BROCHURES, type BrochureKind } from "@/lib/brochures";

// One trifold on the web: the share kit first (the point of the page is to be
// passed along), then the outside and inside faces exactly as printed, then
// the door to book. Printing this page prints the brochure itself.
export default function BrochurePage({ kind }: { kind: BrochureKind }) {
  const b = BROCHURES[kind];
  const other = BROCHURES[kind === "wedding" ? "corporate" : "wedding"];
  const faces = BROCHURE_FACES[kind];

  return (
    <>
      {/* Two letter-landscape pages, no margins: the faces carry their own. */}
      <style dangerouslySetInnerHTML={{ __html: "@page { size: 11in 8.5in; margin: 0; }" }} />
      <div className="print:hidden">
        <Header />
      </div>
      <main className="brochure-print-root">
        <section className="bg-charcoal py-14 text-cream print:hidden sm:py-16">
          <div className="mx-auto max-w-5xl px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">{b.title}</p>
            <h1 className="mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">{b.headline}</h1>
            <p className="mt-4 max-w-2xl text-lg text-cream/80">
              {b.priceLine}. Send it to the person who needs it: it takes ten seconds and they will
              thank you for it.
            </p>
          </div>
        </section>

        <section className="bg-cream py-10 print:hidden">
          <div className="mx-auto max-w-5xl px-6">
            <ShareKit kind={kind} />
          </div>
        </section>

        <section className="bg-cream pb-14 print:p-0">
          <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 print:max-w-none print:gap-0 print:p-0">
            <div className="flex flex-col gap-3 print:gap-0">
              <h2 className="text-2xl text-charcoal print:hidden">Outside</h2>
              <BrochureSheet html={faces.outside} label={`${b.short}, outside: back flap, back cover and front cover`} />
            </div>
            <div className="flex flex-col gap-3 print:gap-0">
              <h2 className="text-2xl text-charcoal print:hidden">Inside</h2>
              <BrochureSheet html={faces.inside} label={`${b.short}, inside: the three services and prices`} />
            </div>
            <div className="flex flex-wrap items-center gap-3 print:hidden">
              <a
                href={b.bookPath}
                className="inline-flex min-h-11 items-center rounded-full bg-terracotta px-6 text-sm font-semibold text-cream hover:bg-terracotta-dark"
              >
                {b.bookLabel}
              </a>
              <PrintBrochure label="Print it" />
              <a
                href={other.path}
                className="inline-flex min-h-11 items-center rounded-full border border-charcoal/20 bg-white px-5 text-sm font-semibold text-charcoal hover:border-terracotta"
              >
                See the {other.short.toLowerCase()}
              </a>
            </div>
            <p className="text-sm text-ink/70 print:hidden">
              Printing at home or the office: two pages, double-sided, flip on the short edge, then
              fold in thirds with the cover facing out.
            </p>
          </div>
        </section>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </>
  );
}
