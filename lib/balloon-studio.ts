// The Rabbit's Balloons Color Studio (2026-11-25, Jacob: "now do that same for
// rabbit's balloons"), ported from the site preview Heart of Columbus built for
// Rachael Starr (Legal-Leaf-Market/RabbitsBalloons, index.html). Pure and
// import free: the page, the inquiry form and scripts/verify-balloon-studio.mjs
// run the same code.
//
// Color names are Sempertex latex colors by line and name, from the Betallic
// 2026 Sempertex color chart
// (https://cdn.shopify.com/s/files/1/0607/6900/9796/files/Sempertex26_ColorChart.pdf)
// and LA Balloons' Sempertex color guide
// (https://laballoons.com/pages/latex-colors-by-brand-sempertex6), checked
// 2026-11-15. Neither publishes screen colors, so every hex value is our own
// approximation, and the page says colors on screen are approximate.

export type BalloonColor = { family: string; name: string; hex: string };

const RAW: [string, string, string, string][] = [
  ["Whites and neutrals", "Fashion", "White", "#fbfaf6"],
  ["Whites and neutrals", "Pastel Dusk", "Cream", "#f3e6cf"],
  ["Whites and neutrals", "Deluxe", "White Sand", "#ead9bf"],
  ["Whites and neutrals", "Deluxe", "Almond White", "#f1e7d8"],
  ["Whites and neutrals", "Silk", "Oyster White", "#ece4d9"],
  ["Whites and neutrals", "Reflex", "Champagne", "#d8c09c"],
  ["Whites and neutrals", "Deluxe", "Latte", "#c8a888"],
  ["Whites and neutrals", "Deluxe", "Mocha", "#9c7a62"],
  ["Whites and neutrals", "Deluxe", "Urban Grey", "#9a9ea3"],
  ["Whites and neutrals", "Deluxe", "Black", "#232125"],
  ["Pinks and peaches", "Pastel Matte", "Pink", "#f6b6c7"],
  ["Pinks and peaches", "Pastel Dusk", "Rose", "#e6b1ae"],
  ["Pinks and peaches", "Silk", "Pink Blossom", "#f3c8cf"],
  ["Pinks and peaches", "Deluxe", "Creamy Blush", "#f1cbbd"],
  ["Pinks and peaches", "Deluxe", "Peach Blush", "#f2b79f"],
  ["Pinks and peaches", "Pastel Matte", "Nude", "#efc8b0"],
  ["Pinks and peaches", "Pastel Matte", "Melon", "#f8a98d"],
  ["Pinks and peaches", "Pastel Matte", "Malibu Peach", "#f6b48c"],
  ["Pinks and peaches", "Deluxe", "Tropical Coral", "#f0806b"],
  ["Pinks and peaches", "Deluxe", "Rosewood", "#c28984"],
  ["Pinks and peaches", "Fashion", "Bubble Gum Pink", "#f28fb4"],
  ["Pinks and peaches", "Reflex", "Rose Gold", "#d6a08c"],
  ["Reds and berries", "Deluxe", "Fuchsia", "#d4347f"],
  ["Reds and berries", "Deluxe", "Raspberry", "#b3385e"],
  ["Reds and berries", "Fashion", "Red", "#d7262f"],
  ["Reds and berries", "Deluxe", "Imperial Red", "#b31f2b"],
  ["Reds and berries", "Deluxe", "Merlot", "#6d1f2c"],
  ["Oranges and yellows", "Deluxe", "Terracotta", "#c6674b"],
  ["Oranges and yellows", "Deluxe", "Sunset Orange", "#ef8a3d"],
  ["Oranges and yellows", "Fashion", "Orange", "#f27022"],
  ["Oranges and yellows", "Pastel Matte", "Yellow", "#f7e18a"],
  ["Oranges and yellows", "Fashion", "Yellow", "#f8d325"],
  ["Oranges and yellows", "Deluxe", "Honey Yellow", "#f1bc44"],
  ["Oranges and yellows", "Deluxe", "Mustard", "#d7a22f"],
  ["Oranges and yellows", "Reflex", "Gold", "#c8a14b"],
  ["Greens", "Pastel Matte", "Green", "#a8dbbe"],
  ["Greens", "Silk", "Cool Mint", "#bde3d4"],
  ["Greens", "Pastel Dusk", "Green Tea", "#b8c8a3"],
  ["Greens", "Pastel Dusk", "Laurel Green", "#9eb38f"],
  ["Greens", "Deluxe", "Eucalyptus", "#8ea793"],
  ["Greens", "Deluxe", "Key Lime", "#b5d25b"],
  ["Greens", "Fashion", "Green", "#48a54a"],
  ["Greens", "Deluxe", "Shamrock Green", "#2e9a53"],
  ["Greens", "Fashion", "Forest Green", "#2f593c"],
  ["Blues", "Pastel Matte", "Blue", "#a7d3ef"],
  ["Blues", "Silk", "Arctic Blue", "#c2def0"],
  ["Blues", "Pastel Dusk", "Blue", "#a8bed5"],
  ["Blues", "Fashion", "Robin's Egg Blue", "#8ed2d5"],
  ["Blues", "Deluxe", "Turquoise Blue", "#3cb6c3"],
  ["Blues", "Deluxe", "Deep Teal", "#2b6e72"],
  ["Blues", "Deluxe", "Periwinkle Blue", "#8d97ce"],
  ["Blues", "Fashion", "Blue", "#3a7fcf"],
  ["Blues", "Fashion", "Royal Blue", "#1f4fa7"],
  ["Blues", "Fashion", "Navy Blue", "#1e2c55"],
  ["Purples", "Pastel Matte", "Lilac", "#ccb3e9"],
  ["Purples", "Pastel Dusk", "Lavender", "#c0afd5"],
  ["Purples", "Deluxe", "Lilac", "#b8a1d3"],
  ["Purples", "Fashion", "Violet", "#6a3f9f"],
];

