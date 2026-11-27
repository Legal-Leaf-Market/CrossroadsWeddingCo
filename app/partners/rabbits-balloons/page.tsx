import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import s from "@/components/partners/rabbits-balloons.module.css";
import { ColorStudio, InquiryForm, OccasionLink, RabbitStudio } from "@/components/partners/RabbitStudio";
import { CONTACT_EMAIL } from "@/lib/site";

// Rabbit's Balloons (2026-11-25, Jacob: "now do that same for rabbit's
// balloons", after the Cookie Paradise storefront). Ported from the site
// preview Heart of Columbus built for Rachael Starr
// (Legal-Leaf-Market/RabbitsBalloons, rabbits-balloons.netlify.app): the
// services, install styles, the Color Studio, how a project runs and her
// low-waste practices. She has no store, so the "order" here is the inquiry,
// made real: it saves a lead and emails the owner to pass on (her preview's
// form sends nothing). Added here: where balloons land on a Crossroads run
// sheet, and Cookie Paradise linked to its own page.
//
// Facts: Rachael Starr, the owner, in conversation with Jacob Kennedy on
// 2026-11-15, as recorded in that repo's index.html header. All natural latex
// from Sempertex; minimal plastics, reuse, least-waste breakdown; about one in
// three cheap store balloons used to pop on her, none in a Sempertex arch; not
// compostable, and the page must not say it is; corporate, weddings, showers,
// birthdays, private parties; her sister Tiffany runs Turtle's Flowers. She has
// not done a wedding yet, so weddings are offered and no wedding history is
// claimed. No phone, email, prices or photos yet. Her "Why Rabbit?" story
// waits for her OK to quote. Every picture is inspiration art cut from the
// Round Two asset pack (2026-11-15), never presented as her work.
export const revalidate = 86400;

const head = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["SOFT", "WONK", "opsz"], variable: "--rb-head", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--rb-body", display: "swap" });

const IMG = "/partners/rabbits-balloons";
const TITLE = "Rabbit's Balloons: organic balloon arches in Columbus, Indiana";
const DESCRIPTION =
  "Organic balloon arches, garlands and installs in all natural latex for weddings, showers, corporate events and private celebrations in Columbus, Indiana. Build your palette in real Sempertex colors and send an inquiry.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/partners/rabbits-balloons" },
  openGraph: {
    url: "/partners/rabbits-balloons",
    title: "Rabbit's Balloons: otherworldly, on schedule",
    description: DESCRIPTION,
    images: [{ url: `${IMG}/arch.webp`, width: 639, height: 533, alt: "Inspiration art: an organic pastel balloon arch" }],
  },
};

const SERVICES = [
  {
    occasion: "Wedding",
    bg: "var(--blush)",
    dot: "#e98ea3",
    forColor: "#b4506a",
    for: "For the big day",
    title: "Weddings and showers",
    body: "Ceremony arches, reception backdrops, bridal and baby showers. Soft, organic shapes that photograph beautifully and sit happily beside your florist's work.",
    points: ["Ceremony and photo backdrops", "Bridal and baby showers", "Palettes built around your flowers"],
    cta: "Plan a wedding or shower",
    img: { src: "col-floral.webp", w: 168, h: 512, alt: "Inspiration art: a balloon column woven with pink and ivory flowers" },
  },
  {
    occasion: "Corporate event",
    bg: "var(--sky)",
    dot: "#2f4d8c",
    forColor: "#2f4d8c",
    for: "For the brand",
    title: "Corporate events",
    body: "Your company colors, matched as closely as the latex allows. Grand openings, product launches, conferences, open houses, holiday parties and employee appreciation days.",
    points: ["Brand color matching", "Installed before doors open", "A vendor your sustainability team will like"],
    cta: "Plan a corporate event",
    img: { src: "bq-navy.webp", w: 256, h: 457, alt: "Inspiration art: a balloon bouquet in navy, sky blue, butter yellow, peach and sage" },
  },
  {
    occasion: "Birthday or private party",
    bg: "var(--butter)",
    dot: "#e9b53f",
    forColor: "#8a5e0c",
    for: "For the party",
    title: "Private celebrations",
    body: "Birthdays, milestones and the backyard party that deserves more than a grocery store bunch. Big and tiny balloons, mixed so it feels like a little world.",
    points: ["Birthdays and milestones", "Garlands, arches and columns", "Whimsy, dialed all the way up"],
    cta: "Plan a party",
    img: { src: "cl-peach.webp", w: 420, h: 352, alt: "Inspiration art: a full balloon cluster in peach, pink, ivory and sage", max: 196 },
  },
];

