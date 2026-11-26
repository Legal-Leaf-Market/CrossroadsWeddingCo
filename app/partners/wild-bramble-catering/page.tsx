import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import s from "@/components/partners/wild-bramble.module.css";
import { BrambleMenu } from "@/components/partners/BrambleMenu";
import { DIETS, WILD_BRAMBLE as WB } from "@/lib/wild-bramble";

// Wild Bramble Catering (2026-11-25, Jacob: "Make a page for Wild Brambe now
// ... Catering in Columbus ... They are on HOC"). Built from Heart of
// Columbus's listing (src/data/added.mjs there, checked 2026-11-24) and their
// own website, read 2026-11-25; every fact and its source is in
// lib/wild-bramble.ts. They have no store, so the "order" is a menu built from
// their published dishes and sent straight to their inbox (BrambleMenu): it
// never passes through Crossroads. Their words are paraphrased except one
// short quote. No photos: theirs are theirs, and the art here is ours.
export const revalidate = 86400;

const head = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--wb-head", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], variable: "--wb-body", display: "swap" });

const TITLE = "Wild Bramble Catering: seasonal catering in Columbus, Indiana";
const DESCRIPTION =
  "A small Columbus, Indiana catering studio cooking seasonal, from-scratch menus for weddings, corporate tables and private gatherings of 10 to 100 guests, plus weekly meal prep. Build a menu from their dishes and send it to them.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `/partners/${WB.slug}` },
  openGraph: { url: `/partners/${WB.slug}`, title: "Wild Bramble Catering: cooked for like family, with what's in season", description: DESCRIPTION },
};

function Bramble() {
  return (
    <figure className={s.art}>
      <svg viewBox="0 0 440 420" role="img" aria-label="Illustration of a bramble branch with blackberries, leaves and a small white flower">
        <ellipse cx="220" cy="396" rx="170" ry="12" fill="#3b1f36" opacity=".08" />
        <g className={s.sway}>
          <path d="M70 400 C120 320 150 250 210 190 S330 80 370 40" fill="none" stroke="#5a3a3f" strokeWidth="7" strokeLinecap="round" />
          <path d="M150 268 C130 240 100 230 76 236" fill="none" stroke="#5a3a3f" strokeWidth="5" strokeLinecap="round" />
          <path d="M262 142 C290 150 318 170 330 196" fill="none" stroke="#5a3a3f" strokeWidth="5" strokeLinecap="round" />
          {[
            [120, 330],
            [180, 222],
            [240, 166],
            [300, 104],
          ].map(([x, y], i) => (
            <path key={`t${i}`} d={`M${x} ${y} l-9 -6 l11 1z`} fill="#5a3a3f" />
          ))}
          <g fill="#7d8f69" stroke="#4d5b3b" strokeWidth="2">
            <path d="M76 236 C50 214 40 186 52 160 C80 172 92 206 76 236z" />
            <path d="M330 196 C356 214 364 246 350 270 C324 254 318 222 330 196z" />
            <path d="M210 190 C186 162 190 128 214 112 C230 140 228 170 210 190z" />
            <path d="M150 268 C172 286 200 288 222 276 C204 252 176 250 150 268z" />
            <path d="M370 40 C392 52 400 76 392 96 C372 86 362 62 370 40z" />
          </g>
          <g stroke="#4d5b3b" strokeWidth="1.4" fill="none" opacity=".7">
            <path d="M58 168 C66 192 72 212 76 234" />
            <path d="M344 222 C340 238 336 254 348 266" />
            <path d="M212 120 C214 146 212 168 210 188" />
          </g>
          {[
            [96, 252, "#3b1f36"],
            [112, 264, "#2a1428"],
            [298, 186, "#3b1f36"],
            [314, 176, "#8e2c5a"],
            [252, 132, "#2a1428"],
            [190, 300, "#8e2c5a"],
            [206, 310, "#3b1f36"],
          ].map(([cx, cy, fill], i) => (
            <g key={`b${i}`}>
              {[
                [0, 0],
                [7, -2],
                [-6, 4],
                [4, 7],
                [-2, -7],
                [9, 6],
                [-8, -3],
              ].map(([dx, dy], j) => (
                <circle key={j} cx={Number(cx) + dx} cy={Number(cy) + dy} r="5.4" fill={String(fill)} />
              ))}
              <circle cx={Number(cx) - 3} cy={Number(cy) - 3} r="1.6" fill="#fff" opacity=".55" />
            </g>
          ))}
          <g transform="translate(150 150)">
            {[0, 72, 144, 216, 288].map((r) => (
              <ellipse key={r} cx="0" cy="-11" rx="7" ry="11" fill="#fffaf3" stroke="#e6dccd" strokeWidth="1.2" transform={`rotate(${r})`} />
            ))}
            <circle r="5" fill="#b98a4e" />
          </g>
        </g>
      </svg>
      <figcaption>Illustration</figcaption>
    </figure>
  );
}

