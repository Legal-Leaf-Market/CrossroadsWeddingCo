// The bartending a-la-carte reel (silent; record the voiceover against
// content/reel/bartending-voiceover.md, then retime durations to its pause
// map like the main reel). Copy stays inside the serve-only rule: we never
// supply or sell alcohol. Run: FFMPEG=<path> pnpm reel:bartending
import { buildReel, COLORS, display, bodyText, rule, includedRow } from "./reel-engine.mjs";

const D = 4; // default slide seconds until a recorded VO sets real timings

const SLIDES = [
  {
    slug: "01-hero",
    duration: D,
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "Backyard and DIY venues",
    eyebrowColor: COLORS.gold,
    footer: "Licensed · Experienced",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "big", anim: "rise-far", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.7 },
      { key: "sub", anim: "rise", t: 0.85 },
    ],
    children: [
      { layer: "big", node: display(130, COLORS.cream, "Your bar. Our bartenders.", { maxWidth: 900 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 48 }) },
      {
        layer: "sub",
        node: display(64, COLORS.cream, "Wedding bar service, starting at $500.", {
          marginTop: 48,
          maxWidth: 900,
        }),
      },
    ],
  },
  {
    slug: "02-indiana",
    duration: D,
    background: COLORS.cream,
    color: COLORS.charcoal,
    eyebrow: "How Indiana works",
    eyebrowColor: COLORS.terracotta,
    footer: "No markup on your shelf",
    footerColor: COLORS.ink,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "body", anim: "rise", t: 0.7 },
    ],
    children: [
      { layer: "headline", node: display(88, COLORS.charcoal, "You provide the alcohol. We pour it.", { maxWidth: 910 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.ink,
          "That's exactly how Indiana law is built for private events: the host provides, professionals serve. You pay store prices for the shelf you actually want, and we never sell a drop.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "03-licensed",
    duration: D,
    background: COLORS.terracotta,
    color: COLORS.cream,
    eyebrow: "The real thing",
    eyebrowColor: COLORS.parchment,
    footer: "Indiana ATC permitted",
    footerColor: COLORS.parchment,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "body", anim: "rise", t: 0.7 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "Real permits. Twenty years behind the bar.", { maxWidth: 900 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.parchment,
          "Our bartenders hold current Indiana ATC permits. We check IDs, pace the pours, and handle the guest who's had enough with a smile instead of a scene.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "04-included",
    duration: D,
    background: COLORS.cream,
    color: COLORS.charcoal,
    eyebrow: "What the night includes",
    eyebrowColor: COLORS.terracotta,
    footer: "Start to last call",
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
      { layer: "headline", node: display(84, COLORS.charcoal, "A bar that runs itself.") },
      { layer: "row1", node: includedRow("Setup before guests arrive, breakdown after", COLORS.ink, COLORS.terracotta, 56) },
      { layer: "row2", node: includedRow("Service all night, your recipes or ours", COLORS.ink, COLORS.terracotta) },
      { layer: "row3", node: includedRow("IDs checked, pours paced, guests cared for", COLORS.ink, COLORS.terracotta) },
      { layer: "row4", node: includedRow("A shopping list sized to your guest count", COLORS.ink, COLORS.terracotta) },
    ],
  },
  {
    slug: "05-price",
    duration: D,
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "The honest number",
    eyebrowColor: COLORS.gold,
    footer: "One quote, it doesn't move",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.65 },
      { key: "body", anim: "rise", t: 0.8 },
    ],
    children: [
      { layer: "headline", node: display(88, COLORS.cream, "$500 is the minimum, not the price.", { maxWidth: 910 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 52 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.muted,
          "Guest count and shelf set the real number, and bigger guest lists take a second bartender. We ask about your bar on a short call and give you one straight quote.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "06-standalone",
    duration: D,
    background: COLORS.terracotta,
    color: COLORS.cream,
    eyebrow: "Plug and play",
    eyebrowColor: COLORS.parchment,
    footer: "No package required",
    footerColor: COLORS.parchment,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "body", anim: "rise", t: 0.7 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "Already have a DJ? Bring us anyway.", { maxWidth: 900 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.parchment,
          "Bar service books entirely on its own. And if you want the whole day handled, our DJ and MC package is $1,000 flat, with the bar bolted right on.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "07-cta",
    duration: D,
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "Let's talk your bar",
    eyebrowColor: COLORS.gold,
    footer: "crossroadsweddingco.com/bartending",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.65 },
      { key: "body", anim: "rise", t: 0.8 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "One short call, one straight number.", { maxWidth: 900 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 52 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.muted,
          "Based in Columbus, Indiana, pouring within about two hours: Indianapolis, Bloomington, Nashville, Louisville, and Cincinnati.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
];

const TRANSITIONS = ["smoothup", "smoothleft", "fade", "smoothup", "smoothleft", "fade"];

await buildReel({
  slides: SLIDES,
  transitions: TRANSITIONS,
  outFile: "bartending-reel.mp4",
  vo: process.env.VO && process.env.VO !== "none" ? process.env.VO : null,
});
