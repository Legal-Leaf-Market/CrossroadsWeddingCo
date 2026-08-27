// Builds the animated Instagram Reel (1080x1920, ~25s, silent: music and
// voiceover get added downstream) into content/reel/crossroads-reel.mp4.
//
// Each slide is rendered as transparent full-canvas LAYERS via the same
// next/og + satori pipeline as the other generators, then ffmpeg animates
// them: eyebrow/footer fade in, headlines rise with an ease-out, list rows
// stagger, everything drifts up a hair while it holds, and slides hand off
// with directional dissolves. Run with:
//   FFMPEG=/path/to/ffmpeg pnpm reel
// (FFMPEG defaults to "ffmpeg" on PATH. Layers and segments build in a temp
// dir; only the final MP4 lands in content/reel/.)
import { ImageResponse } from "next/og.js";
import React from "react";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT_DIR = path.join(process.cwd(), "content", "reel");
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const SLIDE_SECONDS = 4;
const FADE = 0.5; // crossfade between slides

const FFMPEG = process.env.FFMPEG || "ffmpeg";

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

// Every element in a slide carries a layer key. Rendering the slide once per
// key with all other keys at opacity 0 yields perfectly registered
// transparent layers, so ffmpeg can move them independently without any
// layout math outside satori.
const vis = (show) => ({ opacity: show ? 1 : 0 });

function frame(slide, showKey) {
  const on = (key) => vis(key === showKey);
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        color: slide.color,
        padding: "150px 88px",
        fontFamily: "Karla",
        // Background stays transparent; ffmpeg supplies the solid color so
        // crossfades never double-expose two backgrounds.
      },
    },
    h(
      "div",
      { style: { fontSize: 34, letterSpacing: 8, textTransform: "uppercase", color: slide.eyebrowColor, ...on("chrome") } },
      slide.eyebrow,
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 } },
      ...slide.children.map((c) =>
        h("div", { style: { display: "flex", ...on(c.layer) } }, c.node),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", ...on("chrome") } },
      h("div", { style: { fontFamily: "Spectral", fontSize: 34, color: slide.color } }, "Crossroads Wedding Co."),
      h("div", { style: { fontSize: 28, color: slide.footerColor } }, slide.footer),
    ),
  );
}

const display = (size, color, text, extra = {}) =>
  h("div", { style: { fontFamily: "Spectral", fontSize: size, lineHeight: 1.12, color, ...extra } }, text);

const bodyText = (size, color, text, extra = {}) =>
  h("div", { style: { fontSize: size, lineHeight: 1.45, color, ...extra } }, text);

const rule = (color, extra = {}) =>
  h("div", { style: { width: 140, height: 8, borderRadius: 4, backgroundColor: color, ...extra } });

const includedRow = (text, color, dot, marginTop = 34) =>
  h(
    "div",
    { style: { display: "flex", alignItems: "flex-start", marginTop } },
    h("div", { style: { width: 15, height: 15, borderRadius: 8, backgroundColor: dot, marginRight: 26, marginTop: 18 } }),
    h("div", { style: { fontSize: 42, lineHeight: 1.3, color, maxWidth: 820 } }, text),
  );