const SERVICES = [
  {
    ic: "💍",
    bg: "#fbf1f6",
    title: "Weddings",
    body: "Built around your season, setting and story.",
    points: ["Multi-course dinners", "Family-style spreads", "Grazing tables"],
    cta: "Ask about a wedding",
  },
  {
    ic: "🗂️",
    bg: "#eef2e8",
    title: "Corporate",
    body: "Food for the workday that people actually look forward to.",
    points: ["Thoughtful lunches", "Boardroom spreads", "Client gatherings"],
    cta: "Ask about a corporate order",
  },
  {
    ic: "🕯️",
    bg: "#f6efe2",
    title: "Private events",
    body: "At home or at the venue you choose.",
    points: ["Intimate dinners", "Birthdays and showers", "Celebrations of every size up to 100"],
    cta: "Ask about a private event",
  },
];

const RUN_SHEET = [
  { when: "Load in", what: "Kitchen and DJ, side by side", body: "Their setup and our sound check both go on the run sheet, so neither one is in the other's way when guests walk in." },
  { when: "Cocktail hour", what: "The grazing board", body: "Something to eat while the photos happen, and music that lets people talk." },
  { when: "Dinner", what: "Served on the kitchen's cue", body: "The MC holds the room until the kitchen is ready, then seats everyone, so plates and platters go out hot." },
  { when: "After dinner", what: "Toasts while plates clear", body: "With full service, their staff clear while the speeches land, so nobody talks over a busy room." },
  { when: "Dessert", what: "To Finish, then the dance floor", body: "Their in-house desserts, or a Cookie Paradise table beside them, and the dance floor opens right behind." },
];

