// Conversions the costing editors share: what the owner types (dollars,
// percents, hours) to what is stored (cents, basis points, minutes) and back.
// Blank means "not set", never zero.

export function centsToText(c: number | null | undefined): string {
  if (c == null) return "";
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2);
}

export function textToCents(s: string): number | null {
  const t = s.replace(/[$,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function bpsToText(b: number | null | undefined): string {
  if (b == null) return "";
  return String(b / 100);
}

export function textToBps(s: string): number | null {
  const t = s.replace(/[%\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
}

export function minutesToText(m: number | null | undefined): string {
  if (m == null) return "";
  const h = m / 60;
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100);
}

/** Hours as typed: "6", "6.5", or "6:30". */
export function textToMinutes(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const hm = /^(\d+):([0-5]\d)$/.exec(t);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 60) : null;
}

export function textToQty(s: string): number | null {
  const t = s.replace(/[,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export const inputClass =
  "w-full rounded-lg border border-parchment bg-cream px-2.5 py-1.5 text-sm text-charcoal focus:border-terracotta focus:outline-none";

export const ROLE_SUGGESTIONS = [
  "DJ",
  "MC",
  "DJ / MC",
  "Acoustic set",
  "Bartender",
  "Stage manager",
  "Officiant",
  "Shadowing",
  "Setup and teardown",
  "Load in / load out",
  "Travel",
  "Planning call",
  "Rehearsal",
];
