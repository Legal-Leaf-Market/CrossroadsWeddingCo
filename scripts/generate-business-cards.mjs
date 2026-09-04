// Renders the team's business cards, print-ready, into content/business-cards/.
// Front is the Crossroads card, back is the Mosaic Green Worldwide card. Run with:
//   pnpm cards
//
// Output per person:
//   <slug>-front.png, <slug>-back.png   1125 x 675 px at 300 DPI. That is the
//                                       3.5 x 2 in card plus the 0.125 in bleed
//                                       on every side (3.75 x 2.25 in), which is
//                                       what print sites ask for.
//   <slug>-front.pdf, <slug>-back.pdf   one page each, same size, vector text,
//                                       for sites that take a file per side.
//   <slug>.pdf                          both faces in one two-page PDF.
//   all-cards.pdf                       everyone, front then back, for sites
//                                       that take one file per order.
// See content/business-cards/README.md for the upload settings.
//
// Rendering runs through the Chromium that Playwright installs (the same
// binary the layout QA uses), so the script needs no browser dependency of its
// own. Fonts come from Google Fonts and are cached under node_modules/.cache.
//
// Logos: the compass rose and the Mosaic Green globe are drawn in SVG below.
// Drop the original artwork at content/business-cards/logos/crossroads.svg (or
// .png) and content/business-cards/logos/mosaic-green.svg (or .png) and the
// script picks those up instead, no code change needed.
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import QRCode from "qrcode";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "content", "business-cards");
const LOGO_DIR = path.join(OUT_DIR, "logos");
const FONT_CACHE = path.join(ROOT, "node_modules", ".cache", "business-cards", "fonts");
const SITE_URL = "https://crossroadsweddingco.com";

// Card geometry, in inches. Standard US card plus the standard bleed.
const TRIM_W = 3.5;
const TRIM_H = 2;
const BLEED = 0.125;
const SHEET_W = TRIM_W + BLEED * 2; // 3.75
const SHEET_H = TRIM_H + BLEED * 2; // 2.25
const DPI = 300;
const CSS_DPI = 96;
// The dashed frame sits this far inside the trim line. Anything closer than
// 0.125 in to the cut can visibly drift on a bordered design, so this is a
// touch further in than the on-screen mock.
const FRAME_INSET = 0.16;

const C = {
  cream: "#faf5ec",
  parchment: "#f1e6d3",
  charcoal: "#2b2622",
  ink: "#3d362f",
  terracotta: "#c1633d",
  terracottaDark: "#a34d2b",
  gold: "#cf9d4c",
  goldDark: "#b8863a",
  muted: "#857c72",
  green: "#1d3b2a",
  greenDeep: "#142b1e",
  frameFront: "#e3b3a0",
  frameBack: "#7d3b2d",
  mint: "#a9d8ad",
  brandTan: "#e8d6ae",
  brandLavender: "#c9b9ea",
  brandGreen: "#a3d6a1",
  brandCyan: "#82d4dd",
};

// One entry per card. `title` may carry a newline for a two-line title.
// An empty phone leaves the line off the card and prints a warning, so a
// placeholder number can never reach the printer.
const PEOPLE = [
  {
    slug: "jake",
    name: "Jake Kennedy",
    title: "Co-founder & Event Producer",
    roles: "DJ · MC · Acoustic",
    email: "jake@crossroadsweddingco.com",
    phone: "(812) 916-3952",
    mosaicTitle: "Founder & CEO",
  },
  {
    slug: "nic",
    name: "Nic Critney",
    title: "Co-founder & Event Manager",
    roles: "DJ · MC · Acoustic · Bar",
    email: "nic@crossroadsweddingco.com",
    // Work number (Jacob, 2026-09-04); the earlier card carried his personal one.
    phone: "(812) 343-6961",
    mosaicTitle: "Chief Operating Officer",
  },
  {
    slug: "brayton",
    name: "Brayton Brumett",
    title: "Co-founder &\nDirector of Talent & Training",
    roles: "DJ · MC · Audio Engineering",
    email: "brayton@crossroadsweddingco.com",
    phone: "(812) 405-8918",
    mosaicTitle: "Chief Business Officer",
  },
  {
    slug: "ashton",
    name: "Ashton Carter",
    title: "Production Manager",
    roles: "DJ · MC · Crew & Gear",
    email: "ashton@crossroadsweddingco.com",
    phone: "(812) 341-4548",
    mosaicTitle: "Chief Product Officer",
  },
  {
    // Added 2026-09-04. The justice@ mailbox is still unconfirmed. DJ and MC
    // stay off his roles line until he has run weddings solo (Jacob).
    slug: "justice",
    name: "Justice Ely",
    title: "Strategic Execution Specialist",
    roles: "Percussion · Crew & Gear",
    email: "justice@crossroadsweddingco.com",
    phone: "(812) 657-1879",
    mosaicTitle: "Chief Logistics Officer",
  },
];

