// Wild Bramble Catering, the facts behind /partners/wild-bramble-catering
// (2026-11-25, Jacob: "Make a page for Wild Brambe now ... Catering in
// Columbus ... They are on HOC"). Pure and import free, so the page, the menu
// builder and scripts/verify-wild-bramble.mjs share it.
//
// Sources, all read 2026-11-25 from their own website:
//   https://www.wildbramblecatering.com/            est. 2020, a small catering
//     studio in Columbus, Indiana; 10 to 100 guests; weddings, corporate,
//     private events, family meal prep, gift meals; local farms when possible;
//     hello@wildbramblecatering.com; 463-202-6046; @wildbramblecatering;
//     studio and tastings by appointment.
//   https://www.wildbramblecatering.com/about       a family kitchen ("the work
//     of a mother of four"); cooking around Alpha-Gal, gluten and FODMAP;
//     produce, meat and dairy from farms within a day's drive; the family
//     hunts and forages its own 75 acres; menus tested and pastries finished
//     the morning of each event at the studio kitchen, 4389 North Long Rd,
//     Suite 202, Columbus, IN 47203.
//   https://www.wildbramblecatering.com/menu        the dishes below, by their
//     section names, and the six dietary badges. No prices.
//   https://www.wildbramblecatering.com/meal-prep   weekly; menu posted
//     Thursday for the next week; Sunday evening studio pickup or local
//     delivery for a small flat fee; from about $8 a serving; their own
//     estimates of about $580 a month for a family of four and $290 for two,
//     four meals a week, pricing varies by menu.
//   https://www.wildbramblecatering.com/gift-a-meal delivery, porch drop or
//     studio pickup; rotating menu or a curated mix.
//   https://www.wildbramblecatering.com/contact     the inquiry form's event
//     types and service styles; a reply with menu ideas and a proposal within
//     three business days; weddings 4 to 8 months ahead when possible, private
//     dinners often 2 to 4 weeks.
//   https://www.wildbramblecatering.com/availability a calendar of booked and
//     open dates; a booked date can sometimes still take a second event.
// Heart of Columbus lists them (src/data/added.mjs, checked 2026-11-24) with
// the same phone, website and Instagram. Their contact section ALSO shows
// 812-374-6011; 463-202-6046 is on their home page, footer, meal prep page and
// Heart of Columbus, so that is the one shown, and the other is noted.
// No owner is named on their site, so none is named here. Their words are
// paraphrased except one short quote; dish names are theirs as written. They
// have not reviewed this page.

const ORIGIN = "https://www.wildbramblecatering.com";

export const WILD_BRAMBLE = {
  slug: "wild-bramble-catering",
  name: "Wild Bramble Catering",
  origin: ORIGIN,
  since: "2020",
  guests: { min: 10, max: 100 },
  email: "hello@wildbramblecatering.com",
  phone: "463-202-6046",
  tel: "+14632026046",
  otherPhone: "812-374-6011",
  instagram: "https://www.instagram.com/wildbramblecatering/",
  street: "4389 North Long Rd, Suite 202",
  cityLine: "Columbus, IN 47203",
  quote: "with what’s ripe, from scratch, and with hospitable detail",
  links: {
    quote: `${ORIGIN}/contact`,
    availability: `${ORIGIN}/availability`,
    fullMenu: `${ORIGIN}/full-menu`,
    mealPlan: `${ORIGIN}/meal-prep/start`,
    mealPrep: `${ORIGIN}/meal-prep`,
    gift: `${ORIGIN}/gift-meals`,
    about: `${ORIGIN}/about`,
    menu: `${ORIGIN}/menu`,
    hoc: "https://heartofcolumbus.shop/b/wild-bramble-catering/",
    directions:
      "https://www.google.com/maps/dir/?api=1&destination=4389+North+Long+Rd%2C+Suite+202%2C+Columbus%2C+IN+47203",
    map: "https://www.google.com/maps?q=4389+North+Long+Rd%2C+Columbus%2C+IN+47203&output=embed",
  },
  checked: "2026-11-25",
} as const;

export const DIETS = ["Peanut free", "Gluten free", "Alpha-Gal friendly", "Vegetarian", "Vegan", "FODMAP friendly"] as const;

/** Their contact form's own choices, so a menu sent from here reads like their form. */
export const EVENT_TYPES = ["Wedding", "Private dinner", "Corporate", "Grazing", "Other"] as const;
export const SERVICE_STYLES = [
  "Drop off only",
  "Drop off and pick up",
  "Full service (staff stay on site to serve)",
  "Not sure yet",
] as const;

export type Dish = { name: string; note?: string };
export type Course = { key: string; title: string; about: string; dishes: Dish[] };