// Layer animation vocabulary, applied by ffmpeg below:
//   fade          alpha only
//   rise          alpha + 70px ease-out rise
//   rise-far      alpha + 130px ease-out rise (the hero number)
// t = entrance start (seconds into the slide).
const SLIDES = [
  {
    slug: "01-the-rate",
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "Columbus, Indiana",
    eyebrowColor: COLORS.gold,
    footer: "DJ · MC · Day-of",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "big", anim: "rise-far", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.7 },
      { key: "sub", anim: "rise", t: 0.85 },
    ],
    children: [
      { layer: "big", node: display(230, COLORS.cream, "$1,000") },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 48 }) },
      {
        layer: "sub",
        node: display(70, COLORS.cream, "Flat-rate wedding DJ and MC. The whole day, one price, no hidden fees.", {
          marginTop: 48,
          maxWidth: 900,
        }),
      },
    ],
  },
  {
    slug: "02-whats-included",
    background: COLORS.cream,
    color: COLORS.charcoal,
    eyebrow: "What $1,000 covers",
    eyebrowColor: COLORS.terracotta,
    footer: "Included in the rate",
    footerColor: COLORS.ink,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "row1", anim: "rise", t: 0.6 },
      { key: "row2", anim: "rise", t: 0.8 },
      { key: "row3", anim: "rise", t: 1.0 },
      { key: "row4", anim: "rise", t: 1.2 },
    ],
    children: [
      { layer: "headline", node: display(84, COLORS.charcoal, "Everything the day needs.") },
      { layer: "row1", node: includedRow("Ceremony, cocktail hour, reception sound", COLORS.ink, COLORS.terracotta, 56) },
      { layer: "row2", node: includedRow("MC as loud or as invisible as you like", COLORS.ink, COLORS.terracotta) },
      { layer: "row3", node: includedRow("All the equipment, set up and struck", COLORS.ink, COLORS.terracotta) },
      { layer: "row4", node: includedRow("Day-of timeline: we call the cues", COLORS.ink, COLORS.terracotta) },
    ],
  },
  {
    slug: "03-no-packages",
    background: COLORS.terracotta,
    color: COLORS.cream,
    eyebrow: "No tiers, no upsells",
    eyebrowColor: COLORS.parchment,
    footer: "One rate, in writing",
    footerColor: COLORS.parchment,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "body", anim: "rise", t: 0.7 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "There is no silver, gold, or platinum package.", { maxWidth: 900 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.parchment,
          "There's the day rate, quoted up front, and it doesn't move when you say the word wedding. Every couple gets our best, because there's nothing to upgrade to.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "04-acoustic",
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "Add-on",
    eyebrowColor: COLORS.gold,
    footer: "Ceremony · Cocktail hour",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.65 },
      { key: "body", anim: "rise", t: 0.8 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "A live solo acoustic set. Flat $500.", { maxWidth: 900 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 52 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.muted,
          "One performer, singer-songwriter style, played live for your ceremony or cocktail hour. With enough notice, we learn up to three songs just for you.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "05-bar-service",
    background: COLORS.cream,
    color: COLORS.charcoal,
    eyebrow: "Add-on",
    eyebrowColor: COLORS.terracotta,
    footer: "Quoted straight, no surprises",
    footerColor: COLORS.ink,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "body", anim: "rise", t: 0.75 },
    ],
    children: [
      { layer: "headline", node: display(88, COLORS.charcoal, "Licensed bartenders for backyard and DIY-venue weddings.", { maxWidth: 910 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.ink,
          "$500 is the minimum, not the price. Your guest count and your shelf set the real number, and we quote it on your intro call.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "06-planning-hub",
    background: COLORS.terracotta,
    color: COLORS.cream,
    eyebrow: "Your planning hub",
    eyebrowColor: COLORS.parchment,
    footer: "Saves as you type",
    footerColor: COLORS.parchment,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "body", anim: "rise", t: 0.75 },
    ],
    children: [
      { layer: "headline", node: display(88, COLORS.cream, "Book in two minutes. Your planning hub opens the same moment.", { maxWidth: 910 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.parchment,
          "Timeline, music, and the names we announce, all in one private link your crew reads live. On the day, nobody comes to find the bride about the schedule.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "07-book-a-call",
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "Let's talk it through",
    eyebrowColor: COLORS.gold,
    footer: "crossroadsweddingco.com",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.65 },
      { key: "body", anim: "rise", t: 0.8 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "A short call, and you'll know if we're your crew.", { maxWidth: 900 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 52 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.muted,
          "Thirty minutes: your date, your venue, and what you actually need on the day. Based in Columbus, Indiana, serving Indianapolis, Bloomington, Nashville, Louisville, and Cincinnati.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
];

// Directional dissolves between slides, in order. xfade transition names.
const TRANSITIONS = ["smoothup", "smoothleft", "fade", "smoothup", "smoothleft", "fade"];

// --- Render layers ---------------------------------------------------------

const [spectral, karla] = await Promise.all([
  loadGoogleFont("Spectral", 600),
  loadGoogleFont("Karla", 500),
]);
const fonts = [
  { name: "Spectral", data: spectral, weight: 600, style: "normal" },
  { name: "Karla", data: karla, weight: 500, style: "normal" },
];

const work = await fs.mkdtemp(path.join(os.tmpdir(), "crossroads-reel-"));
console.log(`work dir: ${work}`);

for (const slide of SLIDES) {
  for (const layer of slide.layers) {
    const png = Buffer.from(
      await new ImageResponse(frame(slide, layer.key), { width: WIDTH, height: HEIGHT, fonts }).arrayBuffer(),
    );
    await fs.writeFile(path.join(work, `${slide.slug}--${layer.key}.png`), png);
  }
  console.log(`rendered ${slide.layers.length} layers for ${slide.slug}`);
}

// --- Animate each slide into a segment -------------------------------------

// Ease-out cubic rise: y = D * (1 - p)^3 where p = clamped progress, plus a
// slow 1px/s upward drift so held frames never feel frozen.
const riseExpr = (start, dist) =>
  `(${dist}*pow(1-min(max(t-${start},0)/0.7,1),3))-t`;

for (const slide of SLIDES) {
  const inputs = [];
  const filters = [];
  filters.push(
    `color=c=${slide.background.replace("#", "0x")}:s=${WIDTH}x${HEIGHT}:d=${SLIDE_SECONDS}:r=${FPS}[base0]`,
  );
  slide.layers.forEach((layer, i) => {
    inputs.push("-loop", "1", "-t", String(SLIDE_SECONDS), "-i", path.join(work, `${slide.slug}--${layer.key}.png`));
    const fadeDur = layer.anim === "fade" ? 0.5 : 0.6;
    filters.push(`[${i}:v]format=rgba,fade=t=in:st=${layer.t}:d=${fadeDur}:alpha=1[l${i}]`);
    const dist = layer.anim === "rise-far" ? 130 : layer.anim === "rise" ? 70 : 0;
    const y = dist > 0 ? `'${riseExpr(layer.t, dist)}'` : `'-t'`;
    filters.push(`[base${i}][l${i}]overlay=x=0:y=${y}:eval=frame[base${i + 1}]`);
  });
  const graph = filters.join(";");
  const out = path.join(work, `${slide.slug}.mp4`);
  execFileSync(
    FFMPEG,
    [
      "-y",
      ...inputs,
      "-filter_complex",
      graph,
      "-map",
      `[base${slide.layers.length}]`,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "14",
      "-r",
      String(FPS),
      "-pix_fmt",
      "yuv420p",
      out,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  console.log(`animated ${slide.slug}`);
}

// --- Crossfade the segments into the final reel ----------------------------

const inputs = SLIDES.flatMap((s) => ["-i", path.join(work, `${s.slug}.mp4`)]);
const chain = [];
let prev = "0:v";
SLIDES.slice(1).forEach((s, i) => {
  const offset = (i + 1) * (SLIDE_SECONDS - FADE);
  const label = `x${i + 1}`;
  chain.push(
    `[${prev}][${i + 1}:v]xfade=transition=${TRANSITIONS[i]}:duration=${FADE}:offset=${offset}[${label}]`,
  );
  prev = label;
});
const total = SLIDES.length * SLIDE_SECONDS - (SLIDES.length - 1) * FADE;
chain.push(
  `[${prev}]fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6,format=yuv420p[v]`,
);

await fs.mkdir(OUT_DIR, { recursive: true });
const finalOut = path.join(OUT_DIR, "crossroads-reel.mp4");
execFileSync(
  FFMPEG,
  [
    "-y",
    ...inputs,
    "-filter_complex",
    chain.join(";"),
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-r",
    String(FPS),
    "-movflags",
    "+faststart",
    finalOut,
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const stat = await fs.stat(finalOut);
console.log(`${path.relative(process.cwd(), finalOut)}  ${(stat.size / 1024 / 1024).toFixed(1)} MB, ${total}s`);
await fs.rm(work, { recursive: true, force: true });
