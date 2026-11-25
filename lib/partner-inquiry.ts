// A partner inquiry, checked (2026-11-25, the Rabbit's Balloons form). Pure and
// import free, so scripts/verify-balloon-studio.mjs tests the same rules the
// route (app/api/partners/inquiry) enforces. Rachael has no public inbox yet,
// so the inquiry comes to Crossroads to pass on; nothing here is a price, a
// booking or a promise on her behalf.

export const OCCASIONS = ["Wedding", "Bridal or baby shower", "Corporate event", "Birthday or private party", "Something else"] as const;
export const BUDGETS = ["Under $250", "$250 to $500", "$500 to $1,000", "$1,000 to $2,500", "$2,500 and up"] as const;

export type Inquiry = {
  name: string;
  contact: string;
  email: string;
  phone: string;
  occasion: string;
  date: string;
  venue: string;
  colors: string;
  budget: string;
  more: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);

/** Ten or more digits reads as a phone number. */
export const looksLikePhone = (s: string) => (s.match(/\d/g) || []).length >= 10 && /^[\d\s().+-]+$/.test(s);

/**
 * `today` is YYYY-MM-DD in Columbus. A date in the past is dropped rather than
 * refused: the person still gets through, and the date was a typo.
 */
export function cleanInquiry(body: Record<string, unknown>, today: string): { ok: true; data: Inquiry } | { ok: false; error: string } {
  if (clip(body.website, 200)) return { ok: false, error: "bot" };
  const name = clip(body.name, 120);
  const contact = clip(body.contact, 160);
  if (!name) return { ok: false, error: "Add your name so we know who to call." };
  if (!contact) return { ok: false, error: "Add an email or a phone number so we can reach you." };
  const email = EMAIL_RE.test(contact) ? contact : "";
  const phone = !email && looksLikePhone(contact) ? contact : "";
  if (!email && !phone) return { ok: false, error: "That doesn't look like an email or a phone number." };
  const occasion = (OCCASIONS as readonly string[]).includes(String(body.occasion)) ? String(body.occasion) : "Something else";
  const rawDate = clip(body.date, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate >= today && rawDate <= "2035-12-31" ? rawDate : "";
  const budget = (BUDGETS as readonly string[]).includes(String(body.budget)) ? String(body.budget) : "";
  return {
    ok: true,
    data: {
      name,
      contact,
      email,
      phone,
      occasion,
      date,
      venue: clip(body.venue, 160),
      colors: clip(body.colors, 300),
      budget,
      more: clip(body.more, 2000),
    },
  };
}

/** The lines the owner's email and the saved lead carry, in reading order. */
export function inquiryLines(d: Inquiry): [string, string][] {
  return [
    ["Occasion", d.occasion],
    ["Date", d.date],
    ["Venue or town", d.venue],
    ["Colors", d.colors],
    ["Budget", d.budget],
    ["Anything else", d.more],
  ];
}
