// Local partners (2026-11-18, Jacob: a page for Cookie Paradise and one for
// Rabbit's Balloons). Every line is what the business says about itself, with
// where it was read and when. Nothing here is a price, a review or a promise
// on their behalf: those come from them. Slugs are page addresses: add, never
// rename.
//
// Cookie Paradise: cookieparadise.co, its contact page and its Weddings &
// Private Parties page, read 2026-11-13 (recorded in Heart of Columbus,
// src/data/own-facts.mjs). The owner asked to cross promote the wedding page.
// Since 2026-11-25 its page is its own file (app/partners/cookie-paradise),
// an orderable store built from lib/cookie-paradise.ts; this entry still
// feeds the partner list, the menu and the sitemap.
// Rabbit's Balloons: from its owner, Rachael Starr, 2026-11-15. It has no
// public website yet (her draft is under review), so no address, phone or
// prices are shown, and the way in is through us. Her steps and practices are
// what she told Heart of Columbus for her draft site (under her review), kept
// to plain statements; her personal story waits for her OK to quote. The
// "ask" lists are ours: questions a couple should bring, not their policies.
// docs/handoff/PARTNERS_RESEARCH.md is the brief for researching the rest.
// Since 2026-11-25 Rabbit's Balloons also has its own page file
// (app/partners/rabbits-balloons): the Color Studio and a real inquiry form,
// ported from the preview site Heart of Columbus built for Rachael.
// Wild Bramble Catering (2026-11-25): its own website, read 2026-11-25, and
// its Heart of Columbus listing; every fact and source is in
// lib/wild-bramble.ts, and its page is its own file
// (app/partners/wild-bramble-catering): a menu builder that sends straight
// to their inbox. They have not reviewed the page.
// Love Me Wildly Photography (2026-11-26, Jacob: "Nick and I both know her
// personally ... would 1000% recommend her ... a partner page"): Deidra
// McKenzie's studio. Facts from her own pages, read 2026-11-26:
// lovemewildly.com (home, about, packages, portfolio, contact) and
// instagram.com/love.me.wildly. Her site publishes no prices. The surname is
// from Jacob; her site signs "Deidra". "Why we send couples to her" is our
// own recommendation, Jake and Nic having worked a wedding with her, not a
// review of hers. NO PHOTOS: her portfolio is her work and shows her couples,
// so it stays on her site until she sends what she wants shown here. Heart of
// Columbus built her a draft website (its sites/love-me-wildly/).

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
  related?: { name: string; about: string; href?: string };
  /** How a job runs, in the order they told us. */
  steps?: { title: string; body: string }[];
  /** Practices they describe, each a plain statement. */
  practices?: { title: string; body: string }[];
  /** Heading over `practices` (the template's default is about low waste). */
  practicesTitle?: string;
  /** A limit they state themselves, shown as written. */
  caveat?: string;
  /** Read their public Shopify catalog for a live "on the menu now" list. */
  liveMenu?: { origin: string };
  /** Questions to bring when you contact them (ours, not theirs). */
  ask?: string[];
  /**
   * The partner has its own page file at app/partners/<slug>/page.tsx instead
   * of the shared template (Cookie Paradise, 2026-11-25: an orderable store).
   */
  customPage?: boolean;
  /** One short line on the partner list card, e.g. that you can order here. */
  badge?: string;
  /** How their part fits a Crossroads timeline, for the shared template's closing section. */
  withUs?: string;
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
    liveMenu: { origin: "https://cookieparadise.co" },
    customPage: true,
    badge: "Order online right here",
    ask: [
      "Your date, the venue and whether it is indoors or outdoors.",
      "Guest count, and whether you want a dessert table, favors, or both.",
      "Whether the trailer can come to your venue, and what it needs (space, power, time).",
      "Which flavors suit the season: their menu changes through the year.",
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
    customPage: true,
    badge: "Build your palette and send an inquiry here",
    art: {
      src: "/partners/rabbits-balloons/arch.webp",
      alt: "Illustration of an organic balloon arch in soft pastel colors",
      caption: "Inspiration art, not a photo of a Rabbit's Balloons install. Rachael's own photos replace it when she sends them.",
    },
    related: { name: "Turtle's Flowers", about: "its sister business, an artisan florist in Columbus", href: "https://www.turtlesflowers.com/" },
    steps: [
      { title: "Tell her the vibe", body: "Date, venue, colors and the feeling you want people to walk into. A photo, a mood board or three words all work." },
      { title: "Get a design and a quote", body: "A sketch of the install and a clear price before a single balloon is ordered." },
      { title: "Setup, on time", body: "Installed and finished before your guests arrive." },
      { title: "Breakdown, low waste", body: "When it is over, it comes down. What can be reused is reused, and the rest goes out the least wasteful way she can find." },
    ],
    practices: [
      { title: "All natural latex", body: "Premium natural latex balloons from Sempertex." },
      { title: "Minimal plastics", body: "Far less plastic than a typical party store balloon, and the plastic there is gets salvaged." },
      { title: "Reuse everything", body: "If a piece can go again, it goes again." },
      { title: "Fewer pops", body: "Cheap store balloons used to pop on her about one in three while she built. With Sempertex she builds a whole arch without losing one." },
    ],
    caveat: "Natural latex is not the same as compostable, and she does not pretend it is.",
    ask: [
      "Your date, venue and setup window (when the room opens to vendors and when guests arrive).",
      "Where it goes: ceremony arch, photo backdrop, dessert table garland, entrance columns.",
      "Your colors, or a photo of your flowers or invitation.",
      "Whether it is indoors or outdoors, since heat, sun and wind change what holds up.",
    ],
    source: "Rachael Starr, owner",
    checked: "2026-11-15",
  },
  {
    slug: "wild-bramble-catering",
    name: "Wild Bramble Catering",
    kind: "Seasonal, from-scratch catering in Columbus",
    intro:
      "A small Columbus catering studio, cooking since 2020 for weddings, corporate tables and private gatherings of 10 to 100 guests, with weekly family meal prep and meals you can send to someone who needs one.",
    forEvents: [
      "Weddings: multi-course dinners, family-style spreads and grazing tables.",
      "Corporate: lunches, boardroom spreads and client gatherings.",
      "Private events: intimate dinners, birthdays and showers, at home or at your venue.",
      "Dietary needs: they cook around Alpha-Gal, gluten and FODMAP, and offer vegetarian and vegan dishes.",
    ],
    links: [
      { label: "Request a quote", href: "https://www.wildbramblecatering.com/contact", primary: true },
      { label: "Their website", href: "https://www.wildbramblecatering.com/" },
    ],
    customPage: true,
    badge: "Build a menu and send it here",
    source: "https://www.wildbramblecatering.com/",
    checked: "2026-11-25",
  },
  {
    slug: "love-me-wildly",
    name: "Love Me Wildly Photography",
    kind: "Wedding, elopement and family photography, based in Columbus",
    intro:
      "Deidra McKenzie's photography studio in Columbus, Indiana: weddings, elopements, portraits and newborn lifestyle sessions. She has been behind the camera since 2010, her packages are built around each couple, and she travels for elopements.",
    forEvents: [
      "The Golden Hour package: 5 hours of coverage.",
      "The Timeless package: 8 hours of coverage.",
      "The Wildly In Love package: elopement weddings, wherever you are going. One couple's elopement took her to Tennessee.",
      "Engagement, family and portrait sessions, plus newborn lifestyle photos for after the wedding.",
      "Every package is a starting point she customizes to you. Prices come from her, so ask with your date.",
    ],
    details: [
      { label: "Why we send couples to her", value: "Jake and Nic have worked a wedding with Deidra, and we recommend her 1000%." },
      { label: "Based in", value: "Columbus, Indiana, and she travels" },
      { label: "Call or text", value: "(812) 593-5541, Monday to Friday, 9 AM to 5 PM" },
      { label: "Email", value: "Lovemewildlyphotography@gmail.com" },
      { label: "Her work", value: "Her portfolio lives on her website and Instagram. We'll show it here once she sends the photos she wants shared." },
    ],
    links: [
      { label: "See her work", href: "https://www.lovemewildly.com/", primary: true },
      { label: "Packages", href: "https://www.lovemewildly.com/packages" },
      { label: "Contact her", href: "https://www.lovemewildly.com/contact" },
      { label: "Instagram", href: "https://www.instagram.com/love.me.wildly/" },
    ],
    practicesTitle: "How she works",
    practices: [
      { title: "Real moments first", body: "The in-between moments, the fun interactions and the real emotion, not stiff, overly posed photos." },
      { title: "Direction when you want it", body: "In her words: yes, she'll tell you what to do with your hands." },
      { title: "A collaboration", body: "She sees your photos as art you make together, not a service handed over." },
      { title: "Made to fit", body: "Her packages are loose frameworks, customized to each couple." },
    ],
    ask: [
      "Your date, venue and the hours you want covered, from getting ready to the send off.",
      "When the sun sets on your date, so there is time for golden hour portraits.",
      "The family groupings you want, written down, so the formal photos go fast.",
      "Whether you want an engagement session first.",
    ],
    withUs:
      "we'll build the timeline with her, so the first look, the family photos and the golden hour portraits land where they should and the dance floor waits for her shots of the big moments.",
    source: "https://www.lovemewildly.com/",
    checked: "2026-11-26",
  },
];

export function findPartner(slug: string): Partner | null {
  return PARTNERS.find((p) => p.slug === slug) ?? null;
}
