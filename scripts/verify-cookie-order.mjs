// Checks lib/cookie-order.ts, the logic behind ordering from Cookie Paradise
// on /partners/cookie-paradise: what the menu shows, the cart handed to their
// Shopify checkout, the dessert-table planner and the open-now line.
// Run it when you touch any of that:
//   node --experimental-strip-types scripts/verify-cookie-order.mjs
// The product rows are shaped like their real /products.json (an em dash in a
// title, "Default Title", a sold-out size, a cookie with no photo).
import {
  addLine,
  blurbFrom,
  boxPlan,
  cartPermalink,
  cartTotal,
  countedBoxes,
  hoursTable,
  isOver,
  mapShopifyProducts,
  openStatus,
  orderNote,
  priceLabel,
  sanitizeCart,
} from "../lib/cookie-order.ts";

let failures = 0;
function check(label, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log(`ok   ${label}`);
  else {
    failures++;
    console.log(`FAIL ${label}\n     got  ${g}\n     want ${w}`);
  }
}

const ORIGIN = "https://cookieparadise.co/";
const img = (n) => [{ src: `https://cdn.shopify.com/s/files/1/0947/6073/0918/files/${n}.png?v=1` }];
const RAW = [
  {
    id: 1,
    title: "24-Cookie Gift Box — The Team Thank You",
    handle: "24-cookie-gift-box",
    product_type: "Cookie Gift Boxes",
    body_html: "<p>Two dozen cookies &amp; a thank you note. Boxed by hand.</p>",
    images: img("box24"),
    variants: [
      { id: 501, title: "Seasonal Assortment", price: "48.00", available: true },
      { id: 502, title: "All Chocolate Chip", price: "48.00", available: false },
    ],
  },
  { id: 2, title: "12-Cookie Gift Box — The Appreciation Box", handle: "12-cookie-gift-box", product_type: "Cookie Gift Boxes", images: img("box12"), variants: [{ id: 601, title: "Seasonal Assortment", price: "24.00", available: true }] },
  { id: 3, title: "6-Cookie Gift Box — The Thank You Box", handle: "6-cookie-gift-box", product_type: "Cookie Gift Boxes", images: img("box6"), variants: [{ id: 701, title: "Seasonal Assortment", price: "12.00", available: true }] },
  { id: 4, title: "S’mores Cookies", handle: "smores-cookies", product_type: "", images: img("smores"), variants: [{ id: 801, title: "Default Title", price: "5.00", available: true }] },
  { id: 5, title: "Coconut Dream", handle: "coconut-dream", images: [], variants: [{ id: 901, title: "Default Title", price: "4.00", available: true }] },
  { id: 6, title: "Hot Chocolate", handle: "hot-chocolate", images: img("hot"), variants: [{ id: 1001, title: "Default Title", price: "4.00", available: false }] },
  { id: 7, title: "Bad handle", handle: "../evil", images: img("x"), variants: [{ id: 1101, title: "Default Title", price: "4.00", available: true }] },
];

// ── The menu: in stock and photographed only ─────────────────────────────────
const items = mapShopifyProducts(ORIGIN, RAW);
check("only in-stock, photographed, well-formed products", items.map((i) => i.handle), ["24-cookie-gift-box", "12-cookie-gift-box", "6-cookie-gift-box", "smores-cookies"]);
check("an em dash in a title becomes a colon", items[0].title, "24-Cookie Gift Box: The Team Thank You");
check("a sold-out size is dropped", items[0].variants.map((v) => v.title), ["Seasonal Assortment"]);
check("Default Title reads as no size", items[3].variants[0].title, "");
check("product link on their store", items[3].url, "https://cookieparadise.co/products/smores-cookies");
check("photo asks Shopify's CDN for 600px", items[3].image, "https://cdn.shopify.com/s/files/1/0947/6073/0918/files/smores.png?v=1&width=600");
check("their description, tags stripped and entities decoded", items[0].blurb, "Two dozen cookies & a thank you note. Boxed by hand.");

check("one price for every mix reads as that price", priceLabel({ variants: [{ price: 48 }, { price: 48 }] }), "$48");
check("prices that depend on the choice read From", priceLabel({ variants: [{ price: 159.9 }, { price: 175.89 }] }), "From $159.90");
check("a single cookie", priceLabel({ variants: [{ price: 3.5 }] }), "$3.50");

// ── Their words, trimmed, never with a dash ─────────────────────────────────
check("long description stops at a sentence", blurbFrom("<p>Soft and chewy, baked fresh at the trailer each morning. " + "Made with brown butter and sea salt flakes on top ".repeat(4) + "</p>", 80), "Soft and chewy, baked fresh at the trailer each morning.");
check("or at a word, with an ellipsis", blurbFrom("<p>Soft and chewy. " + "Made with brown butter and sea salt flakes on top ".repeat(4) + "</p>", 60), "Soft and chewy. Made with brown butter and sea salt flakes…");
check("no em dash survives a blurb", /[—–]/.test(blurbFrom("<p>Fresh — every morning &mdash; really</p>")), false);

