const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-parchment bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="text-lg font-semibold tracking-tight text-charcoal">
          Crossroads <span className="text-terracotta">Wedding Co.</span>
        </a>
        <nav className="hidden gap-8 text-sm font-medium text-ink md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-terracotta">
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="#contact"
          className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark"
        >
          Check your date
        </a>
      </div>
    </header>
  );
}
