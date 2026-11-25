import type { Metadata } from "next";
import { Josefin_Sans, Nunito } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import s from "@/components/partners/cookie-paradise.module.css";
import { CookieShop, GiftBoxes, HoursTable, MenuGrid, OpenStatus, OrderButton, Planner, Seasonal } from "@/components/partners/CookieShop";
import { COOKIE_PARADISE as CP } from "@/lib/cookie-paradise";
import { getShopifyCatalog } from "@/lib/partner-menu";
import { PARTNERS } from "@/lib/partners";

// Cookie Paradise, orderable from this site (2026-11-25, Jacob: "build up on
// Heart of Columbus, how we did cookie paradise on there, and try to replicate
// as much as you can here ... make their page orderable ... really make it
// sing"). Replicates the draft website Heart of Columbus built for them
// (sites/cookie-paradise/ in that repo): their live menu with photos, a cart
// handed to THEIR Shopify checkout, pickup, delivery and shipping as they
// state them, weddings, corporate catering, their story, the trailer's hours
// and map. Added here: the dessert table planner, where cookies fit on a
// Crossroads run sheet, and the holiday boxes as their store lists them.
// Facts: lib/cookie-paradise.ts (sourced and dated). Menu: read live.
// Their store is re-read every 15 minutes; the cart asks again at checkout.
export const revalidate = 900;

const head = Josefin_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--cp-head", display: "swap" });
const body = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--cp-body", display: "swap" });

const TITLE = "Order Cookie Paradise cookies online, Columbus, Indiana";
const DESCRIPTION =
  "Handmade cookies from the yellow Cookie Paradise trailer on 25th Street in Columbus, Indiana. Order here for trailer pickup, Columbus delivery or Indiana shipping, and plan a wedding dessert table.";

export async function generateMetadata(): Promise<Metadata> {
  const items = await getShopifyCatalog(CP.origin);
  const image = items[0]?.image;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/partners/cookie-paradise" },
    openGraph: {
      url: "/partners/cookie-paradise",
      title: "Cookie Paradise: order handmade cookies from the yellow trailer",
      description: DESCRIPTION,
      ...(image ? { images: [{ url: image.replace(/width=\d+/, "width=1200"), alt: "Cookies from Cookie Paradise" }] } : {}),
    },
  };
}

function Trailer() {
  return (
    <figure className={s.art}>
      <svg viewBox="0 0 520 380" role="img" aria-label="Illustration of a yellow cookie trailer with a giant cookie sign">
        <ellipse cx="260" cy="352" rx="220" ry="16" fill="#593412" opacity=".18" />
        <g className={s.bob}>
          <circle cx="330" cy="70" r="54" fill="#D9973F" stroke="#593412" strokeWidth="6" />
          <circle cx="310" cy="52" r="7" fill="#593412" />
          <circle cx="345" cy="46" r="6" fill="#593412" />
          <circle cx="352" cy="82" r="8" fill="#593412" />
          <circle cx="314" cy="92" r="6" fill="#593412" />
          <circle cx="332" cy="70" r="4" fill="#593412" />
          <rect x="324" y="122" width="12" height="26" fill="#593412" />
        </g>
        <rect x="60" y="146" width="380" height="180" rx="56" fill="#F7C948" stroke="#593412" strokeWidth="6" />
        <rect x="60" y="270" width="380" height="18" fill="#fff" opacity=".55" />
        <rect x="160" y="178" width="190" height="78" rx="12" fill="#FFF8EC" stroke="#593412" strokeWidth="5" />
        <path
          d="M150 174 h210 v22 q-13 12 -26 0 q-13 12 -26 0 q-13 12 -26 0 q-13 12 -26 0 q-13 12 -26 0 q-13 12 -26 0 q-13 12 -26 0 q-14 12 -28 0z"
          fill="#C2410C"
          stroke="#593412"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M176 174 v22 M228 174 v22 M280 174 v22 M332 174 v22" stroke="#fff" strokeWidth="10" opacity=".85" />
        <circle cx="200" cy="232" r="16" fill="#D9973F" stroke="#593412" strokeWidth="3" />
        <circle cx="196" cy="228" r="3" fill="#593412" />
        <circle cx="205" cy="236" r="3" fill="#593412" />
        <circle cx="244" cy="236" r="16" fill="#D9973F" stroke="#593412" strokeWidth="3" />
        <circle cx="240" cy="232" r="3" fill="#593412" />
        <circle cx="249" cy="240" r="3" fill="#593412" />
        <circle cx="288" cy="232" r="16" fill="#7a4a1f" stroke="#593412" strokeWidth="3" />
        <circle cx="284" cy="228" r="3" fill="#FFF8EC" />
        <circle cx="293" cy="236" r="3" fill="#FFF8EC" />
        <g className={s.steam} stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M200 210 q-6 -10 0 -18" />
          <path d="M244 212 q6 -10 0 -18" />
          <path d="M288 210 q-6 -10 0 -18" />
        </g>
        <rect x="160" y="256" width="190" height="14" rx="4" fill="#593412" />
        <rect x="378" y="190" width="40" height="110" rx="10" fill="#FFF8EC" stroke="#593412" strokeWidth="5" />
        <circle cx="408" cy="248" r="4" fill="#593412" />
        <rect x="96" y="194" width="40" height="40" rx="20" fill="#FFF8EC" stroke="#593412" strokeWidth="5" />
        <path d="M60 300 h-34 l-10 14" stroke="#593412" strokeWidth="7" strokeLinecap="round" fill="none" />
        <circle cx="170" cy="330" r="26" fill="#3f230b" />
        <circle cx="170" cy="330" r="10" fill="#F6B452" />
        <circle cx="330" cy="330" r="26" fill="#3f230b" />
        <circle cx="330" cy="330" r="10" fill="#F6B452" />
      </svg>
      <figcaption>Illustration</figcaption>
    </figure>
  );
}