// The brand roll on the Mosaic Green side, grouped by family and colour.
const MOSAIC_BRANDS = [
  [
    { text: "Crossroads Wedding Co.", color: C.brandTan },
    { text: "Verda Studio · Kawaii Katz", color: C.brandLavender },
  ],
  [
    { text: "Legal Leaf Market · Herbal Leaf Market · Nicotia Market", color: C.brandGreen },
    { text: "GearAvail · Stompbox World", color: C.brandCyan },
  ],
];

// ---------------------------------------------------------------------------
// Fonts

const LEGACY_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/533.20.25";

async function loadGoogleFont(family, weight, italic = false) {
  const style = italic ? "italic" : "normal";
  const cached = path.join(FONT_CACHE, `${family}-${weight}-${style}.ttf`);
  try {
    return await fs.readFile(cached);
  } catch {
    // not cached yet
  }
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axis}`, {
    headers: { "User-Agent": LEGACY_UA },
  });
  if (!cssRes.ok) throw new Error(`${family} ${weight} ${style}: CSS request failed (${cssRes.status})`);
  const url = (await cssRes.text()).match(/src: url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`${family} ${weight} ${style}: no .ttf in the CSS response`);
  const fontRes = await fetch(url);
  if (!fontRes.ok) throw new Error(`${family} ${weight} ${style}: font download failed (${fontRes.status})`);
  const data = Buffer.from(await fontRes.arrayBuffer());
  await fs.mkdir(FONT_CACHE, { recursive: true });
  await fs.writeFile(cached, data);
  return data;
}

async function fontFaces() {
  const wanted = [
    ["Spectral", 400, false],
    ["Spectral", 600, false],
    ["Spectral", 400, true],
    ["Karla", 400, false],
    ["Karla", 600, false],
    ["Karla", 700, false],
  ];
  const faces = await Promise.all(
    wanted.map(async ([family, weight, italic]) => {
      const data = await loadGoogleFont(family, weight, italic);
      return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${
        italic ? "italic" : "normal"
      };src:url(data:font/ttf;base64,${data.toString("base64")}) format("truetype")}`;
    }),
  );
  return faces.join("\n");
}

// ---------------------------------------------------------------------------
// Logos

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function logoOverride(base) {
  for (const ext of ["svg", "png"]) {
    const file = path.join(LOGO_DIR, `${base}.${ext}`);
    try {
      const data = await fs.readFile(file);
      if (ext === "svg") return data.toString("utf8").replace(/<\?xml[^>]*>/, "");
      return `<img src="data:image/png;base64,${data.toString("base64")}" alt="">`;
    } catch {
      // keep looking
    }
  }
  return null;
}

/** Eight-point compass rose inside a double gold ring. */
function compassSvg() {
  const point = (angle, reach, halfWidth, shoulder, dark, light) =>
    `<g transform="rotate(${angle} 50 50)">` +
    `<path d="M50 ${50 - reach} L${50 - halfWidth} ${50 - shoulder} L50 50 Z" fill="${dark}"/>` +
    `<path d="M50 ${50 - reach} L${50 + halfWidth} ${50 - shoulder} L50 50 Z" fill="${light}"/>` +
    `</g>`;
  const ordinals = [45, 135, 225, 315].map((a) => point(a, 27, 4.5, 6.5, C.goldDark, C.gold)).join("");
  const cardinals = [0, 90, 180, 270].map((a) => point(a, 38, 6, 8, C.terracottaDark, C.terracotta)).join("");
  const beads = [0, 90, 180, 270]
    .map((a) => `<circle cx="50" cy="3.5" r="2.4" fill="${C.gold}" transform="rotate(${a} 50 50)"/>`)
    .join("");
  const ticks = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]
    .map((a) => `<path d="M50 7 V10.5" stroke="${C.gold}" stroke-width="1.2" transform="rotate(${a} 50 50)"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<circle cx="50" cy="50" r="46.5" fill="none" stroke="${C.gold}" stroke-width="2.6"/>` +
    `<circle cx="50" cy="50" r="40.5" fill="none" stroke="${C.gold}" stroke-width="0.9"/>` +
    ticks +
    ordinals +
    cardinals +
    `<circle cx="50" cy="50" r="3.6" fill="${C.cream}" stroke="${C.terracottaDark}" stroke-width="1"/>` +
    beads +
    `</svg>`
  );
}

