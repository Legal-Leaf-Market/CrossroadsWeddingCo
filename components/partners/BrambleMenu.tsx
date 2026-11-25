"use client";

// The Wild Bramble menu builder on /partners/wild-bramble-catering
// (2026-11-25). Visitors tap dishes from Wild Bramble's own published menu,
// add the details their quote form asks for, and send it straight to Wild
// Bramble's inbox (a mailto) or copy it into their form. Nothing passes
// through Crossroads and nothing is stored. Logic: lib/wild-bramble.ts.

import { useEffect, useMemo, useRef, useState } from "react";
import s from "@/components/partners/wild-bramble.module.css";
import { venueClock } from "@/lib/cookie-order";
import {
  DIETS,
  EVENT_TYPES,
  leadTimeNote,
  MENU,
  picksByCourse,
  requestMailto,
  requestText,
  SERVICE_STYLES,
  WILD_BRAMBLE,
  type MenuRequest,
} from "@/lib/wild-bramble";

export function BrambleMenu() {
  const [picks, setPicks] = useState<string[]>([]);
  const [eventType, setEventType] = useState<string>("Wedding");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(60);
  const [place, setPlace] = useState("");
  const [service, setService] = useState<string>("Not sure yet");
  const [budget, setBudget] = useState("");
  const [diets, setDiets] = useState<string[]>([]);
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [today, setToday] = useState("");
  const [copied, setCopied] = useState(false);
  const [panelSeen, setPanelSeen] = useState(false);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => setToday(venueClock(new Date()).date), []);
  useEffect(() => {
    const el = panel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPanelSeen(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const toggle = (name: string) => setPicks((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  const toggleDiet = (d: string) => setDiets((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));

  const req: MenuRequest = { picks, eventType, date, time, guests, place, service, budget, diets, allergies, notes };
  const mailto = useMemo(() => requestMailto(WILD_BRAMBLE.email, req), [picks, eventType, date, time, guests, place, service, budget, diets, allergies, notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = picksByCourse(picks);
  const note = today ? leadTimeNote(eventType, date, today) : "";

  async function copy() {
    const text = requestText(req);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy your menu request:", text);
    }
  }

  return (
    <div className={s.builder}>
      <div className={s.courses}>
        {MENU.map((c) => (
          <section key={c.key} className={s.course} aria-labelledby={`wb-${c.key}`}>
            <div className={s.courseHead}>
              <h3 id={`wb-${c.key}`}>{c.title}</h3>
              <span>{c.about}</span>
            </div>
            <div className={s.dishes}>
              {c.dishes.map((d) => (
                <button key={d.name} type="button" className={s.dish} aria-pressed={picks.includes(d.name)} onClick={() => toggle(d.name)}>
                  {d.name}
                  {d.note && <small>{d.note}</small>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {picks.length > 0 && !panelSeen && (
        <a className={s.jump} href="#wb-panel">
          <b>{picks.length}</b> Review and send your menu
        </a>
      )}

      <aside className={s.panel} id="wb-panel" ref={panel} aria-labelledby="wb-yours">
        <h3 id="wb-yours">Your menu</h3>
        <p className={s.count} aria-live="polite">
          {picks.length ? `${picks.length} ${picks.length === 1 ? "dish" : "dishes"} picked` : "Tap dishes to add them."}
        </p>
        {groups.length ? (
          <ul className={s.picked}>
            {groups.flatMap((g) =>
              g.dishes.map((d) => (
                <li key={d}>
                  <span>
                    {d} <small>{g.title}</small>
                  </span>
                  <button type="button" aria-label={`Remove ${d}`} onClick={() => toggle(d)}>
                    ×
                  </button>
                </li>
              )),
            )}
          </ul>
        ) : (
          <p className={s.empty}>Nothing yet. A few favorites is plenty; they build the full menu with you.</p>
        )}

        <div className={s.grid2}>
          <label>
            Event type
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label>
          Guests: {guests}
          <input
            type="range"
            min={WILD_BRAMBLE.guests.min}
            max={WILD_BRAMBLE.guests.max}
            step={5}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            aria-label="Guest count"
          />
        </label>
        <div className={s.grid2}>
          <label>
            Time
            <input value={time} maxLength={20} placeholder="5 PM" onChange={(e) => setTime(e.target.value)} />
          </label>
          <label>
            Target budget
            <input value={budget} maxLength={60} placeholder="Optional" onChange={(e) => setBudget(e.target.value)} />
          </label>
        </div>
        <label>
          Location
          <input value={place} maxLength={160} placeholder="Venue, town or home" onChange={(e) => setPlace(e.target.value)} />
        </label>
        <label>
          Service
          <select value={service} onChange={(e) => setService(e.target.value)}>
            {SERVICE_STYLES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div>
          <span style={{ font: "600 13.5px/1.2 var(--body)", color: "#4d4246" }}>Dietary needs</span>
          <div className={s.diets} role="group" aria-label="Dietary needs" style={{ marginTop: 6 }}>
            {DIETS.map((d) => (
              <button key={d} type="button" className={s.diet} aria-pressed={diets.includes(d)} onClick={() => toggleDiet(d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <label>
          Allergies or sensitivities
          <textarea value={allergies} maxLength={200} placeholder="Anything they should cook around" onChange={(e) => setAllergies(e.target.value)} />
        </label>
        <label>
          Tell them about your gathering
          <textarea value={notes} maxLength={600} placeholder="The setting, the feeling, family style or plated" onChange={(e) => setNotes(e.target.value)} />
        </label>

        {note && (
          <p className={s.note} role="status">
            {note}
          </p>
        )}

        <div className={s.actions}>
          <a className={`${s.btn} ${s.primary}`} href={mailto}>
            Email this menu to Wild Bramble
          </a>
          <div className={s.row}>
            <button type="button" onClick={copy}>
              {copied ? "Copied" : "Copy it for their form"}
            </button>
            <a className={s.link} href={WILD_BRAMBLE.links.quote} target="_blank" rel="noopener">
              Open their quote form
            </a>
          </div>
        </div>
        <p className={s.fine} style={{ margin: 0 }}>
          This opens your own email app, addressed to Wild Bramble. Nothing goes through Crossroads. They reply with menu ideas and a
          proposal, usually within three business days.
        </p>
      </aside>
    </div>
  );
}
