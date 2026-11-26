// The site's one menu (2026-11-18, Jacob: "a side menu bar and a top menu bar
// on desktop, side menu bar for mobile"). The top bar shows TOP_LINKS from lg
// (1024px) up; the side menu shows every section on every width. Both read
// this file so the two can never list different pages.

/** `wide`: only in the top bar from xl (1280px); at lg the brand name needs the room. */
export type NavLink = { href: string; label: string; wide?: boolean };
export type NavSection = { title: string; links: NavLink[] };

export const TOP_LINKS: NavLink[] = [
  { href: "/#services", label: "Weddings" },
  { href: "/events", label: "Corporate events" },
  { href: "/parties", label: "Private parties", wide: true },
  { href: "/past-events", label: "Past events" },
  { href: "/partners", label: "Partners" },
  { href: "/#pricing", label: "Pricing", wide: true },
];

export const MENU_SECTIONS: NavSection[] = [
  {
    title: "What we do",
    links: [
      { href: "/", label: "Wedding DJ and MC" },
      { href: "/acoustic", label: "Live solo acoustic set" },
      { href: "/bartending", label: "Bar service" },
      { href: "/events", label: "Corporate events and holiday parties" },
      { href: "/parties", label: "Private parties" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },
  {
    title: "Our work",
    links: [
      { href: "/past-events", label: "Past events" },
      { href: "/reviews", label: "Reviews" },
    ],
  },
  {
    title: "Partners",
    links: [
      { href: "/partners", label: "All partners" },
      { href: "/partners/cookie-paradise", label: "Cookie Paradise" },
      { href: "/partners/rabbits-balloons", label: "Rabbit's Balloons" },
      { href: "/partners/wild-bramble-catering", label: "Wild Bramble Catering" },
      { href: "/partners/love-me-wildly", label: "Love Me Wildly Photography" },
      { href: "/venues", label: "For venues" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/book", label: "Check your date" },
      { href: "/my-wedding", label: "Find my wedding hub" },
      { href: "/#contact", label: "Contact" },
    ],
  },
];