export const COLORS: BalloonColor[] = RAW.map(([family, line, color, hex]) => ({ family, name: `${line} ${color}`, hex }));
const BY = new Map(COLORS.map((c) => [c.name, c]));
export const colorByName = (name: string): BalloonColor | undefined => BY.get(name);

export const PALETTES: { name: string; colors: string[] }[] = [
  { name: "Garden party", colors: ["Pastel Matte Pink", "Pastel Dusk Cream", "Deluxe Eucalyptus", "Pastel Matte Malibu Peach", "Pastel Dusk Laurel Green"] },
  { name: "Sorbet", colors: ["Pastel Matte Melon", "Pastel Matte Yellow", "Pastel Matte Lilac", "Pastel Matte Blue", "Pastel Matte Pink", "Pastel Matte Green"] },
  { name: "Wedding white", colors: ["Pastel Dusk Cream", "Deluxe White Sand", "Silk Oyster White", "Reflex Champagne", "Deluxe Eucalyptus"] },
  { name: "Boardroom", colors: ["Fashion Navy Blue", "Pastel Matte Blue", "Fashion White", "Reflex Gold", "Silk Arctic Blue"] },
  { name: "Desert sunset", colors: ["Deluxe Peach Blush", "Deluxe Terracotta", "Deluxe Mustard", "Pastel Dusk Rose", "Pastel Dusk Cream"] },
  { name: "Lavender fields", colors: ["Pastel Matte Lilac", "Pastel Dusk Lavender", "Pastel Dusk Cream", "Deluxe Eucalyptus", "Deluxe Lilac"] },
  { name: "Baby blue", colors: ["Pastel Matte Blue", "Silk Arctic Blue", "Pastel Dusk Cream", "Fashion White", "Pastel Dusk Blue"] },
  { name: "Crimson and cream", colors: ["Deluxe Imperial Red", "Pastel Dusk Cream", "Fashion White", "Reflex Champagne"] },
];

export const MAX_COLORS = 6;
export type Shape = "arch" | "garland" | "columns";
export const SHAPE_LABEL: Record<Shape, string> = { arch: "Organic arch", garland: "Garland", columns: "Columns" };

// ---------- Matching a color (a logo, a team color) to the closest balloon ----------

