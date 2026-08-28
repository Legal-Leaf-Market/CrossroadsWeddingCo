// Shared engine for the animated brand reels (1080x1920 vertical video).
//
// Each slide renders as transparent full-canvas LAYERS via the same next/og +
// satori pipeline as the image generators, then ffmpeg animates them:
// eyebrow/footer fade in, headlines rise with an ease-out, list rows stagger,
// held frames drift up a hair, and slides hand off with directional
// dissolves. Configs (generate-reel*.mjs) supply the slides and call
// buildReel(); FFMPEG env names the binary (defaults to "ffmpeg" on PATH).
import { ImageResponse } from "next/og.js";
import React from "react";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const WIDTH = 1080;
export const HEIGHT = 1920;
const FPS = 30;
const FADE = 0.5; // crossfade between slides

const FFMPEG = process.env.FFMPEG || "ffmpeg";

export const COLORS = {
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

export const h = React.createElement;

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

export const display = (size, color, text, extra = {}) =>
  h("div", { style: { fontFamily: "Spectral", fontSize: size, lineHeight: 1.12, color, ...extra } }, text);

export const bodyText = (size, color, text, extra = {}) =>
  h("div", { style: { fontSize: size, lineHeight: 1.45, color, ...extra } }, text);

export const rule = (color, extra = {}) =>
  h("div", { style: { width: 140, height: 8, borderRadius: 4, backgroundColor: color, ...extra } });

export const includedRow = (text, color, dot, marginTop = 34) =>
  h(
    "div",
    { style: { display: "flex", alignItems: "flex-start", marginTop } },
    h("div", { style: { width: 15, height: 15, borderRadius: 8, backgroundColor: dot, marginRight: 26, marginTop: 18 } }),
    h("div", { style: { fontSize: 42, lineHeight: 1.3, color, maxWidth: 820 } }, text),
  );

// Ease-out cubic rise: y = D * (1 - p)^3 where p = clamped progress, plus a
// slow 1px/s upward drift so held frames never feel frozen.
const riseExpr = (start, dist) =>
  `(${dist}*pow(1-min(max(t-${start},0)/0.7,1),3))-t`;

/**
 * Build one reel. slides: [{slug, duration, background, color, eyebrow,
 * eyebrowColor, footer, footerColor, layers: [{key, anim: fade|rise|rise-far,
 * t}], children: [{layer, node}]}]. transitions: xfade names, one per
 * boundary. vo: audio file path to mux, or null for silent. outFile lands in
 * content/reel/.
 */
export async function buildReel({ slides, transitions, outFile, vo = null }) {
  const outDir = path.join(process.cwd(), "content", "reel");
  const [spectral, karla] = await Promise.all([
    loadGoogleFont("Spectral", 600),
    loadGoogleFont("Karla", 500),
  ]);
  const fonts = [
    { name: "Spectral", data: spectral, weight: 600, style: "normal" },
    { name: "Karla", data: karla, weight: 500, style: "normal" },
  ];

  const work = await fs.mkdtemp(path.join(os.tmpdir(), "crossroads-reel-"));

  for (const slide of slides) {
    for (const layer of slide.layers) {
      const png = Buffer.from(
        await new ImageResponse(frame(slide, layer.key), { width: WIDTH, height: HEIGHT, fonts }).arrayBuffer(),
      );
      await fs.writeFile(path.join(work, `${slide.slug}--${layer.key}.png`), png);
    }
    console.log(`rendered ${slide.layers.length} layers for ${slide.slug}`);
  }

  for (const slide of slides) {
    const inputs = [];
    const filters = [];
    filters.push(
      `color=c=${slide.background.replace("#", "0x")}:s=${WIDTH}x${HEIGHT}:d=${slide.duration}:r=${FPS}[base0]`,
    );
    slide.layers.forEach((layer, i) => {
      inputs.push("-loop", "1", "-t", String(slide.duration), "-i", path.join(work, `${slide.slug}--${layer.key}.png`));
      const fadeDur = layer.anim === "fade" ? 0.5 : 0.6;
      filters.push(`[${i}:v]format=rgba,fade=t=in:st=${layer.t}:d=${fadeDur}:alpha=1[l${i}]`);
      const dist = layer.anim === "rise-far" ? 130 : layer.anim === "rise" ? 70 : 0;
      const y = dist > 0 ? `'${riseExpr(layer.t, dist)}'` : `'-t'`;
      filters.push(`[base${i}][l${i}]overlay=x=0:y=${y}:eval=frame[base${i + 1}]`);
    });
    const out = path.join(work, `${slide.slug}.mp4`);
    execFileSync(
      FFMPEG,
      ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", `[base${slide.layers.length}]`,
        "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-r", String(FPS), "-pix_fmt", "yuv420p", out],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    console.log(`animated ${slide.slug}`);
  }

  const inputs = slides.flatMap((s) => ["-i", path.join(work, `${s.slug}.mp4`)]);
  const chain = [];
  let prev = "0:v";
  let offset = 0;
  slides.slice(1).forEach((s, i) => {
    offset += slides[i].duration - FADE;
    const label = `x${i + 1}`;
    chain.push(
      `[${prev}][${i + 1}:v]xfade=transition=${transitions[i]}:duration=${FADE}:offset=${offset.toFixed(2)}[${label}]`,
    );
    prev = label;
  });
  const total = offset + slides[slides.length - 1].duration;
  chain.push(
    `[${prev}]fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8,format=yuv420p[v]`,
  );

  let hasAudio = false;
  if (vo) {
    try {
      await fs.access(vo);
      hasAudio = true;
    } catch {
      console.warn(`voiceover not found at ${vo}, building silent`);
    }
  }
  if (hasAudio) inputs.push("-i", vo);

  await fs.mkdir(outDir, { recursive: true });
  const finalOut = path.join(outDir, outFile);
  execFileSync(
    FFMPEG,
    ["-y", ...inputs, "-filter_complex", chain.join(";"), "-map", "[v]",
      ...(hasAudio ? ["-map", `${slides.length}:a`, "-c:a", "aac", "-b:a", "192k"] : []),
      "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-r", String(FPS),
      "-t", total.toFixed(2), "-movflags", "+faststart", finalOut],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const stat = await fs.stat(finalOut);
  console.log(`${path.relative(process.cwd(), finalOut)}  ${(stat.size / 1024 / 1024).toFixed(1)} MB, ${total.toFixed(1)}s`);
  await fs.rm(work, { recursive: true, force: true });
}