const ICONS: Record<string, string> = {
  Facebook: "M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z",
  TikTok: "M16 3c.3 2.2 1.7 3.8 4 4v3.2c-1.5 0-2.8-.4-4-1.2v6.3A5.7 5.7 0 1 1 10.3 9.6v3.3a2.5 2.5 0 1 0 2.5 2.5V3z",
};

function SocialIcon({ label }: { label: string }) {
  if (label === "Instagram")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.3" fill="currentColor" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={ICONS[label] || ""} />
    </svg>
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How soon is my order ready?",
    a: "Cookie Paradise fulfills orders on the next business day its shop is open. These are their posted hours; holiday hours can differ, so call before a holiday run.",
  },
  {
    q: "Do they deliver or ship?",
    a: "Both. Delivery goes anywhere in Columbus, Indiana, and the delivery total shows at their checkout. Shipping goes to Indiana addresses only.",
  },
  {
    q: "Who am I paying?",
    a: "Cookie Paradise, directly, on their own store at cookieparadise.co. Your order here is handed to their checkout. Crossroads never takes the order or the payment.",
  },
  {
    q: "What if something sold out?",
    a: "The menu here shows only what is in stock and pictured, read from their store every 15 minutes. When you check out we ask their store again, and anything that sold out in between comes out of your order before their checkout opens.",
  },
  {
    q: "We need a lot of cookies for a wedding, shower or office party.",
    a: (
      <>
        Send your date and details through their{" "}
        <a href={CP.links.weddings} target="_blank" rel="noopener">
          weddings and private parties form
        </a>{" "}
        and they follow up about flavors, pricing and availability. Special and bulk orders also go by phone at{" "}
        <a href={`tel:${CP.tel}`}>{CP.phone}</a>, email or a Facebook message.
      </>
    ),
  },
  {
    q: "Can the yellow trailer come to our party?",
    a: "Ask them. Their weddings page invites you to ask whether the cookie trailer can come to your venue for an outdoor celebration.",
  },
  {
    q: "Where are the ingredients?",
    a: "On each cookie's own page on their store. Tap a cookie's name to open it.",
  },
];

const DAY: { when: string; what: string; body: string }[] = [
  {
    when: "Cocktail hour",
    what: "The trailer, outside",
    body: "If Cookie Paradise can bring the yellow trailer to your venue, it is a cocktail hour people talk about. Ask them when you request a quote.",
  },
  {
    when: "After the cake",
    what: "The dessert table opens",
    body: "Your MC calls it from the mic, so the grandparents hear it and nobody misses it. It goes on your run sheet with a time.",
  },
  {
    when: "Late night",
    what: "A second round",
    body: "Hold a few boxes back and set them out when the dance floor is full. It keeps people in the room.",
  },
  {
    when: "The send off",
    what: "Favors at the door",
    body: "Ask Cookie Paradise about individually packaged cookies for place settings or welcome bags.",
  },
];