function lab(hex: string): [number, number, number] {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  });
  const x = (v[0] * 0.4124 + v[1] * 0.3576 + v[2] * 0.1805) / 0.95047;
  const y = v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
  const z = (v[0] * 0.0193 + v[1] * 0.1192 + v[2] * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const LABS = COLORS.map((c) => lab(c.hex));

/** The Sempertex color closest to any #rrggbb, by CIELAB distance. */
export function nearestColor(hex: string): BalloonColor {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000";
  const t = lab(h);
  let best = 0;
  let bd = Infinity;
  LABS.forEach((l, i) => {
    const d = (l[0] - t[0]) ** 2 + (l[1] - t[1]) ** 2 + (l[2] - t[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return COLORS[best];
}

// ---------- Editing a palette ----------

export type PaletteResult = { colors: string[]; message: string };

export function addToPalette(colors: string[], name: string): PaletteResult {
  if (!BY.has(name)) return { colors, message: "" };
  if (colors.includes(name)) return { colors, message: `${name} is already in your palette.` };
  if (colors.length >= MAX_COLORS) return { colors, message: "Six colors is the max. Remove one first." };
  return { colors: [...colors, name], message: "" };
}

/** What the inquiry form's Colors line says. */
export function paletteLine(shape: Shape, colors: string[]): string {
  return colors.length ? `${SHAPE_LABEL[shape]}: ${colors.join(", ")}` : "";
}

// ---------- The preview: a deterministic scatter of balloons ----------

export type Circle = { x: number; y: number; r: number; fill: string };

function rng(seed: number) {
  let s = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Pt = { x: number; y: number; k: number };
function arc(cx: number, by: number, rx: number, ry: number, n: number, fat: number): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.PI - (Math.PI * i) / n;
    p.push({ x: cx + rx * Math.cos(t), y: by - ry * Math.sin(t), k: 1 + fat * (1 - Math.sin(t)) });
  }
  return p;
}

function points(shape: Shape): Pt[] {
  if (shape === "arch") return arc(320, 392, 212, 292, 46, 0.42);
  const p: Pt[] = [];
  if (shape === "garland") {
    for (let x = 40; x <= 600; x += 15) {
      const u = (x - 40) / 560;
      p.push({ x, y: 96 + Math.sin(u * Math.PI) * 120, k: 0.92 + 0.25 * Math.sin(u * Math.PI) });
    }
    for (let j = 1; j <= 7; j++) {
      p.push({ x: 44 - j * 1.5, y: 96 + j * 30, k: 0.95 - j * 0.07 });
      p.push({ x: 596 + j * 1.5, y: 96 + j * 30, k: 0.95 - j * 0.07 });
    }
    return p;
  }
  for (const cx of [180, 460]) {
    for (let y = 390; y >= 150; y -= 17) p.push({ x: cx + Math.sin(y / 30) * 6, y, k: y > 330 ? 1.25 : 0.92 });
    p.push({ x: cx, y: 118, k: 1.35 }, { x: cx - 30, y: 134, k: 0.9 }, { x: cx + 30, y: 132, k: 0.9 });
  }
  return p;
}

/**
 * Big balloons along the shape, small ones tucked around them. The first color
 * in the palette is used most. Same shape, palette and seed: same picture, so
 * the server render and the browser agree.
 */
export function layout(shape: Shape, colors: string[], seed: number): Circle[] {
  const r = rng(seed);
  const cols = (colors.length ? colors : ["Pastel Dusk Cream"]).map((n) => BY.get(n)?.hex || "#f3e6cf");
  const w = cols.map((_, i) => Math.pow(0.78, i));
  const tot = w.reduce((a, b) => a + b, 0);
  const pick = () => {
    let x = r() * tot;
    for (let i = 0; i < w.length; i++) {
      x -= w[i];
      if (x <= 0) return cols[i];
    }
    return cols[0];
  };
  const big = shape === "columns" ? 25 : 28;
  const bigs: Circle[] = [];
  const smalls: Circle[] = [];
  for (const p of points(shape)) {
    let R = big * p.k * (0.8 + r() * 0.32);
    if (r() < 0.1) R *= 1.35;
    const x = p.x + (r() - 0.5) * 12;
    const y = p.y + (r() - 0.5) * 12;
    bigs.push({ x, y, r: R, fill: pick() });
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = R * (0.68 + r() * 0.42);
      const sc = r() < 0.55 ? 0.42 + r() * 0.2 : 0.2 + r() * 0.1;
      smalls.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: R * sc, fill: pick() });
    }
  }
  const round = (c: Circle): Circle => ({ x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, r: Math.round(c.r * 10) / 10, fill: c.fill });
  return [...bigs, ...smalls].map(round);
}
