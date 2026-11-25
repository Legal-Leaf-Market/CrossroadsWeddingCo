// Cookie Paradise, the facts behind /partners/cookie-paradise (2026-11-25,
// Jacob: "build up on Heart of Columbus, how we did cookie paradise on there,
// and try to replicate as much as you can here ... make their page orderable").
//
// Every line below is what Cookie Paradise publishes about itself, as recorded
// in Heart of Columbus (sites/cookie-paradise/index.html header and
// src/data/own-facts.mjs), read on 2026-11-13:
//   - https://cookieparadise.co/pages/contact : 3950 25th St, Columbus, IN
//     47203; Tuesday to Friday 10 AM to 6 PM, Saturday 10 AM to 8 PM, Sunday and
//     Monday closed; 812-508-9675; trung@cookieparadise.co; "Your order will be
//     fulfilled on the next business day that our shop is open."
//   - https://cookieparadise.co/ : the trailer in the Holiday Center parking
//     lot; trailer pickup, delivery anywhere in Columbus, shipping to Indiana
//     addresses only; Facebook, Instagram and TikTok in its footer.
//   - https://cookieparadise.co/pages/weddings-private-parties : dessert
//     tables, individually packaged favors on request, ask whether the yellow
//     trailer can come to your venue, a quote form.
//   - https://cookieparadise.co/pages/corporate-catering : "Winner, Taste of
//     Columbus 2025", family owned, and the businesses it has catered for.
//   - https://cookieparadise.co/pages/about-us : the family's story, quoted.
//   - https://cookieparadise.co/pages/thanksgiving-cookie-boxes : 8 for $25,
//     12 for $35; Maple Pecan, Sugar Cream, Carrot Cake, Chocolate Chip; pickup
//     Wednesday, November 25, 2026, 9 AM to 6 PM at the trailer.
// Google's listing shows shorter hours (Tuesday to Friday 11 AM to 5:30 PM);
// the owner's own page wins. The menu, prices, stock and product photos are
// NOT typed here: they are read live from their own store (lib/partner-menu.ts).
// The owner, Trung, asked to cross promote the wedding page (via Jacob,
// 2026-11-13) and is Founding Member #1 of Heart of Columbus.

import type { HoursRow } from "@/lib/cookie-order";

const ORIGIN = "https://cookieparadise.co";

export const COOKIE_PARADISE = {
  slug: "cookie-paradise",
  name: "Cookie Paradise",
  origin: ORIGIN,
  street: "3950 25th St",
  cityLine: "Columbus, IN 47203",
  where: "The yellow trailer in the Holiday Center parking lot",
  phone: "812-508-9675",
  tel: "+18125089675",
  email: "trung@cookieparadise.co",
  hours: [
    [2, 600, 1080],
    [3, 600, 1080],
    [4, 600, 1080],
    [5, 600, 1080],
    [6, 600, 1200],
  ] as HoursRow[],
  award: "Winner, Taste of Columbus 2025",
  catered: [
    "Boot Barn Columbus",
    "Lindal North America",
    "Brighter Days Shelter",
    "Bartholomew County Historical Society",
    "Jewell-Rittman Funeral Services",
  ],
  story: [
    "We are the Lê’s, an immigrant family from Vietnam who resettled in Columbus in November 2024.",
    "The name ‘Cookie Paradise’ is symbolic of our family’s dream: to create a paradise for ourselves on this new land and a paradise in senses for everyone who tastes our homemade cookies.",
  ],
  storyBy: "The Lê family, Cookie Paradise",
  ways: [
    { title: "Pick up at the trailer", body: "Holiday Center parking lot, 3950 25th St, Columbus. Say your name at the window." },
    { title: "Delivered in Columbus", body: "Anywhere in Columbus, Indiana. The delivery total shows at their checkout." },
    { title: "Shipped across Indiana", body: "Sent to your door, Indiana addresses only." },
  ],
  links: {
    shop: `${ORIGIN}/collections/all`,
    weddings: `${ORIGIN}/pages/weddings-private-parties`,
    corporate: `${ORIGIN}/pages/corporate-catering`,
    contact: `${ORIGIN}/pages/contact`,
    about: `${ORIGIN}/pages/about-us`,
    thanksgiving: `${ORIGIN}/pages/thanksgiving-cookie-boxes`,
    directions:
      "https://www.google.com/maps/dir/?api=1&destination=Cookie+Paradise%2C+3950+25th+St%2C+Columbus%2C+IN+47203",
    map: "https://www.google.com/maps?q=Cookie+Paradise%2C+3950+25th+St%2C+Columbus%2C+IN+47203&output=embed",
  },
  socials: [
    { label: "Facebook", href: "https://www.facebook.com/cookieparadise.co" },
    { label: "Instagram", href: "https://www.instagram.com/cookieparadise.co" },
    { label: "TikTok", href: "https://www.tiktok.com/@cookieparadise.co" },
  ],
  /** A note shown on one product, by its handle, and the day it stops applying. */
  itemNotes: {
    "thanksgiving-cookie-boxes": {
      note: "Preorder. Pickup Wednesday, November 25, 9 AM to 6 PM at the trailer.",
      until: "2026-11-25",
    },
  } as Record<string, { note: string; until?: string }>,
  thanksgiving: {
    until: "2026-11-25",
    text: "8 cookies for $25 or 12 for $35, in Maple Pecan, Sugar Cream, Carrot Cake and Chocolate Chip. Pickup Wednesday, November 25, 9 AM to 6 PM at the trailer.",
  },
  checked: "2026-11-13",
} as const;