const STYLES = [
  { wide: true, title: "Organic arch", body: "The walk-through moment. Big and tiny balloons packed into one flowing shape for a ceremony, an entrance or a stage.", imgs: [{ src: "arch-sage.webp", w: 536, h: 456, alt: "Inspiration art: an organic balloon arch in sage, sky blue, butter yellow and ivory" }] },
  { title: "Asymmetric arch", body: "One side climbs, one side trails off. Modern and great for photo walls.", imgs: [{ src: "arch-half.webp", w: 486, h: 547, alt: "Inspiration art: an asymmetric half arch of pastel balloons", max: 250 }] },
  {
    title: "Columns",
    body: "Frame a doorway, a stage or a welcome table. Easy to match to brand colors.",
    imgs: [
      { src: "col-pastel.webp", w: 178, h: 519, alt: "Inspiration art: a tall pastel balloon column", max: 270 },
      { src: "col-cluster.webp", w: 364, h: 466, alt: "Inspiration art: a sculpted balloon column topper", max: 200 },
    ],
  },
  { title: "Garlands", body: "Over a doorway, along a dessert table or down a staircase. Priced by the foot.", imgs: [{ src: "garland.webp", w: 465, h: 463, alt: "Inspiration art: a balloon garland spilling down at an angle", max: 250 }] },
  { title: "Bouquets and clusters", body: "Table centerpieces, surprise deliveries and small rooms that still want a moment.", imgs: [{ src: "bq-teal.webp", w: 255, h: 453, alt: "Inspiration art: a floating balloon bouquet in mint, navy, lilac, blush and sky blue" }] },
];

const STEPS = [
  { img: "b-pink.webp", n: "Step one", title: "Tell her the vibe", body: "Date, venue, colors and the feeling you want people to walk into. A photo, a mood board or three words all work." },
  { img: "b-yellow.webp", n: "Step two", title: "Get a design and a quote", body: "A sketch of the install and a clear price before a single balloon is ordered." },
  { img: "b-blue.webp", n: "Step three", title: "Setup, on time", body: "Installed and finished before your guests (or your CEO) arrive." },
  { img: "b-green.webp", n: "Step four", title: "Breakdown, low waste", body: "When it is over, it comes down. Everything that can be reused is reused, and the rest goes out the least wasteful way possible." },
];

const RUN_SHEET = [
  { when: "Load in", what: "Balloons go up first", body: "Rachael's setup window goes on the run sheet beside ours, so the arch and the sound check never fight over the room." },
  { when: "Ceremony", what: "The arch is the backdrop", body: "For the vows, and for every family photo after." },
  { when: "Grand entrance", what: "A photo wall or columns", body: "Right where the MC brings the wedding party in, so the entrance photos have a frame." },
  { when: "Dessert table", what: "A garland over the sweets", body: "Pair it with a Cookie Paradise dessert table, and the MC calls it when it opens." },
  { when: "Last song", what: "It all comes down, low waste", body: "Breakdown is on her timeline, and what can be reused goes again." },
];

