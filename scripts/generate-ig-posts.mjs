// Renders the Instagram post images into content/instagram/ at 1080x1080.
//
// Uses the same next/og + satori pipeline as app/opengraph-image.tsx, so the
// posts come out in the site's palette and typefaces. Run with:
//   pnpm ig:posts
//
// next/og resolves only through the bundler, so this imports the file path.
import { ImageResponse } from "next/og.js";
import React from "react";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "content", "instagram");
const SIZE = 1080;

const COLORS = {
  charcoal: "#2b2622",
  cream: "#faf5ec",
  parchment: "#f1e6d3",
  terracotta: "#c1633d",
  gold: "#cf9d4c",
  muted: "#a49a8e",
  ink: "#3d362f",
};

const LEGACY_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25";

async function loadGoogleFont(family, weight) {
  const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, {
    headers: { "User-Agent": LEGACY_UA },
  });
  if (!cssRes.ok) throw new Error(`${family} ${weight}: CSS request failed (${cssRes.status})`);

  const url = (await cssRes.text()).match(/src: url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`${family} ${weight}: no .ttf in the CSS response`);

  const fontRes = await fetch(url);
  if (!fontRes.ok) throw new Error(`${family} ${weight}: font download failed (${fontRes.status})`);

  return await fontRes.arrayBuffer();
}

const h = React.createElement;

/** Shared frame: full-bleed color, generous padding, wordmark pinned bottom-left. */
function slide({ background, color, eyebrow, eyebrowColor, children, footer, footerColor }) {
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: background,
        color,
        padding: 88,
        fontFamily: "Karla",
      },
    },
    h("div", { style: { fontSize: 30, letterSpacing: 7, textTransform: "uppercase", color: eyebrowColor } }, eyebrow),
    h("div", { style: { display: "flex", flexDirection: "column" } }, ...children),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h("div", { style: { fontFamily: "Spectral", fontSize: 30, color } }, "Crossroads Wedding Co."),
      h("div", { style: { fontSize: 26, color: footerColor } }, footer),
    ),
  );
}

const display = (size, color, text, extra = {}) =>
  h("div", { style: { fontFamily: "Spectral", fontSize: size, lineHeight: 1.12, color, ...extra } }, text);

const bodyText = (size, color, text, extra = {}) =>
  h("div", { style: { fontSize: size, lineHeight: 1.45, color, ...extra } }, text);

const rule = (color, extra = {}) =>
  h("div", { style: { width: 132, height: 8, borderRadius: 4, backgroundColor: color, ...extra } });

/** A labelled row for the "what's included" slide. */
const includedRow = (text, color, muted, marginTop = 26) =>
  h(
    "div",
    { style: { display: "flex", alignItems: "center", marginTop } },
    h("div", { style: { width: 14, height: 14, borderRadius: 7, backgroundColor: muted, marginRight: 24 } }),
    h("div", { style: { fontSize: 40, color } }, text),
  );

const POSTS = [
  {
    slug: "01-the-rate",
    element: slide({
      background: COLORS.charcoal,
      color: COLORS.cream,
      eyebrow: "The whole day",
      eyebrowColor: COLORS.gold,
      footer: "DJ · MC · Day-of",
      footerColor: COLORS.muted,
      children: [
        display(210, COLORS.cream, "$1,000"),
        rule(COLORS.terracotta, { marginTop: 40 }),
        display(64, COLORS.cream, "Ceremony through last dance. One rate.", { marginTop: 40, maxWidth: 820 }),
      ],
    }),
  },
  {
    slug: "02-whats-included",
    element: slide({
      background: COLORS.cream,
      color: COLORS.charcoal,
      eyebrow: "What $1,000 covers",
      eyebrowColor: COLORS.terracotta,
      footer: "Link in bio",
      footerColor: COLORS.ink,
      children: [
        display(78, COLORS.charcoal, "Everything the day needs."),
        includedRow("Ceremony, cocktail hour, reception sound", COLORS.ink, COLORS.terracotta, 48),
        includedRow("MC as loud or as invisible as you like", COLORS.ink, COLORS.terracotta),
        includedRow("All the equipment, set up and struck", COLORS.ink, COLORS.terracotta),
        includedRow("Day-of timeline: we call the cues", COLORS.ink, COLORS.terracotta),
      ],
    }),
  },
  {
    slug: "03-no-packages",
    element: slide({
      background: COLORS.terracotta,
      color: COLORS.cream,
      eyebrow: "No tiers, no upsells",
      eyebrowColor: COLORS.parchment,
      footer: "Link in bio",
      footerColor: COLORS.parchment,
      children: [
        display(88, COLORS.cream, "There is no silver, gold, or platinum package.", { maxWidth: 860 }),
        bodyText(40, COLORS.parchment, "There\u2019s the day rate. Add a live acoustic set for a flat $500. Bartending starts at $500, quoted fully once we know your date and headcount.", {
          marginTop: 44,
          maxWidth: 820,
        }),
      ],
    }),
  },
  {
    slug: "04-book-a-call",
    element: slide({
      background: COLORS.charcoal,
      color: COLORS.cream,
      eyebrow: "Let\u2019s talk it through",
      eyebrowColor: COLORS.gold,
      footer: "Link in bio",
      footerColor: COLORS.muted,
      children: [
        display(96, COLORS.cream, "A short call, and you\u2019ll know if we\u2019re your crew.", { maxWidth: 860 }),
        rule(COLORS.terracotta, { marginTop: 44 }),
        bodyText(40, COLORS.muted, "Thirty minutes: your date, your venue, and what you actually need on the day. No pitch deck.", {
          marginTop: 44,
          maxWidth: 800,
        }),
      ],
    }),
  },
];

const [spectral, karla] = await Promise.all([
  loadGoogleFont("Spectral", 600),
  loadGoogleFont("Karla", 500),
]);
const fonts = [
  { name: "Spectral", data: spectral, weight: 600, style: "normal" },
  { name: "Karla", data: karla, weight: 500, style: "normal" },
];

await fs.mkdir(OUT_DIR, { recursive: true });

for (const post of POSTS) {
  const png = Buffer.from(
    await new ImageResponse(post.element, { width: SIZE, height: SIZE, fonts }).arrayBuffer(),
  );
  const file = path.join(OUT_DIR, `${post.slug}.png`);
  await fs.writeFile(file, png);
  console.log(`${path.relative(process.cwd(), file)}  ${(png.length / 1024).toFixed(0)} KB`);
}