/** Mosaic-tiled globe with the ribbon across it. Deterministic tile layout. */
function mosaicSvg(instance) {
  let seed = 20260904;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const cx = 60;
  const cy = 50;
  const r = 44;
  const palette = ["#2f6b47", "#4f9463", "#8fc27b", C.gold, C.terracotta, "#efe3c8", "#1f4d35", "#3f7d8a", "#b7d68f"];
  let tiles = "";
  let y = cy - r;
  while (y < cy + r) {
    const h = 5 + rnd() * 5;
    let x = cx - r - rnd() * 6;
    while (x < cx + r) {
      const w = 5 + rnd() * 7;
      const fill = palette[Math.floor(rnd() * palette.length)];
      tiles += `<rect x="${(x + 0.55).toFixed(2)}" y="${(y + 0.55).toFixed(2)}" width="${(w - 1.1).toFixed(2)}" height="${(h - 1.1).toFixed(2)}" rx="0.5" fill="${fill}"/>`;
      x += w;
    }
    y += h;
  }
  const clipId = `mg-clip-${instance}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">` +
    `<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#efe3c8"/>` +
    `<g clip-path="url(#${clipId})">${tiles}</g>` +
    `<circle cx="${cx}" cy="${cy}" r="${r - 0.4}" fill="none" stroke="${C.greenDeep}" stroke-width="0.9"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r + 2.2}" fill="none" stroke="${C.gold}" stroke-width="3.4"/>` +
    // ribbon with forked tails
    `<path d="M9 70 H111 L105.5 79.5 L111 89 H9 L14.5 79.5 Z" fill="${C.terracottaDark}" stroke="${C.gold}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<text x="60" y="83" text-anchor="middle" font-family="Karla" font-weight="700" font-size="9.6" letter-spacing="0.9" fill="${C.cream}">MOSAIC GREEN</text>` +
    `<text x="60" y="97.5" text-anchor="middle" font-family="Karla" font-weight="700" font-size="3.6" letter-spacing="1.4" fill="${C.gold}">WORLDWIDE</text>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// Cards

const STYLE = `
@page{size:${SHEET_W}in ${SHEET_H}in;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:"Karla",sans-serif;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.sheet{position:relative;width:${SHEET_W}in;height:${SHEET_H}in;overflow:hidden;break-after:page;page-break-after:always}
.sheet:last-child{break-after:auto;page-break-after:auto}
.sheet svg,.sheet img{display:block;width:100%;height:100%}
.frame{position:absolute;inset:${BLEED + FRAME_INSET}in;border:0.75pt dashed}
.trim{position:absolute;left:${BLEED}in;top:${BLEED}in;width:${TRIM_W}in;height:${TRIM_H}in}

.front{background:${C.cream};color:${C.charcoal}}
.front .frame{border-color:${C.frameFront}}
.brand{position:absolute;left:.29in;top:.22in;display:flex;align-items:center;gap:.1in}
.brand .logo{width:.4in;height:.4in;flex:none}
.wm-main{font-family:"Spectral";font-weight:400;font-size:10.5pt;line-height:1;letter-spacing:.2em;color:${C.charcoal}}
.wm-sub{display:flex;align-items:center;gap:.05in;margin-top:.035in;padding-right:.2em}
.wm-sub i{flex:1;height:.6pt;background:${C.gold}}
.wm-sub span{font-weight:600;font-size:4.3pt;line-height:1;letter-spacing:.32em;color:${C.muted}}
.who{position:absolute;left:.29in;bottom:.6in;max-width:2.15in}
.front .name{font-family:"Spectral";font-weight:600;font-size:14pt;line-height:1.05;color:${C.charcoal}}
.title{margin-top:.05in;font-weight:700;font-size:6.3pt;line-height:1.35;letter-spacing:.14em;text-transform:uppercase;color:${C.terracotta}}
.roles{margin-top:.04in;font-family:"Spectral";font-style:italic;font-weight:400;font-size:6.9pt;line-height:1.2;color:${C.muted}}
.who .rule{margin-top:.06in;width:.58in;height:.7pt;background:${C.gold}}
.contact{position:absolute;left:.29in;top:1.42in;font-weight:400;font-size:6.9pt;line-height:1.3;color:${C.ink};letter-spacing:.01em}
.contact .url{font-weight:700;color:${C.terracotta}}
.qr{position:absolute;right:.29in;top:1.02in;width:.6in}
.qr .code{width:.6in;height:.6in}
.qr-label{margin-top:.07in;text-align:center;font-weight:600;font-size:5.8pt;line-height:1;letter-spacing:.2em;color:${C.terracotta}}

.back{background:${C.green};color:${C.cream}}
.back .frame{border-color:${C.frameBack}}
.globe{position:absolute;left:50%;top:.24in;width:.6in;height:.6in;transform:translateX(-50%)}
.stack{position:absolute;left:.2in;right:.2in;top:.92in;text-align:center}
.mg-co{font-weight:700;font-size:6pt;line-height:1;letter-spacing:.22em;color:${C.gold}}
.back .name{margin-top:.04in;font-family:"Spectral";font-weight:600;font-size:11pt;line-height:1.05;color:${C.cream}}
.mg-title{margin-top:.015in;font-weight:700;font-size:6pt;line-height:1.2;letter-spacing:.16em;text-transform:uppercase;color:${C.mint}}
.back .phone{margin-top:.03in;font-weight:400;font-size:7pt;line-height:1;letter-spacing:.03em;color:${C.parchment}}
.back .rule{margin:.045in auto 0;width:.38in;height:.7pt;background:${C.gold}}
.brands{margin-top:.05in;font-weight:400;font-size:5.3pt;line-height:1.5;letter-spacing:.01em;white-space:nowrap}
.brands span{margin:0 .045in}
`;

function frontHtml(p, qrSvg, logo) {
  const title = esc(p.title).replace(/\n/g, "<br>");
  const phone = p.phone ? `<div>${esc(p.phone)}</div>` : "";
  return `<div class="sheet front">
  <div class="frame"></div>
  <div class="trim">
    <div class="brand">
      <div class="logo">${logo}</div>
      <div class="wordmark">
        <div class="wm-main">CROSSROADS</div>
        <div class="wm-sub"><i></i><span>WEDDING CO.</span><i></i></div>
      </div>
    </div>
    <div class="who">
      <div class="name">${esc(p.name)}</div>
      <div class="title">${title}</div>
      <div class="roles">${esc(p.roles)}</div>
      <div class="rule"></div>
    </div>
    <div class="contact">
      <div>${esc(p.email)}</div>
      ${phone}
      <div class="url">crossroadsweddingco.com</div>
    </div>
    <div class="qr">
      <div class="code">${qrSvg}</div>
      <div class="qr-label">BOOK ME</div>
    </div>
  </div>
</div>`;
}

function backHtml(p, logo) {
  const phone = p.phone ? `<div class="phone">${esc(p.phone)}</div>` : "";
  const brands = MOSAIC_BRANDS.map(
    (line) =>
      `<div>${line.map((b) => `<span style="color:${b.color}">${esc(b.text)}</span>`).join("")}</div>`,
  ).join("");
  return `<div class="sheet back">
  <div class="frame"></div>
  <div class="trim">
    <div class="globe">${logo}</div>
    <div class="stack">
      <div class="mg-co">MOSAIC GREEN WORLDWIDE</div>
      <div class="name">${esc(p.name)}</div>
      <div class="mg-title">${esc(p.mosaicTitle)}</div>
      ${phone}
      <div class="rule"></div>
      <div class="brands">${brands}</div>
    </div>
  </div>
</div>`;
}

function document(fonts, body, extraStyle = "") {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Business cards</title>
<style>${fonts}\n${STYLE}\n${extraStyle}</style></head>
<body>${body}</body></html>`;
}

// ---------------------------------------------------------------------------
// Chromium

// Playwright installs two binaries: the full Chromium and the slimmer
// "headless shell". The full browser prints the PDFs. Screenshots go through
// the shell because in the full browser's headless mode --window-size counts
// the (invisible) toolbar, which leaves the viewport short of the sheet and
// crops the bottom of the card; the shell sizes the viewport exactly.
function findBrowsers() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  const newest = (prefix, file) => {
    let dirs = [];
    try {
      dirs = fsSync
        .readdirSync(root)
        .filter((d) => d.startsWith(prefix) && /-\d+$/.test(d))
        .sort()
        .reverse();
    } catch {
      // no browsers directory at all
    }
    for (const d of dirs) {
      const bin = path.join(root, d, "chrome-linux", file);
      if (fsSync.existsSync(bin)) return bin;
    }
    return null;
  };
  const chrome = process.env.CHROME_PATH ?? newest("chromium-", "chrome");
  if (!chrome) throw new Error(`No Chromium under ${root}. Set CHROME_PATH to a Chrome or Chromium binary.`);
  const shell = newest("chromium_headless_shell-", "headless_shell");
  if (!shell) console.warn("! No headless shell found; PNGs may come out cropped at the bottom. Check them.");
  return { chrome, shell: shell ?? chrome };
}

