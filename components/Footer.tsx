import { CITIES, cityPath } from "@/lib/cities";
import { SERVICE_RADIUS_BLURB, SITE_NAME } from "@/lib/site";

// The family's other sites (cross promotion audit, Jake, 2026-11-27). Jake
// runs all of them; the tie is said in the same block. Legal Leaf is a 21+
// smoke shop and is labeled so. Kawaii Katz is Jake's daughter Ada's shop.
// Every link is tagged so the sites can count what the family sends them.
const REF = "utm_source=crossroadsweddingco&utm_medium=referral&utm_campaign=family";
const FAMILY = [
  {
    href: `https://heartofcolumbus.shop/plan/?${REF}`,
    label: "Heart of Columbus",
    what: "Columbus caterers, florists, bakers and venues for the day",
  },
  {
    href: `https://shipitwithai.heartofcolumbus.shop/work/?${REF}#crossroads`,
    label: "Ship It With AI",
    what: "The booking software behind this site, built for small businesses",
  },
  {
    href: `https://kawaiikatz.heartofcolumbus.shop/?${REF}`,
    label: "Kawaii Katz",
    what: "Cute gifts and finds for every budget, curated by Ada",
  },
  {
    href: `https://legalleafmarket.shop/?${REF}`,
    label: "Legal Leaf Cafe & Market",
    what: "A Columbus cafe coming soon (21+)",
  },
];

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
          <a href="/events" className="font-semibold text-cream/70 hover:text-cream">
            Corporate Events &amp; Holiday Parties
          </a>
          <a href="/venues" className="font-semibold text-cream/70 hover:text-cream">
            For Venues
          </a>
          <a href="/parties" className="font-semibold text-cream/70 hover:text-cream">
            Private Parties
          </a>
          <a href="/reviews" className="font-semibold text-cream/70 hover:text-cream">
            Reviews
          </a>
          <a href="/brochures" className="font-semibold text-cream/70 hover:text-cream">
            Brochures
          </a>
          <a href="/past-events" className="font-semibold text-cream/70 hover:text-cream">
            Past Events
          </a>
          <a href="/partners" className="font-semibold text-cream/70 hover:text-cream">
            Partners
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
        <div className="mx-auto mt-8 max-w-4xl border-t border-cream/10 pt-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-cream/70">
            More from our family in Columbus
          </p>
          <ul className="mt-4 grid gap-4 text-center sm:grid-cols-2 lg:grid-cols-4">
            {FAMILY.map((f) => (
              <li key={f.label}>
                <a href={f.href} className="font-semibold text-cream/80 hover:text-cream">
                  {f.label}
                </a>
                <span className="mt-1 block text-xs">{f.what}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs">
            Run by Jake Kennedy, a Crossroads owner, and Kawaii Katz by his daughter Ada.
          </p>
        </div>
        <p className="mt-6 text-center">
          &copy; {new Date().getFullYear()} {SITE_NAME} All rights reserved.
        </p>
      </div>
    </footer>
  );
}
