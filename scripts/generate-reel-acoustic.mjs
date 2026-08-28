// The acoustic a-la-carte reel (silent; record the voiceover against
// content/reel/acoustic-voiceover.md, then retime durations to its pause map
// like the main reel). Run: FFMPEG=<path> pnpm reel:acoustic
import { buildReel, COLORS, display, bodyText, rule, includedRow } from "./reel-engine.mjs";

const D = 4; // default slide seconds until a recorded VO sets real timings

const SLIDES = [
  {
    slug: "01-hero",
    duration: D,
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "A la carte live music",
    eyebrowColor: COLORS.gold,
    footer: "Ceremony · Cocktail hour",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "big", anim: "rise-far", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.7 },
      { key: "sub", anim: "rise", t: 0.85 },
    ],
    children: [
      { layer: "big", node: display(150, COLORS.cream, "Live music. $500 flat.", { maxWidth: 900 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 48 }) },
      {
        layer: "sub",
        node: display(64, COLORS.cream, "A solo acoustic set for your ceremony or cocktail hour.", {
          marginTop: 48,
          maxWidth: 900,
        }),
      },
    ],
  },
  {
    slug: "02-what-it-is",
    duration: D,
    background: COLORS.cream,
    color: COLORS.charcoal,
    eyebrow: "What you get",
    eyebrowColor: COLORS.terracotta,
    footer: "Played live, not tracked",
    footerColor: COLORS.ink,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "row1", anim: "rise", t: 0.6 },
      { key: "row2", anim: "rise", t: 0.8 },
      { key: "row3", anim: "rise", t: 1.0 },
    ],
    children: [
      { layer: "headline", node: display(84, COLORS.charcoal, "One performer, played live.") },
      { layer: "row1", node: includedRow("Singer-songwriter style, guitar and voice", COLORS.ink, COLORS.terracotta, 56) },
      { layer: "row2", node: includedRow("Your ceremony or your cocktail hour", COLORS.ink, COLORS.terracotta) },
      { layer: "row3", node: includedRow("One hour is the sweet spot, two is the max", COLORS.ink, COLORS.terracotta) },
    ],
  },
  {
    slug: "03-requests",
    duration: D,
    background: COLORS.terracotta,
    color: COLORS.cream,
    eyebrow: "Your songs",
    eyebrowColor: COLORS.parchment,
    footer: "With adequate notice",
    footerColor: COLORS.parchment,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "body", anim: "rise", t: 0.7 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "We learn up to three songs just for you.", { maxWidth: 900 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.parchment,
          "Your processional. Your first dance. The song that's yours. Give us enough notice and we'll have them ready; the rest comes from a repertoire we keep sharp.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "04-standalone",
    duration: D,
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "Plug and play",
    eyebrowColor: COLORS.gold,
    footer: "No package required",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.65 },
      { key: "body", anim: "rise", t: 0.8 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "Already have a DJ? Perfect.", { maxWidth: 900 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 52 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.muted,
          "The set books entirely on its own. We show up, play the hour, and hand the room back to your crew. And if we're your DJ too, the handoff is seamless, because it's the same people.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "05-price",
    duration: D,
    background: COLORS.cream,
    color: COLORS.charcoal,
    eyebrow: "The price is the price",
    eyebrowColor: COLORS.terracotta,
    footer: "Quoted up front, in writing",
    footerColor: COLORS.ink,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "big", anim: "rise-far", t: 0.15 },
      { key: "body", anim: "rise", t: 0.8 },
    ],
    children: [
      { layer: "big", node: display(190, COLORS.charcoal, "$500") },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.ink,
          "Flat, for the whole set. Want the full day handled too? Our DJ and MC package is $1,000 flat, and the acoustic set bolts right on.",
          { marginTop: 48, maxWidth: 880 },
        ),
      },
    ],
  },
  {
    slug: "06-cta",
    duration: D,
    background: COLORS.charcoal,
    color: COLORS.cream,
    eyebrow: "Let's find your sound",
    eyebrowColor: COLORS.gold,
    footer: "crossroadsweddingco.com/acoustic",
    footerColor: COLORS.muted,
    layers: [
      { key: "chrome", anim: "fade", t: 0.0 },
      { key: "headline", anim: "rise", t: 0.15 },
      { key: "rule", anim: "fade", t: 0.65 },
      { key: "body", anim: "rise", t: 0.8 },
    ],
    children: [
      { layer: "headline", node: display(92, COLORS.cream, "Tell us your date and your songs.", { maxWidth: 900 }) },
      { layer: "rule", node: rule(COLORS.terracotta, { marginTop: 52 }) },
      {
        layer: "body",
        node: bodyText(
          44,
          COLORS.muted,
          "Based in Columbus, Indiana, playing weddings within about two hours: Indianapolis, Bloomington, Nashville, Louisville, and Cincinnati.",
          { marginTop: 52, maxWidth: 880 },
        ),
      },
    ],
  },
];

const TRANSITIONS = ["smoothup", "smoothleft", "fade", "smoothup", "smoothleft"];

await buildReel({
  slides: SLIDES,
  transitions: TRANSITIONS,
  outFile: "acoustic-reel.mp4",
  vo: process.env.VO && process.env.VO !== "none" ? process.env.VO : null,
});
