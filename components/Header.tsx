const NAV_LINKS = [
  { href: "/events", label: "Corporate events" },
  { href: "/#services", label: "Weddings" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

/** `brand` is accepted for the front page's existing call; the name is the same everywhere now. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Header(_props: { brand?: "events" } = {}) {
  return (
    <header className="sticky top-0 z-50 border-b border-parchment bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="text-base font-semibold tracking-tight text-charcoal sm:text-lg">
          Crossroads{" "}
          <span className="text-terracotta">Wedding and Event Co.</span>
        </a>
        <nav className="hidden gap-8 text-sm font-medium text-ink md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-terracotta">
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="/book"
          className="ml-3 shrink-0 whitespace-nowrap rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark sm:px-5"
        >
          Check your date
        </a>
      </div>
    </header>
  );
}
