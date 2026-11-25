"use client";

// Rabbit's Balloons on /partners/rabbits-balloons (2026-11-25). One provider
// holds the Color Studio palette and the occasion, so the palette a visitor
// builds rides along in the inquiry, and "Plan a wedding" picks the occasion.
// The studio is ported from the site preview Heart of Columbus built for
// Rachael Starr; the inquiry is real here (app/api/partners/inquiry), where on
// her preview site it sent nothing. Logic: lib/balloon-studio.ts and
// lib/partner-inquiry.ts.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import s from "@/components/partners/rabbits-balloons.module.css";
import {
  addToPalette,
  COLORS,
  colorByName,
  layout,
  MAX_COLORS,
  nearestColor,
  paletteLine,
  PALETTES,
  SHAPE_LABEL,
  type Shape,
} from "@/lib/balloon-studio";
import { BUDGETS, OCCASIONS } from "@/lib/partner-inquiry";

type Api = {
  colors: string[];
  setColors: (c: string[]) => void;
  palName: string;
  setPalName: (n: string) => void;
  shape: Shape;
  setShape: (s: Shape) => void;
  seed: number;
  setSeed: (n: number) => void;
  occasion: string;
  setOccasion: (o: string) => void;
};
const Ctx = createContext<Api | null>(null);
function useStudio(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("RabbitStudio provider missing");
  return v;
}