export const MENU: Course[] = [
  {
    key: "begin",
    title: "To Begin",
    about: "Grazing, small bites and things to pass",
    dishes: [
      { name: "Wild Bramble Grazing Board", note: "Aged cheeses, cured meats, honeycomb, fruit and crackers" },
      { name: "Eggplant Caponata with Labneh" },
      { name: "Teriyaki Chicken Skewers" },
      { name: "Mini Quiche Varieties", note: "Rotating savory fillings" },
    ],
  },
  {
    key: "sunrise",
    title: "After Sunrise",
    about: "Morning favorites and brunch comfort",
    dishes: [
      { name: "Orange Chocolate Chip Scones" },
      { name: "Rustic Quiche" },
      { name: "Blueberry Crumble Cake" },
      { name: "Mexican Breakfast Casserole", note: "Gluten free, with gallo pinto" },
    ],
  },
  {
    key: "midday",
    title: "Midday Delights",
    about: "Lunch bowls, sandwiches and hearty comfort",
    dishes: [
      { name: "Korean Power Bowls" },
      { name: "Creamy Chicken and Wild Rice Soup" },
      { name: "Mediterranean Chicken Pita Sandwiches" },
      { name: "Hot Potato Bar" },
    ],
  },
  {
    key: "table",
    title: "The Table",
    about: "Family style and plated main courses",
    dishes: [
      { name: "Chicken Parmesan Bake", note: "Gluten free option" },
      { name: "Slow Roasted Savory Brisket" },
      { name: "Red Lentil with Spinach Masala", note: "Vegetarian, or with chicken" },
      { name: "Tajiq Inspired Mediterranean Dish" },
      { name: "Creamy White Chicken Enchiladas" },
      { name: "Spicy Cajun Shrimp" },
    ],
  },
  {
    key: "garden",
    title: "From the Garden",
    about: "Seasonal sides and salads",
    dishes: [{ name: "Honey Glazed Carrots" }, { name: "Chopped Salad" }, { name: "Cranberry Lime Coleslaw" }, { name: "Roasted Root Medley" }],
  },
  {
    key: "finish",
    title: "To Finish",
    about: "Desserts made in house",
    dishes: [
      { name: "Wild Bramble Berry Tart" },
      { name: "Berry Loveable Pavlova" },
      { name: "Decadent Peanut Butter Pie" },
      { name: "Raspberry Cream Angel Food Cake" },
      { name: "Signature Sweets", note: "A rotating mix of cakes, cookies and pies" },
    ],
  },
];

const ALL = new Set(MENU.flatMap((c) => c.dishes.map((d) => d.name)));
export const isDish = (name: string) => ALL.has(name);

// ---------- The menu request a visitor sends them ----------

export type MenuRequest = {
  picks: string[];
  eventType: string;
  date: string;
  time: string;
  guests: number;
  place: string;
  service: string;
  budget: string;
  diets: string[];
  allergies: string;
  notes: string;
};

const one = (v: string, max: number) =>
  String(v || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);

export function clampGuests(n: number): number {
  const v = Math.round(Number(n) || 0);
  return Math.min(Math.max(v, 1), 500);
}

/** Picks grouped under their courses, in menu order; unknown names dropped. */
export function picksByCourse(picks: string[]): { title: string; dishes: string[] }[] {
  const set = new Set(picks.filter(isDish));
  return MENU.map((c) => ({ title: c.title, dishes: c.dishes.map((d) => d.name).filter((n) => set.has(n)) })).filter((c) => c.dishes.length);
}

/** The plain text of a menu request, in the order of their own inquiry form. */
export function requestText(r: MenuRequest): string {
  const lines: string[] = ["Hello Wild Bramble,", "", "I found you through Crossroads Wedding and Event Co. and put together a menu I'd love a proposal for.", ""];
  const add = (k: string, v: string) => {
    if (v) lines.push(`${k}: ${v}`);
  };
  add("Event type", (EVENT_TYPES as readonly string[]).includes(r.eventType) ? r.eventType : "");
  add("Date", /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "");
  add("Time", one(r.time, 20));
  add("Guest count", r.guests ? String(clampGuests(r.guests)) : "");
  add("Location", one(r.place, 160));
  add("Service", (SERVICE_STYLES as readonly string[]).includes(r.service) ? r.service : "");
  add("Target budget", one(r.budget, 60));
  const diets = r.diets.filter((d) => (DIETS as readonly string[]).includes(d));
  add("Dietary needs", [diets.join(", "), one(r.allergies, 200)].filter(Boolean).join(". "));
  const groups = picksByCourse(r.picks);
  if (groups.length) {
    lines.push("", "Dishes I'm interested in:");
    for (const g of groups) lines.push(`${g.title}: ${g.dishes.join(", ")}`);
  }
  const notes = one(r.notes, 600);
  if (notes) lines.push("", notes);
  lines.push("", "Thank you!");
  return lines.join("\n");
}

/** mailto: to their own inbox. Nothing passes through Crossroads. */
export function requestMailto(email: string, r: MenuRequest): string {
  const subject = `Menu request${r.eventType && r.eventType !== "Other" ? `: ${r.eventType}` : ""}${r.date ? ` on ${r.date}` : ""}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(requestText(r))}`;
}

/** Their own lead times, for the date the visitor picked. `today` is YYYY-MM-DD in Columbus. */
export function leadTimeNote(eventType: string, date: string, today: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return "";
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  if (days < 0) return "That date has passed.";
  if (eventType === "Wedding" && days < 120)
    return "They ask for 4 to 8 months for weddings when possible, so ask soon. Their calendar says to reach out anyway.";
  if (days < 14) return "That's close. Private dinners often need 2 to 4 weeks, so call them too.";
  return "";
}
