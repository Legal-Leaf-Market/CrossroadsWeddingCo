import { CITIES, cityPath } from "@/lib/cities";
import { SERVICE_RADIUS_BLURB, SITE_NAME } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-charcoal py-10 text-sm text-cream/50">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center">{SERVICE_RADIUS_BLURB}</p>
        <nav className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
          <a href="/" className="font-semibold text-cream/70 hover:text-cream">
            Wedding DJ &amp; MC
          </a>
          <a href="/acoustic" className="font-semibold text-cream/70 hover:text-cream">
            Live Solo Acoustic Set
          </a>
          <a href="/bartending" className="font-semibold text-cream/70 hover:text-cream">
            Wedding Bartending
          </a>
          <a href="/book" className="font-semibold text-cream/70 hover:text-cream">
            Check Your Date
          </a>
        </nav>
        <nav className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {CITIES.map((c) => (
            <a key={c.citySlug} href={cityPath(c)} className="hover:text-cream/80">
              Wedding DJ in {c.name}, {c.stateAbbr}
            </a>
          ))}
        </nav>
        <p className="mt-6 text-center">
          &copy; {new Date().getFullYear()} {SITE_NAME} All rights reserved.
        </p>
      </div>
    </footer>
  );
}