export function RabbitStudio({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<string[]>(PALETTES[0].colors);
  const [palName, setPalName] = useState(PALETTES[0].name);
  const [shape, setShape] = useState<Shape>("arch");
  const [seed, setSeed] = useState(11);
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0]);
  const api = useMemo<Api>(
    () => ({ colors, setColors, palName, setPalName, shape, setShape, seed, setSeed, occasion, setOccasion }),
    [colors, palName, shape, seed, occasion],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** "Plan a wedding or shower": picks the occasion, then the form. */
export function OccasionLink({ occasion, children }: { occasion: string; children: ReactNode }) {
  const { setOccasion } = useStudio();
  return (
    <a className={s.link} href="#start" onClick={() => setOccasion(occasion)}>
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// The Color Studio
// ---------------------------------------------------------------------------

export function ColorStudio() {
  const { colors, setColors, palName, setPalName, shape, setShape, seed, setSeed } = useStudio();
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState("#990000");
  const matched = nearestColor(pick);
  const circles = useMemo(() => layout(shape, colors, seed), [shape, colors, seed]);
  const families = useMemo(() => {
    const m = new Map<string, typeof COLORS>();
    for (const c of COLORS) m.set(c.family, [...(m.get(c.family) || []), c]);
    return [...m];
  }, []);

  const add = (name: string) => {
    const r = addToPalette(colors, name);
    setMsg(r.message);
    if (r.colors !== colors) {
      setColors(r.colors);
      setPalName("");
    }
  };
  const remove = (name: string) => {
    setMsg("");
    setColors(colors.filter((c) => c !== name));
    setPalName("");
  };
  const shown = colors.length ? colors : ["Pastel Dusk Cream"];

  return (
    <div className={s.studioWrap}>
      <div className={s.viewer}>
        <svg viewBox="0 0 640 450" role="img" aria-labelledby="rb-stage-says">
          <defs>
            <radialGradient id="rb-sh" cx=".36" cy=".3" r=".78">
              <stop offset="0" stopColor="#fff" stopOpacity=".62" />
              <stop offset=".16" stopColor="#fff" stopOpacity=".26" />
              <stop offset=".46" stopColor="#fff" stopOpacity="0" />
              <stop offset=".84" stopColor="#2a1a10" stopOpacity=".06" />
              <stop offset="1" stopColor="#2a1a10" stopOpacity=".22" />
            </radialGradient>
            <linearGradient id="rb-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fffaf3" />
              <stop offset="1" stopColor="#f4e8d8" />
            </linearGradient>
            <radialGradient id="rb-pool" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#6b4a33" stopOpacity=".2" />
              <stop offset="1" stopColor="#6b4a33" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="640" height="450" fill="url(#rb-wall)" />
          <rect y="398" width="640" height="52" fill="#eedfcb" />
          <ellipse cx="320" cy="402" rx="250" ry="14" fill="url(#rb-pool)" />
          <g>
            {circles.map((c, i) => (
              <g key={i}>
                <circle cx={c.x} cy={c.y} r={c.r} fill={c.fill} />
                <circle cx={c.x} cy={c.y} r={c.r} fill="url(#rb-sh)" />
              </g>
            ))}
          </g>
        </svg>
        <div className={s.shapes} role="group" aria-label="Shape">
          {(Object.keys(SHAPE_LABEL) as Shape[]).map((k) => (
            <button key={k} type="button" className={s.seg} aria-pressed={shape === k} onClick={() => setShape(k)}>
              {SHAPE_LABEL[k]}
            </button>
          ))}
          <span className={s.spacer} />
          <button type="button" className={s.seg} onClick={() => setSeed(1 + Math.floor(Math.random() * 99999))}>
            Shuffle
          </button>
        </div>
        <p className={s.says} id="rb-stage-says" aria-live="polite">
          {SHAPE_LABEL[shape]} preview in {shown.join(", ")}. Inspiration only.
        </p>
      </div>

      <div className={s.panel}>
        <div className={s.card}>
          <h3>Curated palettes</h3>
          <p className={s.hint}>Mixes that work. Tap one to start there.</p>
          <div className={s.palettes}>
            {PALETTES.map((p) => (
              <button
                key={p.name}
                type="button"
                className={s.pal}
                aria-pressed={palName === p.name}
                aria-label={`${p.name}: ${p.colors.join(", ")}`}
                onClick={() => {
                  setColors(p.colors);
                  setPalName(p.name);
                  setMsg("");
                }}
              >
                {p.name}
                <span className={s.dots} aria-hidden="true">
                  {p.colors.map((n) => (
                    <i key={n} style={{ background: colorByName(n)?.hex }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={s.card}>
          <h3>Your palette</h3>
          <p className={s.hint}>Up to {MAX_COLORS} colors. The first color is used the most.</p>
          <div className={s.mine}>
            {colors.length ? (
              colors.map((n) => (
                <span key={n} className={s.chip}>
                  <i style={{ background: colorByName(n)?.hex }} />
                  {n}
                  <button type="button" aria-label={`Remove ${n}`} onClick={() => remove(n)}>
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className={s.hint}>No colors yet. Pick a palette or add a color.</span>
            )}
          </div>
          <p className={s.msg} role="status">
            {msg}
          </p>
          <a className={`${s.btn} ${s.quiet} ${s.toForm}`} href="#start">
            Send this palette with my inquiry
          </a>
        </div>

        <div className={s.card}>
          <h3>Match any color</h3>
          <p className={s.hint}>Pick a brand, team or school color and see the closest Sempertex balloon.</p>
          <div className={s.match}>
            <input type="color" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Color to match" />
            <div className={s.res} aria-live="polite">
              <span>Closest balloon</span>
              <b>
                <i style={{ background: matched.hex }} />
                {matched.name}
              </b>
            </div>
            <button type="button" className={s.add} onClick={() => add(matched.name)}>
              Add to palette
            </button>
          </div>
        </div>

        <div className={s.card}>
          <details className={s.all}>
            <summary>All Sempertex colors</summary>
            {families.map(([fam, list]) => (
              <div key={fam} className={s.fam}>
                <p>{fam}</p>
                <div className={s.sw}>
                  {list.map((c) => {
                    const on = colors.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        title={c.name}
                        aria-label={c.name}
                        aria-pressed={on}
                        style={{ background: c.hex }}
                        onClick={() => (on ? remove(c.name) : add(c.name))}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </details>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The inquiry: real here, it saves and emails us to pass on to Rachael
// ---------------------------------------------------------------------------

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; name: string } | { kind: "error"; text: string };

export function InquiryForm({ fallbackEmail, rabbitSrc }: { fallbackEmail: string; rabbitSrc: string }) {
  const { colors, shape, occasion, setOccasion } = useStudio();
  const [touched, setTouched] = useState(false);
  const [ownColors, setOwnColors] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const colorsValue = touched ? ownColors : paletteLine(shape, colors);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;
    const f = new FormData(e.currentTarget);
    const body = {
      partner: "rabbits-balloons",
      name: String(f.get("name") || ""),
      contact: String(f.get("contact") || ""),
      occasion,
      date: String(f.get("date") || ""),
      venue: String(f.get("venue") || ""),
      colors: colorsValue,
      budget: String(f.get("budget") || ""),
      more: String(f.get("more") || ""),
      website: String(f.get("website") || ""),
    };
    setStatus({ kind: "sending" });
    try {
      const r = await fetch("/api/partners/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && j.ok) setStatus({ kind: "sent", name: body.name.trim().split(/\s+/)[0] || "" });
      else setStatus({ kind: "error", text: j.error || "That didn't send. Try again, or email us." });
    } catch {
      setStatus({ kind: "error", text: "That didn't send. Check your connection and try again, or email us." });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className={s.form} role="status">
        <div className={s.done}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rabbitSrc} alt="" width={246} height={368} />
          <h3>Down the rabbit hole{status.name ? `, ${status.name}` : ""}.</h3>
          <p>
            We got it, palette and all, and we&rsquo;re passing it to Rachael. She replies with ideas, a design sketch and a
            quote before a single balloon is ordered.
          </p>
          <p className={s.fine} style={{ margin: "0 auto" }}>
            Need to add something? Write to <a href={`mailto:${fallbackEmail}`}>{fallbackEmail}</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <label>
        Your name
        <input name="name" autoComplete="name" required maxLength={120} />
      </label>
      <label>
        Email or phone
        <input name="contact" autoComplete="email" required maxLength={160} />
      </label>
      <label>
        What&rsquo;s the occasion?
        <select name="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
          {OCCASIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label>
        Event date
        <input name="date" type="date" />
      </label>
      <label className={s.full}>
        Venue or town
        <input name="venue" maxLength={160} />
      </label>
      <label className={s.full}>
        <span>
          Colors <small>(filled in from the Color Studio, edit freely)</small>
        </span>
        <textarea
          name="colors"
          rows={2}
          style={{ minHeight: 0 }}
          value={colorsValue}
          maxLength={300}
          placeholder="Brand colors, a mood, three words"
          onChange={(e) => {
            setTouched(true);
            setOwnColors(e.target.value);
          }}
        />
        {touched && (
          <button type="button" className={s.link} style={{ justifySelf: "start", fontSize: 14 }} onClick={() => setTouched(false)}>
            Use my Color Studio palette again
          </button>
        )}
      </label>
      <label className={s.full}>
        <span>
          Budget range <small>(optional)</small>
        </span>
        <select name="budget" defaultValue="">
          <option value="">Not sure yet</option>
          {BUDGETS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <label className={s.full}>
        Anything else
        <textarea name="more" maxLength={2000} placeholder="Size, setup time, photos you love" />
      </label>
      <div className={s.trap} aria-hidden="true">
        <label>
          Leave this empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {status.kind === "error" && (
        <p className={s.err} role="alert">
          {status.text} <a href={`mailto:${fallbackEmail}`}>{fallbackEmail}</a>
        </p>
      )}
      <button className={`${s.btn} ${s.primary} ${s.full}`} type="submit" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Sending…" : "Send to Rachael"}
      </button>
      <p className={s.fine} style={{ margin: 0, gridColumn: "1 / -1" }}>
        Rachael doesn&rsquo;t have a public inbox yet, so this comes to us at Crossroads and we pass it straight to her. We use
        your details only to answer you.
      </p>
    </form>
  );
}