export default function RabbitsBalloonsPage() {
  return (
    <>
      <Header />
      <main className={`${head.variable} ${body.variable} ${s.rb}`}>
        <RabbitStudio>
          {/* ---------- Hero ---------- */}
          <section className={s.hero}>
            <div className={`${s.wrap} ${s.heroGrid}`}>
              <div>
                <p className={s.crumbs}>
                  <a href="/partners">Crossroads partners</a>
                </p>
                <p className={s.kicker}>Balloon installs &middot; Columbus, Indiana</p>
                <h1>
                  Otherworldly,
                  <br />
                  <em>on schedule.</em>
                </h1>
                <p className={s.lede}>
                  Organic balloon arches, garlands and statement installs in all natural latex, for weddings, showers, corporate events
                  and private celebrations.
                </p>
                <div className={s.cta}>
                  <a className={`${s.btn} ${s.primary}`} href="#start">
                    Start your inquiry
                  </a>
                  <a className={s.link} href="#studio">
                    Play with colors first
                  </a>
                </div>
              </div>
              <div className={s.stage}>
                <div className={s.disc} aria-hidden="true" />
                <div className={s.floor} aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={s.arch}
                  src={`${IMG}/arch.webp`}
                  width={639}
                  height={533}
                  alt="Inspiration art: an organic pastel balloon arch in blush, peach, sage, sky blue, lilac and ivory"
                  fetchPriority="high"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={`${s.float} ${s.f1} ${s.bob}`} src={`${IMG}/b-pink.webp`} width={220} height={269} alt="" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={`${s.float} ${s.f2} ${s.bob} ${s.d2}`} src={`${IMG}/b-blue.webp`} width={200} height={264} alt="" aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={`${s.float} ${s.f3} ${s.bob} ${s.d3}`} src={`${IMG}/b-yellow.webp`} width={200} height={262} alt="" aria-hidden="true" />
                <span className={`${s.tag} ${s.ins} ${s.stageTag}`}>Inspiration art</span>
              </div>
            </div>
          </section>

          <div className={s.proof}>
            <ul>
              <li>
                <i style={{ background: "#e98ea3" }} />
                All natural latex from Sempertex
              </li>
              <li>
                <i style={{ background: "#2f4d8c" }} />
                Brand colors matched for corporate events
              </li>
              <li>
                <i style={{ background: "#8fb08a" }} />
                Set up, broken down, minimal waste
              </li>
            </ul>
          </div>

          {/* ---------- Services ---------- */}
          <section className={s.band} id="services">
            <div className={s.wrap}>
              <p className={s.kicker}>What she makes it for</p>
              <h2>
                Pick your <em>rabbit hole.</em>
              </h2>
              <p className={s.sub}>Every install is designed for the room, the crowd and the colors. Start with the kind of day you are planning.</p>
              <div className={s.services}>
                {SERVICES.map((v) => (
                  <article key={v.title} className={s.svc} style={{ "--dot": v.dot } as React.CSSProperties}>
                    <div className={s.pic} style={{ background: v.bg }}>
                      <span className={`${s.tag} ${s.ins}`}>Inspiration art</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${IMG}/${v.img.src}`} width={v.img.w} height={v.img.h} alt={v.img.alt} loading="lazy" style={v.img.max ? { maxHeight: v.img.max } : undefined} />
                    </div>
                    <div className={s.svcBody}>
                      <p className={s.for} style={{ color: v.forColor }}>
                        {v.for}
                      </p>
                      <h3>{v.title}</h3>
                      <p>{v.body}</p>
                      <ul>
                        {v.points.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                      <OccasionLink occasion={v.occasion}>{v.cta}</OccasionLink>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- Styles ---------- */}
          <section className={`${s.band} ${s.paper}`} id="styles">
            <div className={s.wrap}>
              <p className={s.kicker}>Install styles</p>
              <h2>
                Shapes to <em>dream in.</em>
              </h2>
              <p className={s.sub}>A quick guide to what you can ask for. These pictures are inspiration art to show each style, not finished Rabbit&rsquo;s Balloons installs.</p>
              <div className={s.gal}>
                {STYLES.map((g) => (
                  <figure key={g.title} className={g.wide ? s.wide : undefined}>
                    <div className={s.frame}>
                      <span className={`${s.tag} ${s.ins}`}>Inspiration art</span>
                      {g.imgs.map((im) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={im.src} src={`${IMG}/${im.src}`} width={im.w} height={im.h} alt={im.alt} loading="lazy" style={"max" in im && im.max ? { maxHeight: im.max } : undefined} />
                      ))}
                    </div>
                    <figcaption>
                      <b>{g.title}</b>
                      <span>{g.body}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <p className={s.fine}>
                <span className={s.tag}>Sample</span> Rachael&rsquo;s own install photos replace these as soon as she sends them.
              </p>
            </div>
          </section>

          {/* ---------- Color Studio ---------- */}
          <section className={s.band} id="studio">
            <div className={s.wrap}>
              <p className={s.kicker}>Color Studio</p>
              <h2>
                Build your palette <em>in real balloon colors.</em>
              </h2>
              <p className={s.sub}>
                Every color here is a Sempertex latex color by its real name. Start from a curated palette, add your own, or match any
                color (like your logo) to the closest balloon. Your palette rides along with your inquiry.
              </p>
              <ColorStudio />
              <p className={s.fine}>
                Colors on screen are approximate and every screen shows them a little differently. Rachael confirms the real balloon
                colors with you before anything is ordered. The preview is for inspiration, not a picture of the final install.
              </p>
            </div>
          </section>

          {/* ---------- Process ---------- */}
          <section className={`${s.band} ${s.how}`} id="how">
            <div className={s.wrap}>
              <p className={s.kicker}>Whimsy with a work ethic</p>
              <h2>How a project runs.</h2>
              <p className={s.sub}>The look is otherworldly. The process is not. You know what you are getting, what it costs and when it shows up.</p>
              <ol className={s.steps}>
                {STEPS.map((st) => (
                  <li key={st.title} className={s.step}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${IMG}/${st.img}`} width={200} height={264} alt="" loading="lazy" />
                    <small>{st.n}</small>
                    <h3>{st.title}</h3>
                    <p>{st.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ---------- Green ---------- */}
          <section className={`${s.band} ${s.green}`} id="green">
            <div className={`${s.wrap} ${s.greenGrid}`}>
              <div>
                <p className={s.kicker}>Green to a fault</p>
                <h2>
                  Not lean. Not mean. <em>Actually green.</em>
                </h2>
                <p className={s.sub}>
                  Every few years the corporate world finds a new word for cutting costs. This is not that. Before building a single arch,
                  Rachael researched which balloons are best for the environment, and she keeps looking for ways to waste less.
                </p>
                <div className={s.leaves}>
                  <div className={s.leaf}>
                    <h3>All natural latex</h3>
                    <p>Premium natural latex balloons from Sempertex, not the bargain bin kind.</p>
                  </div>
                  <div className={s.leaf}>
                    <h3>Minimal plastics</h3>
                    <p>Far less plastic than the average party store balloon, and the plastic there is gets salvaged.</p>
                  </div>
                  <div className={s.leaf}>
                    <h3>Reuse everything</h3>
                    <p>If a piece can go again, it goes again.</p>
                  </div>
                  <div className={s.leaf}>
                    <h3>Least waste breakdown</h3>
                    <p>When the party is over, it all comes down and goes out the best way possible.</p>
                  </div>
                </div>
                <div className={s.pop}>
                  <div className={s.big}>1 in 3</div>
                  <p>
                    That is how many cheap store balloons used to pop on Rachael while she built. With Sempertex she can build a whole arch
                    without losing one. Fewer pops means less waste and a cleaner install.
                  </p>
                </div>
                <p className={s.honest}>Straight talk: natural latex is not the same as compostable, and she will not pretend it is. It is a long way past the average consumer balloon.</p>
              </div>
              <div className={s.botanic} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/eucalyptus.webp`} width={198} height={347} alt="" loading="lazy" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/branch.webp`} width={208} height={324} alt="" loading="lazy" />
              </div>
            </div>
          </section>

          {/* ---------- On a Crossroads run sheet ---------- */}
          <section className={s.band} id="your-day">
            <div className={s.wrap}>
              <p className={s.kicker}>On a Crossroads run sheet</p>
              <h2>
                Where balloons land <em>in your day.</em>
              </h2>
              <p className={s.sub}>
                We build the run sheet for every wedding we DJ. When Rabbit&rsquo;s Balloons is on the team, this is where she shows up on it.
              </p>
              <div className={s.sheet}>
                <div className={s.sheetHead}>
                  <b>Run sheet, with balloons</b>
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
                <p className={s.fine}>Our suggestions, from the run sheets we build for couples. What Rachael makes, and what it costs, comes from her.</p>
              </div>
            </div>
          </section>

          {/* ---------- Neighbors ---------- */}
          <section className={`${s.band} ${s.paper}`} id="neighbors">
            <div className={s.wrap}>
              <p className={s.kicker}>Plan the whole day</p>
              <h2>
                Columbus neighbors <em>for the rest.</em>
              </h2>
              <p className={s.sub}>Balloons are one piece. These local businesses cover the flowers, the dessert table and the sound.</p>
              <div className={s.friends}>
                <a className={s.friend} href="https://www.turtlesflowers.com/" target="_blank" rel="noopener">
                  <span className={s.em} aria-hidden="true">
                    🌷
                  </span>
                  <h3>Turtle&rsquo;s Flowers</h3>
                  <p>High end floral design for weddings, events and every day. Run by Rachael&rsquo;s sister, Tiffany.</p>
                  <small>turtlesflowers.com</small>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={s.critter} src={`${IMG}/turtle.webp`} width={367} height={255} alt="" aria-hidden="true" loading="lazy" />
                </a>
                <a className={s.friend} href="/partners/cookie-paradise">
                  <span className={s.em} aria-hidden="true">
                    🍪
                  </span>
                  <h3>Cookie Paradise</h3>
                  <p>Dessert tables and cookie favors, and the yellow cookie trailer at outdoor parties. Order their cookies right on our site.</p>
                  <small>Order online here</small>
                </a>
                <a className={s.friend} href="/">
                  <span className={s.em} aria-hidden="true">
                    🎤
                  </span>
                  <h3>Crossroads Wedding and Event Co.</h3>
                  <p>Wedding DJ and MC, live acoustic sets, bar service and the run sheet that keeps the day on time.</p>
                  <small>That&rsquo;s us.</small>
                </a>
              </div>
            </div>
          </section>

          {/* ---------- Inquiry ---------- */}
          <section className={s.band} id="start">
            <div className={`${s.wrap} ${s.startGrid}`}>
              <div>
                <p className={s.kicker}>Start your inquiry</p>
                <h2>
                  Let&rsquo;s go <em>down the rabbit hole.</em>
                </h2>
                <p className={s.sub} style={{ marginBottom: 24 }}>
                  A few details are all it takes. Nothing needs to be final.
                </p>
                <ul className={s.bring}>
                  <li style={{ "--c": "#e98ea3" } as React.CSSProperties}>
                    <b>Date and venue</b>
                    <span>Or just the town, if the venue is not set.</span>
                  </li>
                  <li style={{ "--c": "#f2c14e" } as React.CSSProperties}>
                    <b>Where it goes and how big</b>
                    <span>Doorway, stage, photo wall. Rough feet is plenty.</span>
                  </li>
                  <li style={{ "--c": "#8cc3ea" } as React.CSSProperties}>
                    <b>Your colors</b>
                    <span>Your Color Studio palette fills in by itself.</span>
                  </li>
                  <li style={{ "--c": "#9cbf98" } as React.CSSProperties}>
                    <b>Indoors or out</b>
                    <span>Heat, sun and wind change what holds up.</span>
                  </li>
                </ul>
                <p className={s.next}>
                  <b>What happens next:</b> we pass it straight to Rachael, and she replies with ideas, a design sketch and a quote before a
                  single balloon is ordered.
                </p>
              </div>
              <InquiryForm fallbackEmail={CONTACT_EMAIL} rabbitSrc={`${IMG}/rabbit.webp`} />
            </div>
          </section>

          <div className={s.sources}>
            <div className={s.wrap}>
              <a className={s.badge} href="https://heartofcolumbus.shop/b/rabbits-balloons/" target="_blank" rel="noopener">
                <span>★</span> Founding Member on Heart of Columbus
              </a>
              <p>
                Everything about Rabbit&rsquo;s Balloons on this page comes from its owner, Rachael Starr (November 15, 2026). She has no
                public website, phone or prices yet, so inquiries come to Crossroads and we pass them to her. The Sempertex color names
                come from Sempertex&rsquo;s published color charts; the screen colors are our approximations.
              </p>
              <p>
                Every picture here is inspiration art, not a photo of her work. The run sheet section is our suggestion. Crossroads is run
                by Jacob Kennedy, who also runs Heart of Columbus, which built Rabbit&rsquo;s Balloons&rsquo; preview website.
              </p>
            </div>
          </div>
        </RabbitStudio>
      </main>
      <Footer />
    </>
  );
}
