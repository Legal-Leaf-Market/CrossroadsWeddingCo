// Ordering from a partner's own Shopify store, from this site (2026-11-25,
// Jacob: "make their page orderable on this site, just like it is on Heart of
// Columbus"). Pure and import free, so the client cart, the server page and
// scripts/verify-cookie-order.mjs all run the same code.
//
// The pattern is Heart of Columbus's (public/js/cart.js there): read the
// shop's public /products.json, show only what is in stock AND photographed
// (Jacob's rule for shop listings), keep the cart in the visitor's browser,
// and hand the whole cart to the shop's OWN checkout through a Shopify cart
// permalink (/cart/<variant>:<qty>,...). Crossroads never takes an order or a
// payment: the shopper pays the shop on the shop's site.

export type ShopVariant = { id: string; title: string; price: number; available: boolean };
export type ShopItem = {
  id: string;
  handle: string;
  title: string;
  type: string;
  url: string;
  image: string;
  blurb: string;
  variants: ShopVariant[];
};
export type CartLine = {
  variantId: string;
  handle: string;
  title: string;
  variant: string;
  price: number;
  image: string;
  qty: number;
};

// ---------- Text ----------

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  eacute: "é",
  ecirc: "ê",
};

export function decodeEntities(s: string): string {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** The site's standing rule: no em or en dashes anywhere a person reads. */
export function noDash(s: string, sep = ", "): string {
  return String(s || "")
    .replace(/\s*[—–]\s*/g, sep)
    .replace(/\s+-\s+/g, sep)
    .trim();
}

/** "24-Cookie Gift Box — The Team Thank You" reads "24-Cookie Gift Box: The Team Thank You". */
export function cleanTitle(s: string): string {
  return noDash(decodeEntities(s), ": ");
}

/** A short line from the shop's own product description, or "". */
export function blurbFrom(html: string, max = 150): string {
  const text = noDash(
    decodeEntities(
      String(html || "")
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (stop > 40) return cut.slice(0, stop + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

export function money(n: number): string {
  const v = Number(n) || 0;
  return `$${v % 1 ? v.toFixed(2) : v.toFixed(0)}`;
}

export function money2(n: number): string {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

// ---------- Catalog ----------

type RawVariant = { id?: number | string; title?: string; price?: string | number; available?: boolean };
type RawProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
  product_type?: string;
  body_html?: string;
  images?: { src?: string }[];
  variants?: RawVariant[];
};

/** Shopify's CDN resizes on request; 600px covers a 2x phone card. */
export function sizedImage(src: string, width = 600): string {
  if (!src) return "";
  if (!/^https:\/\/(?:cdn\.shopify\.com\/|[^/]+\/cdn\/shop\/)/.test(src) || /[?&]width=/.test(src)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}width=${width}`;
}

/**
 * The shop's /products.json, as the menu shows it: in stock AND photographed
 * only (Jacob's rule), sold-out sizes dropped, store order kept.
 */
export function mapShopifyProducts(origin: string, products: RawProduct[]): ShopItem[] {
  const base = String(origin || "").replace(/\/+$/, "");
  const out: ShopItem[] = [];
  for (const p of products || []) {
    if (!p || !p.title || !p.handle || !/^[a-z0-9][a-z0-9-]*$/i.test(p.handle)) continue;
    const image = p.images && p.images[0] && p.images[0].src ? sizedImage(String(p.images[0].src)) : "";
    if (!image) continue;
    const variants: ShopVariant[] = (p.variants || [])
      .filter((v) => v && v.id != null && v.available !== false && Number(v.price) > 0)
      .map((v) => ({
        id: String(v.id),
        title: !v.title || v.title === "Default Title" ? "" : cleanTitle(String(v.title)),
        price: Math.round(Number(v.price) * 100) / 100,
        available: true,
      }));
    if (!variants.length) continue;
    out.push({
      id: String(p.id ?? p.handle),
      handle: p.handle,
      title: cleanTitle(p.title),
      type: cleanTitle(p.product_type || ""),
      url: `${base}/products/${p.handle}`,
      image,
      blurb: blurbFrom(p.body_html || ""),
      variants,
    });
  }
  return out;
}

export const isBox = (it: ShopItem) => /\bbox(es)?\b/i.test(`${it.title} ${it.type}`);
export const isHoliday = (it: ShopItem) => /christmas|holiday|thanksgiving|valentine|easter/i.test(it.title);

export function lowPrice(it: ShopItem): number {
  return Math.min(...it.variants.map((v) => v.price));
}

/** True when the sizes or mixes are not all one price. */
export const pricesVary = (it: ShopItem) => new Set(it.variants.map((v) => v.price)).size > 1;

/** "$4", or "From $159.90" only when the price really does depend on the choice. */
export function priceLabel(it: ShopItem): string {
  return pricesVary(it) ? `From ${money(lowPrice(it))}` : money(it.variants[0].price);
}

/** Gift boxes sold by cookie count ("6-Cookie Gift Box"), for the planner. */
export function countedBoxes(items: ShopItem[]): { size: number; item: ShopItem }[] {
  const out: { size: number; item: ShopItem }[] = [];
  for (const it of items) {
    const m = it.title.match(/^(\d{1,3})-Cookie Gift Box\b/i);
    if (m && Number(m[1]) > 0) out.push({ size: Number(m[1]), item: it });
  }
  return out.sort((a, b) => b.size - a.size);
}

// ---------- Planner ----------

export type BoxOption = { size: number; price: number };
export type BoxPlan = { cookies: number; cost: number; boxes: number; picks: { size: number; count: number }[] };

/**
 * Fewest wasted cookies covering `need`, then the lowest cost, then the fewest
 * boxes. A small dynamic program, so a price that breaks the pattern (a box
 * that is cheaper per cookie) still lands right.
 */
export function boxPlan(need: number, options: BoxOption[]): BoxPlan | null {
  const sizes = options.filter((o) => o.size > 0 && o.price > 0);
  const n = Math.floor(Number(need) || 0);
  if (!sizes.length || n <= 0 || n > 5000) return null;
  const top = n + Math.max(...sizes.map((o) => o.size));
  type Cell = { cost: number; boxes: number; from: number; size: number } | null;
  const best: Cell[] = new Array(top + 1).fill(null);
  best[0] = { cost: 0, boxes: 0, from: -1, size: 0 };
  for (let t = 1; t <= top; t++) {
    for (const o of sizes) {
      const prev = t - o.size >= 0 ? best[t - o.size] : null;
      if (!prev) continue;
      const cost = Math.round((prev.cost + o.price) * 100) / 100;
      const boxes = prev.boxes + 1;
      const cur = best[t];
      if (!cur || cost < cur.cost || (cost === cur.cost && boxes < cur.boxes)) best[t] = { cost, boxes, from: t - o.size, size: o.size };
    }
  }
  for (let t = n; t <= top; t++) {
    if (!best[t]) continue;
    const counts = new Map<number, number>();
    for (let k = t; k > 0; k = best[k]!.from) counts.set(best[k]!.size, (counts.get(best[k]!.size) || 0) + 1);
    const picks = [...counts].map(([size, count]) => ({ size, count })).sort((a, b) => b.size - a.size);
    return { cookies: t, cost: best[t]!.cost, boxes: best[t]!.boxes, picks };
  }
  return null;
}

// ---------- Checkout handoff ----------

export const REF = "crossroadsweddingco";

/** The order note the shop sees on the order. */
export function orderNote(opts: { pickup?: boolean; note?: string }): string {
  const parts: string[] = [];
  if (opts.pickup) parts.push("Pickup at the trailer, please.");
  const own = noDash(String(opts.note || "").replace(/\s+/g, " ")).slice(0, 200).trim();
  if (own) parts.push(/[.!?]$/.test(own) ? own : `${own}.`);
  parts.push("Sent from Crossroads Wedding and Event Co.");
  return parts.join(" ");
}

/**
 * One Shopify cart permalink carrying every line, the order note, Shopify's own
 * `ref` and a cart attribute, so the shop can see the order came from us.
 */
export function cartPermalink(origin: string, lines: CartLine[], note: string, click = ""): string {
  const base = String(origin || "").replace(/\/+$/, "");
  const parts = lines
    .filter((l) => /^\d+$/.test(l.variantId) && l.qty > 0)
    .map((l) => `${l.variantId}:${Math.min(Math.floor(l.qty), 999)}`);
  const q = new URLSearchParams();
  if (note) q.set("note", note);
  q.set("ref", REF);
  q.set("attributes[crossroads_ref]", click || "partner-page");
  q.set("utm_source", REF);
  q.set("utm_medium", "referral");
  q.set("utm_campaign", "partner-cookie-paradise");
  return `${parts.length ? `${base}/cart/${parts.join(",")}` : `${base}/cart`}?${q.toString()}`;
}

/** Add one of a variant (or `qty`) to a cart, capped so a stuck tap can't run away. */
export function addLine(cart: CartLine[], line: Omit<CartLine, "qty">, qty = 1): CartLine[] {
  const hit = cart.find((l) => l.variantId === line.variantId);
  if (hit) return cart.map((l) => (l === hit ? { ...l, qty: Math.min(l.qty + qty, 999) } : l));
  return [...cart, { ...line, qty: Math.min(Math.max(1, qty), 999) }];
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((a, l) => a + l.qty, 0);
}

export function cartTotal(cart: CartLine[]): number {
  return Math.round(cart.reduce((a, l) => a + l.price * l.qty, 0) * 100) / 100;
}

/** Lines read back from localStorage: anything malformed is dropped, never trusted. */
export function sanitizeCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is CartLine =>
        !!l &&
        typeof l === "object" &&
        /^\d+$/.test(String((l as CartLine).variantId)) &&
        typeof (l as CartLine).title === "string" &&
        Number((l as CartLine).qty) > 0 &&
        Number((l as CartLine).price) >= 0,
    )
    .slice(0, 50)
    .map((l) => ({
      variantId: String(l.variantId),
      handle: String(l.handle || ""),
      title: String(l.title).slice(0, 120),
      variant: String(l.variant || "").slice(0, 80),
      price: Number(l.price),
      image: /^https:\/\//.test(String(l.image)) ? String(l.image) : "",
      qty: Math.min(Math.floor(Number(l.qty)), 999),
    }));
}

// ---------- Hours, in Columbus time ----------

export const VENUE_TZ = "America/Indiana/Indianapolis";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** [day (0 is Sunday), opens, closes] in minutes after midnight. */
export type HoursRow = [number, number, number];

export function venueClock(now: Date): { day: number; minutes: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    day,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export function clock(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}

export function openStatus(hours: HoursRow[], now: Date): { open: boolean; text: string } {
  const { day, minutes } = venueClock(now);
  const on = (d: number) => hours.find((h) => h[0] === d) || null;
  const today = on(day);
  if (today && minutes >= today[1] && minutes < today[2]) return { open: true, text: `Open now until ${clock(today[2])}` };
  if (today && minutes < today[1]) return { open: false, text: `Opens today at ${clock(today[1])}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const h = on(d);
    if (h) return { open: false, text: `Closed now. Opens ${i === 1 ? "tomorrow" : DAYS[d]} at ${clock(h[1])}` };
  }
  return { open: false, text: "Closed" };
}

/** Monday first, the way people read a week of hours. */
export function hoursTable(hours: HoursRow[]): { day: number; name: string; text: string }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = hours.find((r) => r[0] === d);
    return { day: d, name: DAYS[d], text: h ? `${clock(h[1])} to ${clock(h[2])}` : "Closed" };
  });
}

/** True once `until` (YYYY-MM-DD) is over in Columbus. */
export function isOver(until: string, now: Date): boolean {
  return venueClock(now).date > until;
}
