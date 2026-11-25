import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import s from "@/components/partners/cookie-paradise.module.css";
import { CookieShop, GiftBoxes, HoursTable, MenuGrid, OpenStatus, OrderButton, Planner, Seasonal } from "@/components/partners/CookieShop";
import { COOKIE_PARADISE as CP } from "@/lib/cookie-paradise";
import { getShopifyCatalog } from "@/lib/partner-menu";
import { PARTNERS } from "@/lib/partners";

export const revalidate = 900;

const head = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], variable: "--cp-head", display: "swap" });
const body = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--cp-body", display: "swap" });

const cdn = "https://cdn.shopify.com/s/files/1/0947/6073/0918/files/";
const photography = {
  cookies: {
    url: `${cdn}z6632923685049_dda4d64329a2e9093aabfd824927deb3.jpg?v=1748379205`,
    alt: "Cookie Paradise chocolate chip cookies resting on a cooling rack",
    width: 1100,
    height: 619,
  },
  family: {
    url: `${CP.origin}/cdn/shop/files/The_L_s_Family.jpg?v=1750901682`,
    alt: "The Lê family together at sunset",
    width: 1000,
    height: 749,
  },
  trailer: {
    url: `${cdn}cookie-paradise-outdoor-event-trailer.jpg?v=1794421629`,
    alt: "The yellow Cookie Paradise trailer with its service window lit up",
    width: 1100,
    height: 825,
  },
};

const description = "Order handmade cookies from Cookie Paradise in Columbus, Indiana, or plan cookies for a wedding, shower, or office party. Trailer pickup, Columbus delivery, and Indiana shipping.";

export const metadata: Metadata = {
  title: "Cookie Paradise | Handmade Cookies in Columbus, Indiana",
  description,
  alternates: { canonical: "/partners/cookie-paradise" },
  openGraph: {
    url: "/partners/cookie-paradise",
    title: "Cookie Paradise | From the little yellow trailer",
    description,
    images: [{ url: `${photography.cookies.url}&width=1100`, alt: photography.cookies.alt }],
  },
};