export default function WildBramblePage() {
  return (
    <>
      <Header />
      <main className={`${head.variable} ${body.variable} ${s.wb}`}>
        {/* ---------- Hero ---------- */}
        <section className={s.hero}>
          <div className={`${s.wrap} ${s.heroGrid}`}>
            <div>
              <p className={s.crumbs}>
                <a href="/partners">Crossroads partners</a>
              </p>
              <p className={s.kicker}>Seasonal catering &middot; Columbus, Indiana &middot; Since {WB.since}</p>
              <h1>
                Cooked for like family,
                <em>with what&rsquo;s in season.</em>
              </h1>
              <p className={s.lede}>
                Wild Bramble is a small catering studio in Columbus, cooking from-scratch menus for weddings, corporate tables and private
                gatherings of {WB.guests.min} to {WB.guests.max} guests.
              </p>
              <div className={s.cta}>
                <a className={`${s.btn} ${s.primary}`} href="#menu">
                  Build your menu
                </a>
                <a className={s.link} href={WB.links.availability} target="_blank" rel="noopener">
                  Check their dates
                </a>
              </div>
              <ul className={s.facts}>
                <li>{WB.guests.min} to {WB.guests.max} guests</li>
                <li>Cooks around Alpha-Gal, gluten and FODMAP</li>
                <li>Weekly family meal prep</li>
                <li>Tastings by appointment</li>
              </ul>
            </div>
            <Bramble />
          </div>
        </section>

        <div className={s.quoteBand}>
          <div className={s.wrap}>
            <blockquote>
              &ldquo;&hellip;{WB.quote}.&rdquo;
              <cite>Wild Bramble, on their own website</cite>
            </blockquote>
          </div>
        </div>

        {/* ---------- Services ---------- */}
        <section className={s.band} id="services">
          <div className={s.wrap}>
            <p className={s.kicker}>What they cater</p>
            <h2>
              Every table, <em>from scratch.</em>
            </h2>
            <p className={s.sub}>Menus are written fresh each season and shaped around your gathering. Tell them the date, the setting and the feeling you want, and they come back with ideas and a proposal.</p>
            <div className={s.services}>
              {SERVICES.map((v) => (
                <article key={v.title} className={s.svc}>
                  <span className={s.ic} style={{ background: v.bg }} aria-hidden="true">
                    {v.ic}
                  </span>
                  <h3>{v.title}</h3>
                  <p>{v.body}</p>
                  <ul>
                    {v.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <a className={s.link} href={WB.links.quote} target="_blank" rel="noopener">
                    {v.cta}
                  </a>
                </article>
              ))}
            </div>
            <div className={s.lead}>
              <span>
                <b>Weddings:</b> ask 4–8 months ahead when you can.
              </span>
              <span>
                <b>Private dinners:</b> often 2–4 weeks, depending on the season.
              </span>
              <span>
                <b>Service:</b> drop off, drop off and pick up, or full service with staff on site.
              </span>
            </div>
          </div>
        </section>

        {/* ---------- Menu builder ---------- */}
        <section className={`${s.band} ${s.paper}`} id="menu">
          <div className={s.wrap}>
            <p className={s.kicker}>Build your menu</p>
            <h2>
              Pick what sounds good. <em>Send it to them.</em>
            </h2>
            <p className={s.sub}>
              These are dishes from Wild Bramble&rsquo;s own menu. Tap the ones you love, add your date and guest count, and send it straight to
              their inbox. Their menu changes with the season, so they&rsquo;ll shape the final one with you.
            </p>
            <BrambleMenu />
            <p className={s.fine}>
              Prices aren&rsquo;t published; every menu gets its own proposal. See{" "}
              <a href={WB.links.fullMenu} target="_blank" rel="noopener">
                their full menu
              </a>{" "}
              for everything they make.
            </p>
          </div>
        </section>

        {/* ---------- Diet and sourcing ---------- */}
        <section className={s.band} id="kitchen">
          <div className={s.wrap}>
            <p className={s.kicker}>The kitchen</p>
            <h2>
              Cooked around <em>every need.</em>
            </h2>
            <div className={s.two}>
              <div className={s.card}>
                <h3>They cook around it</h3>
                <p style={{ color: "var(--muted)", margin: 0 }}>
                  Wild Bramble grew out of a family kitchen, run by a mother of four, and cooking around Alpha-Gal, gluten and FODMAP
                  sensitivities is part of how they cook, not an afterthought. Their quote form asks about dietary needs and allergies up
                  front, so tell them early.
                </p>
                <ul className={s.badges}>
                  {DIETS.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
              <div className={s.card}>
                <h3>Where the food comes from</h3>
                <ul className={s.points}>
                  <li>
                    <i aria-hidden="true">🌾</i>
                    <span>
                      <b>Farms within a day&rsquo;s drive</b>
                      <p>Produce, meat and dairy from local farming friends, when the season allows.</p>
                    </span>
                  </li>
                  <li>
                    <i aria-hidden="true">🌿</i>
                    <span>
                      <b>Their own 75 acres</b>
                      <p>The family hunts and forages its own land in Columbus.</p>
                    </span>
                  </li>
                  <li>
                    <i aria-hidden="true">🥐</i>
                    <span>
                      <b>Finished the morning of</b>
                      <p>Menus are tested in their studio kitchen, and pastries are finished the morning of each event.</p>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Meal prep and gift ---------- */}
        <section className={`${s.band} ${s.paper}`} id="meal-prep">
          <div className={s.wrap}>
            <p className={s.kicker}>Between the big days</p>
            <h2>
              Dinner, handled <em>every week.</em>
            </h2>
            <div className={s.mealGrid}>
              <div className={s.meal}>
                <p className={s.kicker}>Family meal prep</p>
                <h3>From-scratch dinners, ready to heat</h3>
                <ol className={s.steps}>
                  <li>Their menu posts every Thursday for the week after.</li>
                  <li>Pick your meals and how many servings.</li>
                  <li>Pick up at the studio Sunday evening, or add local delivery for a small flat fee.</li>
                </ol>
                <div className={s.prices}>
                  <div className={s.price}>
                    <b>~$580</b>
                    <span>a month, family of four, four dinners a week</span>
                  </div>
                  <div className={s.price}>
                    <b>~$290</b>
                    <span>a month, a table for two, four dinners a week</span>
                  </div>
                </div>
                <a className={`${s.btn} ${s.light}`} href={WB.links.mealPlan} target="_blank" rel="noopener">
                  Start a meal plan
                </a>
                <p className={s.fine}>Their own estimates, from about $8 a serving; real pricing changes with the menu.</p>
              </div>
              <div className={s.gift}>
                <p className={s.kicker}>Gift a meal</p>
                <h3>Feed someone who needs it</h3>
                <p>Send home-cooked meals, generous and ready to heat, delivered, left on the porch or picked up at the studio. Choose from the rotating menu or let them put together a mix.</p>
                <ul>
                  <li>New parents</li>
                  <li>Illness or grief</li>
                  <li>A hard week</li>
                  <li>Elderly neighbors</li>
                  <li>Meal trains</li>
                </ul>
                <a className={`${s.btn} ${s.primary}`} href={WB.links.gift} target="_blank" rel="noopener">
                  Send a meal
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- On a Crossroads run sheet ---------- */}
        <section className={s.band} id="your-day">
          <div className={s.wrap}>
            <p className={s.kicker}>On a Crossroads run sheet</p>
            <h2>
              Where dinner lands <em>in your day.</em>
            </h2>
            <p className={s.sub}>The DJ and the kitchen run the reception together. If Wild Bramble caters a wedding we DJ, this is how the two line up.</p>
            <div className={s.sheet}>
              <div className={s.sheetHead}>
                <b>Run sheet, with dinner</b>
                <span>Sample</span>
              </div>
              <ol className={s.rows}>
                {RUN_SHEET.map((r) => (
                  <li key={r.when}>
                    <span className={s.when}>{r.when}</span>
                    <span>
                      <b>{r.what}</b>
                      <p>{r.body}</p>
                    </span>
                  </li>
                ))}
              </ol>
              <div className={s.cta}>
                <a className={`${s.btn} ${s.primary}`} href="/book">
                  Check your date with Crossroads
                </a>
                <a className={s.link} href="/">
                  Our music, MC and bar service
                </a>
              </div>
              <p className={s.fine}>Our suggestions, from the run sheets we build for couples. What Wild Bramble cooks, and what it costs, comes from them.</p>
            </div>
          </div>
        </section>

        {/* ---------- Visit ---------- */}
        <section className={`${s.band} ${s.paper}`} id="visit">
          <div className={s.wrap}>
            <p className={s.kicker}>Studio and tastings</p>
            <h2>
              Taste it <em>first.</em>
            </h2>
            <div className={s.visit}>
              <div className={s.card}>
                <p className={s.addr}>
                  {WB.street}
                  <br />
                  {WB.cityLine}
                </p>
                <p style={{ color: "var(--muted)", margin: 0 }}>Their studio kitchen. Visits and tastings are by appointment.</p>
                <div className={s.contact}>
                  <a className={`${s.btn} ${s.primary}`} href={WB.links.quote} target="_blank" rel="noopener">
                    Book a tasting
                  </a>
                  <a className={`${s.btn} ${s.quiet}`} href={`tel:${WB.tel}`}>
                    Call {WB.phone}
                  </a>
                  <a className={`${s.btn} ${s.quiet}`} href={`mailto:${WB.email}`}>
                    Email
                  </a>
                  <a className={`${s.btn} ${s.quiet}`} href={WB.links.directions} target="_blank" rel="noopener">
                    Directions
                  </a>
                  <a className={`${s.btn} ${s.quiet}`} href={WB.instagram} target="_blank" rel="noopener">
                    Instagram
                  </a>
                </div>
              </div>
              <div className={s.map}>
                <iframe title="Map of Wild Bramble's studio at 4389 North Long Rd, Columbus, Indiana" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={WB.links.map} />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Neighbors ---------- */}
        <section className={s.band} id="neighbors">
          <div className={s.wrap}>
            <p className={s.kicker}>Plan the whole day</p>
            <h2>
              Columbus neighbors <em>for the rest.</em>
            </h2>
            <div className={s.friends}>
              <a className={s.friend} href="/partners/cookie-paradise">
                <span className={s.em} aria-hidden="true">
                  🍪
                </span>
                <h3>Cookie Paradise</h3>
                <p>A dessert table and cookie favors from the yellow trailer on 25th Street.</p>
                <small>Order online here</small>
              </a>
              <a className={s.friend} href="/partners/rabbits-balloons">
                <span className={s.em} aria-hidden="true">
                  🎈
                </span>
                <h3>Rabbit&rsquo;s Balloons</h3>
                <p>Organic balloon arches and garlands in all natural latex.</p>
                <small>Build a palette here</small>
              </a>
              <a className={s.friend} href="/">
                <span className={s.em} aria-hidden="true">
                  🎤
                </span>
                <h3>Crossroads Wedding and Event Co.</h3>
                <p>Wedding DJ and MC, live acoustic sets, bar service and the run sheet that keeps the day on time.</p>
                <small>That&rsquo;s us</small>
              </a>
            </div>
          </div>
        </section>

        <div className={s.sources}>
          <div className={s.wrap}>
            <a className={s.badge} href={WB.links.hoc} target="_blank" rel="noopener">
              Listed on Heart of Columbus
            </a>
            <p>
              Everything about Wild Bramble here comes from their own website (
              <a href={WB.origin} target="_blank" rel="noopener">
                home
              </a>
              ,{" "}
              <a href={WB.links.about} target="_blank" rel="noopener">
                about
              </a>
              ,{" "}
              <a href={WB.links.menu} target="_blank" rel="noopener">
                menu
              </a>
              ,{" "}
              <a href={WB.links.mealPrep} target="_blank" rel="noopener">
                meal prep
              </a>
              ,{" "}
              <a href={WB.links.quote} target="_blank" rel="noopener">
                contact
              </a>
              ), read November 25, 2026, and their Heart of Columbus listing. Dish names are theirs; the rest is in our words. Their
              contact page also lists {WB.otherPhone}.
            </p>
            <p>
              The bramble drawing is ours, not their work. The run sheet section is our suggestion. Menu requests sent from this page go
              straight to Wild Bramble; Crossroads never sees them. Crossroads is run by Jacob Kennedy, who also runs Heart of Columbus.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
