// The main brand reel, cut to Jacob's recorded voiceover
// (content/reel/voiceover.m4a, muxed in; override with VO=, or VO=none for
// silent). Slide durations follow the VO's pause map: each transition starts
// 0.55s before the matching line begins. Re-derive with ffmpeg silencedetect
// if the VO is re-recorded. Run: FFMPEG=<path> pnpm reel
import path from "node:path";
import { buildReel, COLORS, display, bodyText, rule, includedRow } from "./reel-engine.mjs";

const VO_DEFAULT = path.join(process.cwd(), "content", "reel", "voiceover.m4a");
const VO = process.env.VO === "none" ? null : (process.env.VO || VO_DEFAULT);

const SLIDES = [
  {
    slug: "01-the-rate",
    duration: 6.63,
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
    duration: 5.88,
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
    duration: 6.74,
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
    duration: 5.92,
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
    duration: 5.63,
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
    duration: 5.7,
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
    duration: 8.5,
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

await buildReel({ slides: SLIDES, transitions: TRANSITIONS, outFile: "crossroads-reel.mp4", vo: VO });