function PartnerPhoto({ photo, priority = false }: { photo: keyof typeof photography; priority?: boolean }) {
  const { url, alt, width, height } = photography[photo];
  return (
    // Shopify's image CDN handles resizing for each viewport.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${url}&width=720`}
      srcSet={`${url}&width=480 480w, ${url}&width=720 720w, ${url}&width=${width} ${width}w`}
      sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1200px) 48vw, 590px"
      width={width}
      height={height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

const FAQ = [
  {
    q: "When will my cookies be ready?",
    a: "Cookie Paradise fulfills orders the next day the trailer is open. Holiday hours can vary, so call ahead if you’re making a special trip.",
  },
  {
    q: "Where can I get delivery or shipping?",
    a: "Local delivery is available throughout Columbus, Indiana. Shipping is available to Indiana addresses. You’ll see the available options and charges at checkout.",
  },
  {
    q: "Where do I pay for my order?",
    a: "You’ll review and pay for your order on Cookie Paradise’s own store at cookieparadise.co. Stock is checked again when you leave for checkout.",
  },
  {
    q: "Where can I check ingredients?",
    a: "Open any product name in the menu to see its ingredients and details on the Cookie Paradise store.",
  },
  {
    q: "How do I order for a wedding, shower, or office party?",
    a: (
      <>Share your date and guest count through the <a href={CP.links.weddings}>weddings and parties form</a> or the{" "}
      <a href={CP.links.corporate}>corporate catering page</a>. You can also call <a href={`tel:${CP.tel}`}>{CP.phone}</a> about a bulk order.</>
    ),
  },
];

const weddingOptions = [
  { title: "Dessert tables", text: "Serve a mix of cookies with the cake, or save a tray for the late-night crowd." },
  { title: "Take-home favors", text: "Ask about individually wrapped cookies for place settings, welcome bags, or the send-off." },
  { title: "The yellow trailer", text: "Planning an outdoor celebration? Ask if the trailer can come to your venue." },
];

export default async function CookieParadisePage() {
  const items = await getShopifyCatalog(CP.origin);
  const others = PARTNERS.filter((partner) => partner.slug !== CP.slug);

  return (
    <>
      <Header />
      <main className={`${head.variable} ${body.variable} ${s.cp}`}>
        <CookieShop items={items} origin={CP.origin} notes={CP.itemNotes} renderedAt={new Date().toISOString()}>
          <section className={s.hero} aria-labelledby="cookie-title">
            <div className={s.wrap}>
              <nav className={s.crumbs} aria-label="Breadcrumb">
                <a href="/partners">Crossroads partners</a>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Cookie Paradise</span>
              </nav>
              <div className={s.heroGrid}>
                <div>
                  <p className={s.kicker}>Cookie Paradise · Columbus, Indiana</p>
                  <h1 id="cookie-title">From the little <em>yellow trailer.</em></h1>
                  <p className={s.lede}>
                    The Lê family makes cookies by hand in Columbus. Pick a few favorites for yourself, send a box to someone you love, or share them with everyone at your wedding.
                  </p>
                  <div className={s.cta}>
                    <a className={s.btn} href="#order">Shop the cookies <span aria-hidden="true">↓</span></a>
                    <a className={`${s.btn} ${s.ghost}`} href="#weddings">Weddings &amp; parties</a>
                  </div>
                  <p className={s.award}><span aria-hidden="true">✦</span> {CP.award}</p>
                </div>
                <figure className={s.art}>
                  <PartnerPhoto photo="cookies" priority />
                  <figcaption>Chocolate chip, fresh off the rack</figcaption>
                </figure>
              </div>
              <div className={s.quickLinks}>
                <a href="#visit">
                  <strong>Pick up on 25th Street <span aria-hidden="true">↗</span></strong>
                  <span>Holiday Center parking lot</span>
                </a>
                <a href="#fulfillment">
                  <strong>Local delivery &amp; Indiana shipping <span aria-hidden="true">↗</span></strong>
                  <span>Choose at Cookie Paradise checkout</span>
                </a>
                <a href="#corporate">
                  <strong>Gifts &amp; office catering <span aria-hidden="true">↗</span></strong>
                  <span>Cookie boxes for teams and clients</span>
                </a>
              </div>
            </div>
          </section>

          <section className={s.band} id="order" aria-labelledby="menu-title">
            <div className={s.wrap}>
              <div className={s.menuHead}>
                <div>
                  <p className={s.kicker}>The Cookie Paradise menu</p>
                  <h2 id="menu-title">Find your new favorite.</h2>
                  <p className={s.sub}>Add cookies or gift boxes here, then review and pay on the Cookie Paradise store.</p>
                </div>
                <div className={s.menuActions}>
                  <a className={s.textLink} href={CP.links.shop}>Full shop <span aria-hidden="true">↗</span></a>
                  <OrderButton />
                </div>
              </div>
              <MenuGrid shopUrl={CP.links.shop} />
              <p className={s.menuNote}>Select a product name for ingredients and details. The menu shows in-stock products with photos.</p>
              <Seasonal thanksgiving={{ ...CP.thanksgiving, href: CP.links.thanksgiving }} />
            </div>
          </section>

          <section className={`${s.band} ${s.weddings}`} id="weddings" aria-labelledby="wedding-title">
            <div className={`${s.wrap} ${s.split}`}>
              <div>
                <p className={s.kicker}>Weddings, showers &amp; private parties</p>
                <h2 id="wedding-title">Save room for cookies.</h2>
                <p className={s.sub}>A table of favorites to share, a cookie tucked into each welcome bag, or the yellow trailer pulling up to the party.</p>
                <dl className={s.weddingOptions}>
                  {weddingOptions.map(({ title, text }) => (
                    <div key={title}><dt>{title}</dt><dd>{text}</dd></div>
                  ))}
                </dl>
                <a className={s.btn} href={CP.links.weddings}>Request an event quote <span aria-hidden="true">↗</span></a>
                <p className={s.fine}>Share your date and guest count. Cookie Paradise will confirm flavors, pricing, and availability.</p>
              </div>
              <Planner quoteUrl={CP.links.weddings} />
            </div>
          </section>

          <section className={s.band} id="corporate" aria-labelledby="corporate-title">
            <div className={s.wrap}>
              <div className={s.cater}>
                <div>
                  <p className={s.kicker}>Workplace gifts &amp; catering</p>
                  <h2 id="corporate-title">Make someone’s workday.</h2>
                  <p>Bring cookies to a team meeting, send a thank-you to a client, or put something sweet on the table at your holiday party.</p>
                  <div className={s.cta}>
                    <a className={`${s.btn} ${s.honeyBtn}`} href={CP.links.corporate}>Ask about catering <span aria-hidden="true">↗</span></a>
                    <a className={s.caterCall} href={`tel:${CP.tel}`}>Call {CP.phone}</a>
                  </div>
                </div>
                <div className={s.caterGifts}>
                  <h3>Thank-you boxes</h3>
                  <GiftBoxes />
                </div>
              </div>
            </div>
          </section>

          <section className={`${s.band} ${s.story}`} aria-labelledby="story-title">
            <div className={`${s.wrap} ${s.storyGrid}`}>
              <figure className={s.storyPhoto}><PartnerPhoto photo="family" /></figure>
              <div>
                <p className={s.kicker}>Meet the bakers</p>
                <h2 id="story-title">The Lê family</h2>
                <p className={s.sub}>The Lês moved from Vietnam to Columbus in November 2024. They named Cookie Paradise for their dream of making a home here and sharing a little of that joy in every cookie.</p>
                <blockquote>“The name ‘Cookie Paradise’ is symbolic of our family’s dream.”</blockquote>
                <a className={s.textLink} href={CP.links.about}>Read the family’s story <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </section>

          <section className={s.band} id="visit" aria-labelledby="visit-title">
            <div className={s.wrap}>
              <div className={s.visitSplit}>
                <div>
                  <p className={s.kicker}>Visit Cookie Paradise</p>
                  <h2 id="visit-title">See you at the window.</h2>
                  <address className={s.addr}>{CP.street}, {CP.cityLine}</address>
                  <p className={s.sub}>{CP.where}.</p>
                  <OpenStatus hours={CP.hours} fallback="Tuesday to Saturday, from 10 AM" />
                  <HoursTable hours={CP.hours} />
                  <div className={s.cta}>
                    <a className={s.btn} href={CP.links.directions}>Get directions <span aria-hidden="true">↗</span></a>
                    <a className={`${s.btn} ${s.ghost}`} href={`tel:${CP.tel}`}>Call {CP.phone}</a>
                  </div>
                  <ul className={s.socialLinks} aria-label="Contact and social links">
                    <li><a href={`mailto:${CP.email}`}>Email</a></li>
                    {CP.socials.map(({ label, href }) => <li key={label}><a href={href}>{label}</a></li>)}
                  </ul>
                </div>
                <figure className={s.visitPhoto}><PartnerPhoto photo="trailer" /></figure>
              </div>
              <div className={s.fulfillment} id="fulfillment">
                <h3>Getting your cookies</h3>
                <p>Orders are ready the next day the trailer is open. Choose how to get yours at Cookie Paradise checkout.</p>
                <dl className={s.fulfillmentWays}>
                  <div><dt>Trailer pickup</dt><dd>Give your name at the window on 25th Street.</dd></div>
                  <div><dt>Columbus delivery</dt><dd>Available throughout Columbus, Indiana.</dd></div>
                  <div><dt>Indiana shipping</dt><dd>Available for addresses within the state.</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <section className={`${s.band} ${s.questions}`} id="faq" aria-labelledby="faq-title">
            <div className={`${s.wrap} ${s.faqLayout}`}>
              <h2 id="faq-title">A few good questions</h2>
              <div className={s.faq}>
                {FAQ.map(({ q, a }) => (
                  <details key={q}><summary>{q}</summary><p>{a}</p></details>
                ))}
              </div>
            </div>
          </section>

          <div className={s.wrap}>
            <section className={s.xpromo}>
              <div>
                <h3>Planning the whole celebration?</h3>
                <p>Crossroads can handle the music, MC, and bar, and help find the right moment to open the dessert table.</p>
              </div>
              <a className={`${s.btn} ${s.ghost}`} href="/book">Check your date with Crossroads</a>
            </section>
            <div className={s.sources}>
              <p>Cookie Paradise and Crossroads cross-promote each other. Orders and payments go directly to Cookie Paradise.</p>
              <div>
                <a href="https://heartofcolumbus.shop/b/cookie-paradise-llc/">Heart of Columbus founding member</a>
                {others.map((partner) => <a key={partner.slug} href={`/partners/${partner.slug}`}>{partner.name}</a>)}
              </div>
            </div>
          </div>
        </CookieShop>
      </main>
      <Footer />
    </>
  );
}