// ── Planner: fewest extra cookies, then lowest cost, then fewest boxes ───────
const BOXES = [{ size: 24, price: 48 }, { size: 12, price: 24 }, { size: 6, price: 12 }];
check("100 guests x 1 cookie: 4 two-dozen boxes and a 6", boxPlan(100, BOXES), { cookies: 102, cost: 204, boxes: 5, picks: [{ size: 24, count: 4 }, { size: 6, count: 1 }] });
check("24 cookies: one box", boxPlan(24, BOXES), { cookies: 24, cost: 48, boxes: 1, picks: [{ size: 24, count: 1 }] });
check("7 cookies: one 12, not two 6s", boxPlan(7, BOXES), { cookies: 12, cost: 24, boxes: 1, picks: [{ size: 12, count: 1 }] });
check("a cheaper-per-cookie box still wins", boxPlan(12, [{ size: 12, price: 15.99 }, { size: 6, price: 12 }]), { cookies: 12, cost: 15.99, boxes: 1, picks: [{ size: 12, count: 1 }] });
check("nothing to plan", boxPlan(0, BOXES), null);
check("no boxes for sale", boxPlan(50, []), null);
check("gift boxes read from the menu, largest first", countedBoxes(items).map((b) => b.size), [24, 12, 6]);

// ── The cart handed to their checkout ────────────────────────────────────────
let cart = [];
cart = addLine(cart, { variantId: "801", handle: "smores-cookies", title: "S’mores Cookies", variant: "", price: 5, image: "" });
cart = addLine(cart, { variantId: "801", handle: "smores-cookies", title: "S’mores Cookies", variant: "", price: 5, image: "" }, 2);
cart = addLine(cart, { variantId: "601", handle: "12-cookie-gift-box", title: "12-Cookie Gift Box", variant: "Seasonal Assortment", price: 24, image: "" });
check("same cookie twice adds up", cart.map((l) => [l.variantId, l.qty]), [["801", 3], ["601", 1]]);
check("total", cartTotal(cart), 39);
const note = orderNote({ pickup: true, note: "For our shower — Dec 12" });
check("order note: pickup, their note, where it came from", note, "Pickup at the trailer, please. For our shower, Dec 12. Sent from Crossroads Wedding and Event Co.");
check(
  "one permalink carries every line, the note and our ref",
  cartPermalink(ORIGIN, cart, orderNote({ pickup: false })),
  "https://cookieparadise.co/cart/801:3,601:1?note=Sent+from+Crossroads+Wedding+and+Event+Co.&ref=crossroadsweddingco&attributes%5Bcrossroads_ref%5D=partner-page&utm_source=crossroadsweddingco&utm_medium=referral&utm_campaign=partner-cookie-paradise",
);
check("a note is capped", orderNote({ note: "x".repeat(500) }).length, 200 + 2 + "Sent from Crossroads Wedding and Event Co.".length);
check(
  "a stored cart is never trusted",
  sanitizeCart([{ variantId: "801", title: "S'mores", qty: 2, price: 5, image: "javascript:alert(1)" }, { variantId: "abc", title: "x", qty: 1, price: 1 }, null, { variantId: "9", title: "y", qty: 0, price: 1 }]).map((l) => [l.variantId, l.qty, l.image]),
  [["801", 2, ""]],
);

// ── Hours, in Columbus time whatever the visitor's clock says ───────────────
const HOURS = [[2, 600, 1080], [3, 600, 1080], [4, 600, 1080], [5, 600, 1080], [6, 600, 1200]];
check("Wednesday 10 AM in Columbus (15:00 UTC in November)", openStatus(HOURS, new Date("2026-11-25T15:00:00Z")), { open: true, text: "Open now until 6 PM" });
check("Wednesday 9:59 AM", openStatus(HOURS, new Date("2026-11-25T14:59:00Z")), { open: false, text: "Opens today at 10 AM" });
check("Saturday 7:30 PM is still open (it is Sunday in UTC)", openStatus(HOURS, new Date("2026-11-29T00:30:00Z")), { open: true, text: "Open now until 8 PM" });
check("Saturday 7:30 PM in July, daylight time", openStatus(HOURS, new Date("2026-07-18T23:30:00Z")), { open: true, text: "Open now until 8 PM" });
check("Sunday afternoon: closed until Tuesday", openStatus(HOURS, new Date("2026-11-29T18:00:00Z")), { open: false, text: "Closed now. Opens Tuesday at 10 AM" });
check("Monday: opens tomorrow", openStatus(HOURS, new Date("2026-11-30T18:00:00Z")), { open: false, text: "Closed now. Opens tomorrow at 10 AM" });
check("hours table starts Monday", hoursTable(HOURS).map((r) => `${r.name} ${r.text}`), [
  "Monday Closed",
  "Tuesday 10 AM to 6 PM",
  "Wednesday 10 AM to 6 PM",
  "Thursday 10 AM to 6 PM",
  "Friday 10 AM to 6 PM",
  "Saturday 10 AM to 8 PM",
  "Sunday Closed",
]);
check("Thanksgiving pickup day is not over at 11:59 PM in Columbus", isOver("2026-11-25", new Date("2026-11-26T04:59:00Z")), false);
check("and is over at midnight", isOver("2026-11-25", new Date("2026-11-26T05:00:00Z")), true);

// ── The standing rule: no em or en dash in anything a person reads ──────────
const shown = JSON.stringify([items, note, hoursTable(HOURS)]);
check("no em or en dash anywhere shown", /[—–]/.test(shown), false);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
