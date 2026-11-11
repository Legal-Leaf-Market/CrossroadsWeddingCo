// Client-safe shapes and limits for the public wedding website (/w/<slug>).

export const MAX_SITE_LINKS = 6;
export const MAX_SITE_FAQ = 12;
export const MAX_STORY = 3000;

export type SiteLink = { label: string; url: string };
export type SiteFaq = { q: string; a: string };

/** http(s) only, scheme added when missing; anything else is dropped, never rendered. */
export function safeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeLinks(v: unknown): SiteLink[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ label: String((x as SiteLink)?.label ?? "").trim().slice(0, 80), url: String((x as SiteLink)?.url ?? "").trim().slice(0, 500) }))
    .filter((x) => x.url)
    .slice(0, MAX_SITE_LINKS);
}

export function normalizeFaq(v: unknown): SiteFaq[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ q: String((x as SiteFaq)?.q ?? "").trim().slice(0, 200), a: String((x as SiteFaq)?.a ?? "").trim().slice(0, 1500) }))
    .filter((x) => x.q && x.a)
    .slice(0, MAX_SITE_FAQ);
}

/** "15:30" -> "3:30 PM". */
export function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