export default async function CookieParadisePage() {
  const items = await getShopifyCatalog(CP.origin);
  const others = PARTNERS.filter((p) => p.slug !== CP.slug);
  const renderedAt = new Date().toISOString();
  return (
    <>
      <Header />
      <main className={`${head.variable} ${body.variable} ${s.cp}`}>
        <CookieShop items={items} origin={CP.origin} notes={CP.itemNotes} renderedAt={renderedAt}>
          {/* ---------- Hero ---------- */}
          <section className={s.hero}>
            <div className={`${s.wrap} ${s.heroGrid}`}>
              <div>
                <p className={s.crumbs}>
                  <a href="/partners">Crossroads partners</a>
                </p>
                <p className={s.award}>
                  <span aria-hidden="true">🏆</span> {CP.award}
                </p>
                <h1>
                  Fresh cookies from the <span>yellow trailer.</span>
                </h1>
                <p className={s.lede}>
                  Handmade by the L&ecirc; family in Columbus. Build your box right here, check out on Cookie Paradise&rsquo;s own
                  store, and grab it at the window on 25th Street, have it delivered in Columbus, or shipped across Indiana.
                </p>
                <OpenStatus hours={CP.hours} fallback="Tuesday to Saturday, from 10 AM" />
                <div className={s.cta}>
                  <a className={s.btn} href="#order">
                    Order cookies
                  </a>
                  <a className={`${s.btn} ${s.ghost}`} href="#weddings">
                    Cookies for your wedding
                  </a>
                </div>
                <div className={s.ways}>
                  <span>Trailer pickup</span>
                  <span>Columbus delivery</span>
                  <span>Indiana shipping</span>
                  <span>Dessert tables</span>
                </div>
              </div>
              <Trailer />
            </div>
          </section>

          {/* ---------- Seasonal ---------- */}
          <div className={s.wrap}>
            <Seasonal thanksgiving={{ ...CP.thanksgiving, href: CP.links.thanksgiving }} />
          </div>

          {/* ---------- Order ---------- */}
          <section className={s.band} id="order">
            <div className={s.wrap}>
              <div className={s.menuHead}>
                <div>
                  <p className={s.kicker}>The cookie menu, live</p>
                  <h2>Order your favorites</h2>
                  <p className={s.sub}>
                    Straight from the Cookie Paradise store, so prices and what&rsquo;s in stock are always current. Mix and match,
                    then check out with them.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
                  <OrderButton />
                  <a className={`${s.btn} ${s.ghost} ${s.sm}`} href={CP.links.shop} target="_blank" rel="noopener">
                    Their full store
                  </a>
                </div>
              </div>
              <MenuGrid shopUrl={CP.links.shop} />
              <p className={s.fine} style={{ marginTop: 18 }}>
                Ingredients and details are on each cookie&rsquo;s page on their store. Tap a name to see them. Only cookies in
                stock and pictured show here.
              </p>
            </div>
          </section>

          {/* ---------- How it works ---------- */}
          <section className={`${s.band} ${s.pickup}`} id="how">
            <div className={s.wrap}>
              <p className={s.kicker}>Order ahead</p>
              <h2>Skip the line at the window</h2>
              <p className={s.sub}>Orders are ready the next day the trailer is open.</p>
              <ol className={s.steps}>
                <li>
                  <b>Pick your cookies</b>Add what you love from the menu above. Build a box or grab a single.
                </li>
                <li>
                  <b>Check out with them</b>Your order opens on the Cookie Paradise store. Pick trailer pickup, delivery or shipping,
                  and pay them directly.
                </li>
                <li>
                  <b>Show up hungry</b>Head to the yellow trailer in the Holiday Center parking lot and say your name at the window.
                </li>
              </ol>
              <div className={s.three}>
                {CP.ways.map((w) => (
                  <div key={w.title}>
                    <b>{w.title}</b>
                    <p>{w.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- Weddings ---------- */}
          <section className={s.band} id="weddings">
            <div className={s.wrap}>
              <p className={s.kicker}>Weddings, showers and parties</p>
              <h2>A sweet finish to your celebration</h2>
              <p className={s.sub}>
                Cookie Paradise asked us to share their wedding page, and we&rsquo;re glad to. Here is what they offer, and a planner
                to size your dessert table before you ask.
              </p>
              <div className={s.split}>
                <div>
                  <div className={s.opts}>
                    <div className={s.opt}>
                      <span className={s.ic} aria-hidden="true">
                        🍪
                      </span>
                      <span>
                        <b>Dessert tables</b>
                        <p>A mix of cookies set out for guests at a reception, rehearsal dinner, birthday or shower.</p>
                      </span>
                    </div>
                    <div className={s.opt}>
                      <span className={s.ic} aria-hidden="true">
                        🎁
                      </span>
                      <span>
                        <b>Cookie favors</b>
                        <p>Send guests home with a sweet thank you. Ask about individually packaged cookies for place settings or welcome bags.</p>
                      </span>
                    </div>
                    <div className={s.opt}>
                      <span className={s.ic} aria-hidden="true">
                        🚚
                      </span>
                      <span>
                        <b>The trailer at your party</b>
                        <p>Ask whether the yellow cookie trailer can come to your venue for an outdoor celebration.</p>
                      </span>
                    </div>
                    <div className={s.opt}>
                      <span className={s.ic} aria-hidden="true">
                        ✉️
                      </span>
                      <span>
                        <b>Send them your date</b>
                        <p>Their form takes your date and details, and they follow up about flavors, pricing and availability.</p>
                      </span>
                    </div>
                  </div>
                  <a className={s.btn} href={CP.links.weddings} target="_blank" rel="noopener">
                    Request a wedding or party quote
                  </a>
                </div>
                <Planner quoteUrl={CP.links.weddings} />
              </div>

              <div className={s.day}>
                <p className={s.kicker}>On a Crossroads run sheet</p>
                <h3 style={{ fontSize: 28 }}>Where cookies land in your day</h3>
                <ol className={s.timeline}>
                  {DAY.map((d) => (
                    <li key={d.when}>
                      <span className={s.when}>{d.when}</span>
                      <span>
                        <b>{d.what}</b>
                        <p>{d.body}</p>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className={s.cta}>
                  <a className={s.btn} href="/book">
                    Check your date with Crossroads
                  </a>
                  <a className={`${s.btn} ${s.ghost}`} href="/">
                    Our music, MC and bar service
                  </a>
                </div>
                <p className={s.fine} style={{ margin: "14px 0 0" }}>
                  Our suggestions, from the run sheets we build for couples. What Cookie Paradise offers, and what it costs, comes
                  from Cookie Paradise.
                </p>
              </div>
            </div>
          </section>

          {/* ---------- Corporate ---------- */}
          <section className={s.band} id="corporate" style={{ paddingTop: 0 }}>
            <div className={s.wrap}>
              <div className={s.cater}>
                <div>
                  <p className={s.kicker}>The office and the holidays</p>
                  <span className={s.badge}>{CP.award}</span>
                  <h2>Corporate cookie catering</h2>
                  <p>
                    Team meetings, employee appreciation, client celebrations. Family owned in Columbus, and they&rsquo;ve catered
                    for:
                  </p>
                  <ul className={s.catered}>
                    {CP.catered.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <div className={s.cta} style={{ marginTop: 20 }}>
                    <a className={`${s.btn} ${s.light} ${s.sm}`} href={CP.links.corporate} target="_blank" rel="noopener">
                      Plan the cookie part
                    </a>
                    <a className={`${s.btn} ${s.honeyBtn} ${s.sm}`} href={`tel:${CP.tel}`}>
                      Call {CP.phone}
                    </a>
                  </div>
                </div>
                <div>
                  <h3>Thank-you boxes, ordered right here</h3>
                  <GiftBoxes />
                  <p className={s.fine}>
                    Booking a holiday party with us? <a href="/events">Crossroads does the DJ and sound</a>, and a cookie table
                    from the trailer makes the night.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ---------- Story ---------- */}
          <section className={`${s.band} ${s.story}`} id="story">
            <div className={s.wrap}>
              <p className={s.kicker} style={{ color: "var(--cocoa2)" }}>
                Their story, in their words
              </p>
              <blockquote>
                {CP.story.map((line) => (
                  <p key={line}>&ldquo;{line}&rdquo;</p>
                ))}
                <cite>
                  {CP.storyBy},{" "}
                  <a href={CP.links.about} target="_blank" rel="noopener">
                    from their About page
                  </a>
                </cite>
              </blockquote>
            </div>
          </section>

          {/* ---------- Visit ---------- */}
          <section className={s.band} id="visit">
            <div className={s.wrap}>
              <p className={s.kicker}>Find the trailer</p>
              <h2>Come say hi on 25th Street</h2>
              <div className={s.visitSplit}>
                <div className={s.card}>
                  <p className={s.addr}>
                    {CP.street}
                    <br />
                    {CP.cityLine}
                  </p>
                  <p className={s.fine} style={{ margin: 0 }}>
                    {CP.where}.
                  </p>
                  <HoursTable hours={CP.hours} />
                  <div className={s.contact}>
                    <a className={`${s.btn} ${s.sm}`} href={CP.links.directions} target="_blank" rel="noopener">
                      Directions
                    </a>
                    <a className={`${s.btn} ${s.ghost} ${s.sm}`} href={`tel:${CP.tel}`}>
                      Call {CP.phone}
                    </a>
                    <a className={`${s.btn} ${s.ghost} ${s.sm}`} href={`mailto:${CP.email}`}>
                      Email
                    </a>
                  </div>
                  <p className={s.fine} style={{ marginTop: 14 }}>
                    Special or bulk orders: call, email or message them on Facebook.
                  </p>
                  <div className={s.social}>
                    {CP.socials.map((x) => (
                      <a key={x.label} href={x.href} target="_blank" rel="noopener" aria-label={`Cookie Paradise on ${x.label}`}>
                        <SocialIcon label={x.label} />
                      </a>
                    ))}
                  </div>
                </div>
                <div className={s.map}>
                  <iframe
                    title="Map of Cookie Paradise at 3950 25th St, Columbus, Indiana"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={CP.links.map}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ---------- FAQ ---------- */}
          <section className={s.band} id="faq" style={{ paddingTop: 0 }}>
            <div className={s.wrap}>
              <p className={s.kicker}>Good to know</p>
              <h2>Questions, answered</h2>
              <div className={s.faq}>
                {FAQ.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- Crossroads ---------- */}
          <section className={s.band} style={{ paddingTop: 0 }}>
            <div className={s.wrap}>
              <div className={s.xpromo}>
                <span className={s.rings} aria-hidden="true">
                  💍
                </span>
                <div>
                  <h3>Planning the whole day?</h3>
                  <p>
                    Crossroads Wedding and Event Co. does the music, the mic and the bar, and we put the dessert table on your run
                    sheet. For the rest:{" "}
                    {others.map((o, i) => (
                      <span key={o.slug}>
                        {i > 0 && ", "}
                        <a href={`/partners/${o.slug}`}>{o.name}</a>
                      </span>
                    ))}
                    .
                  </p>
                </div>
                <a className={`${s.btn} ${s.ghost} ${s.sm}`} href="/book">
                  Check your date
                </a>
              </div>
            </div>
          </section>

          <div className={s.sources}>
            <div className={s.wrap}>
              <a className={s.member} href="https://heartofcolumbus.netlify.app/b/cookie-paradise-llc/" target="_blank" rel="noopener">
                <span>★</span> Founding Member #1 on Heart of Columbus
              </a>
              <p>
                Address, hours, delivery and shipping, wedding and catering services, the award and the family&rsquo;s story come
                from Cookie Paradise&rsquo;s own website (
                <a href={CP.links.contact} target="_blank" rel="noopener">
                  contact
                </a>
                ,{" "}
                <a href={CP.links.weddings} target="_blank" rel="noopener">
                  weddings
                </a>
                ,{" "}
                <a href={CP.links.corporate} target="_blank" rel="noopener">
                  catering
                </a>
                ,{" "}
                <a href={CP.links.about} target="_blank" rel="noopener">
                  about
                </a>
                ), read November 13, 2026. The menu, prices, stock and photos are read live from their online store.
              </p>
              <p>
                Cookie Paradise and Crossroads cross promote each other. Orders placed from this page go to Cookie Paradise&rsquo;s
                own checkout and are paid to them. Crossroads is run by Jacob Kennedy, who also runs Heart of Columbus.
              </p>
            </div>
          </div>
        </CookieShop>
      </main>
      <Footer />
    </>
  );
}
