// Local partners (2026-11-18, Jacob: a page for Cookie Paradise and one for
// Rabbit's Balloons). Every line is what the business says about itself, with
// where it was read and when. Nothing here is a price, a review or a promise
// on their behalf: those come from them. Slugs are page addresses: add, never
// rename.
//
// Cookie Paradise: cookieparadise.co, its contact page and its Weddings &
// Private Parties page, read 2026-11-13 (recorded in Heart of Columbus,
// src/data/own-facts.mjs). The owner asked to cross promote the wedding page.
// Rabbit's Balloons: from its owner, Rachael Starr, 2026-11-15. It has no
// public website yet (her draft is under review), so no address, phone or
// prices are shown, and the way in is through us.

import { CONTACT_EMAIL } from "@/lib/site";

export type Partner = {
  slug: string;
  name: string;
  /** One line for the partner list. */
  kind: string;
  /** What they say they do, in their words where we have them. */
  intro: string;
  forEvents: string[];
  details?: { label: string; value: string }[];
  /** Their own pages first; our inbox only when they have none. */
  links: { label: string; href: string; primary?: boolean }[];
  /** Art we made, never a photo of their work unless they sent it. */
  art?: { src: string; alt: string; caption: string };
  related?: { name: string; about: string };
  source: string;
  checked: string;
};

const ask = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export const PARTNERS: Partner[] = [
  {
    slug: "cookie-paradise",
    name: "Cookie Paradise",
    kind: "Cookies for weddings and parties, from a yellow trailer in Columbus",
    intro:
      "A Columbus cookie shop that bakes for weddings, private parties and corporate catering, served from its trailer in the Holiday Center parking lot.",
    forEvents: [
      "Dessert tables: a mix of cookies set out for guests at a reception, rehearsal dinner, birthday or shower.",
      "Cookie favors: ask about individually packaged cookies for place settings or welcome bags.",
      "Outdoor parties: ask whether their yellow cookie trailer can come to your venue.",
      "Send your date and details through their form and they follow up about flavors, pricing and availability.",
    ],
    details: [
      { label: "Where", value: "Trailer in the Holiday Center parking lot, 3950 25th St, Columbus, IN 47203" },
      { label: "Hours", value: "Tuesday to Friday 10 AM to 6 PM, Saturday 10 AM to 8 PM, closed Sunday and Monday" },
    ],
    links: [
      { label: "Request a wedding or party quote", href: "https://cookieparadise.co/pages/weddings-private-parties", primary: true },
      { label: "Corporate catering", href: "https://cookieparadise.co/pages/corporate-catering" },
      { label: "Their website", href: "https://cookieparadise.co/" },
    ],
    source: "https://cookieparadise.co/pages/contact",
    checked: "2026-11-13",
  },
  {
    slug: "rabbits-balloons",
    name: "Rabbit's Balloons",
    kind: "Organic balloon arches, garlands and installs in Columbus",
    intro:
      "Rachael Starr's balloon studio in Columbus: organic arches, garlands and statement installs in all natural latex from Sempertex, for weddings, showers, corporate events and private celebrations.",
    forEvents: [
      "Weddings and showers: ceremony arches, reception and photo backdrops, bridal and baby showers, with palettes built around your flowers.",
      "Corporate events: company colors matched as closely as the latex allows, for grand openings, launches, conferences and holiday parties.",
      "Private celebrations: birthdays, milestones and backyard parties, with big and tiny balloons mixed together.",
      "Styles to ask for: organic and asymmetric arches, columns, garlands priced by the foot, and bouquets and clusters.",
      "Set up and broken down for you, with minimal waste.",
    ],
    links: [{ label: "Ask us to connect you", href: ask("Rabbit's Balloons for our event"), primary: true }],
    art: {
      src: "/partners/rabbits-balloons/arch.webp",
      alt: "Illustration of an organic balloon arch in soft pastel colors",
      caption: "Inspiration art, not a photo of a Rabbit's Balloons install. Rachael's own photos replace it when she sends them.",
    },
    related: { name: "Turtle's Flowers", about: "its sister business, an artisan florist in Columbus" },
    source: "Rachael Starr, owner",
    checked: "2026-11-15",
  },
];

export function findPartner(slug: string): Partner | null {
  return PARTNERS.find((p) => p.slug === slug) ?? null;
}
