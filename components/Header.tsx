import SideMenu from "@/components/SideMenu";
import { TOP_LINKS } from "@/lib/nav";

/** `brand` is accepted for the front page's existing call; the name is the same everywhere now. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Header(_props: { brand?: "events" } = {}) {
  return (
    <header className="sticky top-0 z-50 border-b border-parchment bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <a href="/" className="min-w-0 truncate text-base font-semibold tracking-tight text-charcoal sm:text-lg">
          Crossroads{" "}
          <span className="text-terracotta">Wedding and Event Co.</span>
        </a>
        {/* Top bar: desktop only. Below lg the side menu is the menu. */}
        <nav aria-label="Main" className="ml-auto hidden items-center gap-5 text-sm font-medium text-ink lg:flex xl:gap-6">
          {TOP_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={`whitespace-nowrap hover:text-terracotta ${link.wide ? "hidden xl:inline" : ""}`}>
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="/book"
          className="ml-auto hidden shrink-0 whitespace-nowrap rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark sm:inline-block sm:px-5 lg:ml-2"
        >
          Check your date
        </a>
        <div className="ml-auto shrink-0 sm:ml-0">
          <SideMenu />
        </div>
      </div>
    </header>
  );
}
