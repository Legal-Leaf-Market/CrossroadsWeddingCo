// Renders the WeddingPro storefront slides into content/storefront/ at
// 2160x2160 (The Knot / WeddingWire photo upload requires at least 2000px on
// the longest side, max 10MB). Same next/og + satori pipeline and palette as
// scripts/generate-ig-posts.mjs. Run with:
//   pnpm storefront:slides
//
// These are original branded graphics, not photos, so the marketplace's
// "you own the rights" confirmation is honestly checkable.
import { ImageResponse } from "next/og.js";
import React from "react";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "content", "storefront");
const SIZE = 2160;
// Layout values below are authored against the familiar 1080 grid and scaled.
const S = SIZE / 1080;

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
        padding: S * 88,
        fontFamily: "Karla",
      },
    },
    h(
      "div",
      { style: { fontSize: S * 30, letterSpacing: S * 7, textTransform: "uppercase", color: eyebrowColor } },
      eyebrow,
    ),
    h("div", { style: { display: "flex", flexDirection: "column" } }, ...children),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h("div", { style: { fontFamily: "Spectral", fontSize: S * 30, color } }, "Crossroads Wedding Co."),
      h("div", { style: { fontSize: S * 26, color: footerColor } }, footer),
    ),
  );
}

const display = (size, color, text, extra = {}) =>
  h("div", { style: { fontFamily: "Spectral", fontSize: S * size, lineHeight: 1.12, color, ...scaled(extra) } }, text);

const bodyText = (size, color, text, extra = {}) =>
  h("div", { style: { fontSize: S * size, lineHeight: 1.45, color, ...scaled(extra) } }, text);

const rule = (color, extra = {}) =>
  h("div", { style: { width: S * 132, height: S * 8, borderRadius: S * 4, backgroundColor: color, ...scaled(extra) } });

/** Scale the pixel-valued layout props authored on the 1080 grid. */
function scaled(extra) {
  const out = {};
  for (const [k, v] of Object.entries(extra)) out[k] = typeof v === "number" ? S * v : v;
  return out;
}

/** A labelled row for list slides. */
const includedRow = (text, color, dot, marginTop = 26) =>
  h(
    "div",
    { style: { display: "flex", alignItems: "center", marginTop: S * marginTop } },
    h("div", { style: { width: S * 14, height: S * 14, borderRadius: S * 7, backgroundColor: dot, marginRight: S * 24 } }),
    h("div", { style: { fontSize: S * 40, color } }, text),
  );

const SLIDES = [
  {
    slug: "01-the-rate",
    element: slide({
      background: COLORS.charcoal,
      color: COLORS.cream,
      eyebrow: "Columbus, Indiana",
      eyebrowColor: COLORS.gold,
      footer: "DJ · MC · Day-of",
      footerColor: COLORS.muted,
      children: [
        display(210, COLORS.cream, "$1,000"),
        rule(COLORS.terracotta, { marginTop: 40 }),
        display(64, COLORS.cream, "Flat-rate wedding DJ and MC. The whole day, one price, no hidden fees.", {
          marginTop: 40,
          maxWidth: 880,
        }),
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
      footer: "Included in the rate",
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
      footer: "One rate, in writing",
      footerColor: COLORS.parchment,
      children: [
        display(88, COLORS.cream, "There is no silver, gold, or platinum package.", { maxWidth: 860 }),
        bodyText(
          40,
          COLORS.parchment,
          "There's the day rate, quoted up front, and it doesn't move when you say the word wedding. Every couple gets our best, because there's nothing to upgrade to.",
          { marginTop: 44, maxWidth: 830 },
        ),
      ],
    }),
  },
  {
    slug: "04-acoustic",
    element: slide({
      background: COLORS.charcoal,
      color: COLORS.cream,
      eyebrow: "Add-on",
      eyebrowColor: COLORS.gold,
      footer: "Ceremony · Cocktail hour",
      footerColor: COLORS.muted,
      children: [
        display(88, COLORS.cream, "A live solo acoustic set. Flat $400.", { maxWidth: 860 }),
        rule(COLORS.terracotta, { marginTop: 44 }),
        bodyText(
          40,
          COLORS.muted,
          "One performer, singer-songwriter style, played live for your ceremony or cocktail hour. With enough notice, we learn up to three songs just for you.",
          { marginTop: 44, maxWidth: 830 },
        ),
      ],
    }),
  },
  {
    slug: "05-bar-service",
    element: slide({
      background: COLORS.cream,
      color: COLORS.charcoal,
      eyebrow: "Add-on",
      eyebrowColor: COLORS.terracotta,
      footer: "Quoted straight, no surprises",
      footerColor: COLORS.ink,
      children: [
        display(84, COLORS.charcoal, "Licensed bartenders for backyard and DIY-venue weddings.", { maxWidth: 880 }),
        bodyText(
          40,
          COLORS.ink,
          "$400 is the minimum, not the price. Your guest count and your shelf set the real number, and we quote it on your intro call.",
          { marginTop: 44, maxWidth: 830 },
        ),
      ],
    }),
  },
  {
    slug: "06-planning-hub",
    element: slide({
      background: COLORS.terracotta,
      color: COLORS.cream,
      eyebrow: "Your planning hub",
      eyebrowColor: COLORS.parchment,
      footer: "Saves as you type",
      footerColor: COLORS.parchment,
      children: [
        display(84, COLORS.cream, "Book in two minutes. Your planning hub opens the same moment.", { maxWidth: 890 }),
        bodyText(
          40,
          COLORS.parchment,
          "Timeline, music, and the names we announce, all in one private link your crew reads live. On the day, nobody comes to find the bride about the schedule.",
          { marginTop: 44, maxWidth: 840 },
        ),
      ],
    }),
  },
  {
    slug: "07-book-a-call",
    element: slide({
      background: COLORS.charcoal,
      color: COLORS.cream,
      eyebrow: "Let's talk it through",
      eyebrowColor: COLORS.gold,
      footer: "crossroadsweddingco.com",
      footerColor: COLORS.muted,
      children: [
        display(88, COLORS.cream, "A short call, and you'll know if we're your crew.", { maxWidth: 860 }),
        rule(COLORS.terracotta, { marginTop: 44 }),
        bodyText(
          40,
          COLORS.muted,
          "Thirty minutes: your date, your venue, and what you actually need on the day. Based in Columbus, Indiana, serving Indianapolis, Bloomington, Nashville, Louisville, and Cincinnati.",
          { marginTop: 44, maxWidth: 840 },
        ),
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

for (const s of SLIDES) {
  const png = Buffer.from(
    await new ImageResponse(s.element, { width: SIZE, height: SIZE, fonts }).arrayBuffer(),
  );
  const file = path.join(OUT_DIR, `${s.slug}.png`);
  await fs.writeFile(file, png);
  console.log(`${path.relative(process.cwd(), file)}  ${(png.length / 1024).toFixed(0)} KB`);
}