const BROWSERS = findBrowsers();
const PROFILE = await fs.mkdtemp(path.join(os.tmpdir(), "cards-chrome-"));

function chromium(args, bin = BROWSERS.chrome) {
  execFileSync(
    bin,
    [
      bin === BROWSERS.chrome ? "--headless=new" : "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-extensions",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=8000",
      `--user-data-dir=${PROFILE}`,
      ...args,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

function screenshot(htmlFile, pngFile) {
  const scale = DPI / CSS_DPI;
  chromium(
    [
      `--screenshot=${pngFile}`,
      `--window-size=${Math.round(SHEET_W * CSS_DPI)},${Math.round(SHEET_H * CSS_DPI)}`,
      `--force-device-scale-factor=${scale}`,
      pathToFileURL(htmlFile).href,
    ],
    BROWSERS.shell,
  );
}

function printPdf(htmlFile, pdfFile) {
  chromium([`--print-to-pdf=${pdfFile}`, "--no-pdf-header-footer", pathToFileURL(htmlFile).href]);
}

/** Stamp a PNG with a physical resolution so print tools read it at 300 DPI. */
function withDpi(png, dpi) {
  const pixelsPerMetre = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(pixelsPerMetre, 0);
  data.writeUInt32BE(pixelsPerMetre, 4);
  data[8] = 1;
  const typeAndData = Buffer.concat([Buffer.from("pHYs", "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(typeAndData) >>> 0, 0);
  const phys = Buffer.concat([len, typeAndData, crc]);

  const parts = [png.subarray(0, 8)];
  let off = 8;
  while (off < png.length) {
    const chunkLen = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    const end = off + 12 + chunkLen;
    if (type !== "pHYs") parts.push(png.subarray(off, end));
    if (type === "IHDR") parts.push(phys);
    off = end;
  }
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Main

const fonts = await fontFaces();
const compass = (await logoOverride("crossroads")) ?? compassSvg();
const mosaicOverride = await logoOverride("mosaic-green");
let mosaicInstances = 0;
const mosaic = () => mosaicOverride ?? mosaicSvg(mosaicInstances++);

const work = await fs.mkdtemp(path.join(os.tmpdir(), "cards-html-"));
await fs.mkdir(OUT_DIR, { recursive: true });

const rel = (f) => path.relative(ROOT, f);
const sizeKb = async (f) => `${((await fs.stat(f)).size / 1024).toFixed(0)} KB`;

const allSheets = [];
for (const p of PEOPLE) {
  if (!p.phone) console.warn(`! ${p.name}: no phone number yet, the phone line is left off both faces`);

  // /book?with=<slug> opens this person's own call-booking calendar
  // (lib/schedulers.ts). The link lives on our domain, so what it shows can
  // change any time without reprinting; the slug itself is printed and must
  // never be renamed. An unknown slug lands on the plain booking page.
  const qrTarget = `${SITE_URL}/book?with=${p.slug}`;
  const qrSvg = (
    await QRCode.toString(qrTarget, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 0,
      color: { dark: C.charcoal, light: "#0000" },
    })
  ).replace(/\s(width|height)="[^"]*"/g, "");

  const front = frontHtml(p, qrSvg, compass);
  const back = backHtml(p, mosaic());
  allSheets.push(front, back);

  const frontHtmlFile = path.join(work, `${p.slug}-front.html`);
  const backHtmlFile = path.join(work, `${p.slug}-back.html`);
  const bothHtmlFile = path.join(work, `${p.slug}.html`);
  await fs.writeFile(frontHtmlFile, document(fonts, front));
  await fs.writeFile(backHtmlFile, document(fonts, back));
  await fs.writeFile(bothHtmlFile, document(fonts, front + back));

  for (const [htmlFile, side] of [
    [frontHtmlFile, "front"],
    [backHtmlFile, "back"],
  ]) {
    const raw = path.join(work, `${p.slug}-${side}.raw.png`);
    screenshot(htmlFile, raw);
    const out = path.join(OUT_DIR, `${p.slug}-${side}.png`);
    await fs.writeFile(out, withDpi(await fs.readFile(raw), DPI));
    console.log(`${rel(out)}  ${await sizeKb(out)}`);

    const sidePdf = path.join(OUT_DIR, `${p.slug}-${side}.pdf`);
    printPdf(htmlFile, sidePdf);
    console.log(`${rel(sidePdf)}  ${await sizeKb(sidePdf)}`);
  }

  const pdf = path.join(OUT_DIR, `${p.slug}.pdf`);
  printPdf(bothHtmlFile, pdf);
  console.log(`${rel(pdf)}  ${await sizeKb(pdf)}`);
}

const allHtmlFile = path.join(work, "all-cards.html");
await fs.writeFile(allHtmlFile, document(fonts, allSheets.join("\n")));
const allPdf = path.join(OUT_DIR, "all-cards.pdf");
printPdf(allHtmlFile, allPdf);
console.log(`${rel(allPdf)}  ${await sizeKb(allPdf)}`);

// A single on-screen proof of every card, with the trim line drawn on, for a
// quick look before uploading. Not part of the print output.
if (process.env.CARDS_PREVIEW) {
  const proofStyle = `
body{background:#7a756f;padding:.3in}
.row{display:flex;gap:.3in;align-items:flex-start;margin-bottom:.3in}
.label{font-weight:400;font-size:9pt;letter-spacing:.2em;color:#e9e2d6;margin:0 0 .12in .05in}
.sheet{box-shadow:0 .08in .25in rgba(0,0,0,.35)}
.trim::after{content:"";position:absolute;inset:0;border:.5pt dashed rgba(255,255,255,.55);pointer-events:none}
.front .trim::after{border-color:rgba(0,0,0,.35)}`;
  let body = "";
  let instance = 100;
  for (const p of PEOPLE) {
    const qrSvg = (
      await QRCode.toString(`${SITE_URL}/book?with=${p.slug}`, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 0,
        color: { dark: C.charcoal, light: "#0000" },
      })
    ).replace(/\s(width|height)="[^"]*"/g, "");
    body += `<div class="label">${esc(p.name).toUpperCase()}</div><div class="row">${frontHtml(
      p,
      qrSvg,
      compass,
    )}${backHtml(p, mosaicOverride ?? mosaicSvg(instance++))}</div>`;
  }
  const proofHtml = path.join(work, "proof.html");
  await fs.writeFile(proofHtml, document(fonts, body, proofStyle));
  const proofPng = path.resolve(process.env.CARDS_PREVIEW);
  chromium(
    [
      `--screenshot=${proofPng}`,
      `--window-size=${Math.round((SHEET_W * 2 + 0.9) * CSS_DPI)},${Math.round((SHEET_H + 0.65) * CSS_DPI * PEOPLE.length + 40)}`,
      "--force-device-scale-factor=2",
      pathToFileURL(proofHtml).href,
    ],
    BROWSERS.shell,
  );
  console.log(`proof: ${proofPng}`);
}

await fs.rm(work, { recursive: true, force: true });
await fs.rm(PROFILE, { recursive: true, force: true });
