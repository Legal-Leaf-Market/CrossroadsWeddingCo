"use client";

// Ordering from Cookie Paradise on /partners/cookie-paradise (2026-11-25).
// One provider holds the catalog and the cart; the menu, the seasonal boxes,
// the planner, the gift boxes and the drawer all read it, so the catalog is
// sent to the browser once. The cart lives in this browser only
// (localStorage) and is handed whole to Cookie Paradise's own Shopify
// checkout; nothing is ordered or paid here. Logic: lib/cookie-order.ts.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import s from "@/components/partners/cookie-paradise.module.css";
import {
  addLine,
  boxPlan,
  cartCount,
  cartPermalink,
  cartTotal,
  countedBoxes,
  hoursTable,
  isBox,
  isHoliday,
  isOver,
  money2,
  openStatus,
  orderNote,
  priceLabel,
  pricesVary,
  sanitizeCart,
  type CartLine,
  type HoursRow,
  type ShopItem,
  type ShopVariant,
} from "@/lib/cookie-order";

const KEY = "cw.cookie-paradise.cart";
const PARTNER = "cookie-paradise";

type Notes = Record<string, { note: string; until?: string }>;
type Api = {
  items: ShopItem[];
  origin: string;
  notes: Notes;
  now: Date;
  mounted: boolean;
  count: number;
  qtyOf: (variantId: string) => number;
  add: (item: ShopItem, variant: ShopVariant, qty?: number) => void;
  addPlan: (lines: { item: ShopItem; variant: ShopVariant; qty: number }[], message: string) => void;
  openCart: () => void;
};
const Ctx = createContext<Api | null>(null);
function useShop(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("CookieShop provider missing");
  return v;
}

const lineOf = (item: ShopItem, v: ShopVariant): Omit<CartLine, "qty"> => ({
  variantId: v.id,
  handle: item.handle,
  title: item.title,
  variant: v.title,
  price: v.price,
  image: item.image,
});

// ---------------------------------------------------------------------------
// Provider, drawer, floating button
// ---------------------------------------------------------------------------

export function CookieShop({
  items,
  origin,
  notes,
  renderedAt,
  children,
}: {
  items: ShopItem[];
  origin: string;
  notes: Notes;
  renderedAt: string;
  children: ReactNode;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date(renderedAt));
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      setCart(sanitizeCart(JSON.parse(window.localStorage.getItem(KEY) || "[]")));
    } catch {
      /* storage blocked: the cart lives in memory for this visit */
    }
    setNow(new Date());
    setMounted(true);
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(cart));
    } catch {
      /* private mode */
    }
  }, [cart, mounted]);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }, []);

  // A product whose only pickup day has passed leaves the menu, even if the
  // store still lists it (the Thanksgiving boxes after November 25).
  const visible = useMemo(
    () =>
      items.filter((it) => {
        const n = notes[it.handle];
        return !(n && n.until && isOver(n.until, now));
      }),
    [items, notes, now],
  );

  const api = useMemo<Api>(
    () => ({
      items: visible,
      origin,
      notes,
      now,
      mounted,
      count: cartCount(cart),
      qtyOf: (id) => cart.find((l) => l.variantId === id)?.qty ?? 0,
      add: (item, variant, qty = 1) => {
        setCart((c) => addLine(c, lineOf(item, variant), qty));
        say(`${item.title}${variant.title ? `, ${variant.title}` : ""} added`);
      },
      addPlan: (lines, message) => {
        setCart((c) => lines.reduce((acc, l) => addLine(acc, lineOf(l.item, l.variant), l.qty), c));
        say(message);
        setOpen(true);
      },
      openCart: () => setOpen(true),
    }),
    [visible, origin, notes, now, mounted, cart, say],
  );

  const n = cartCount(cart);
  return (
    <Ctx.Provider value={api}>
      {children}
      {mounted && n > 0 && (
        <button type="button" className={`${s.btn} ${s.fab}`} onClick={() => setOpen(true)} aria-label={`Your order, ${n} ${n === 1 ? "item" : "items"}`}>
          Your order <b className={s.count}>{n}</b>
        </button>
      )}
      <Drawer open={open} onClose={() => setOpen(false)} cart={cart} setCart={setCart} origin={origin} />
      <div className={`${s.toast} ${toast ? s.toastOn : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </Ctx.Provider>
  );
}

async function soldOut(lines: CartLine[]): Promise<string[]> {
  // A slow or failed answer counts as nothing sold out: their checkout decides.
  const ask = fetch("/api/partners/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partner: PARTNER, lines: lines.map((l) => ({ handle: l.handle, variantId: l.variantId })) }),
  })
    .then((r) => r.json())
    .then((j: { sold?: unknown }) => (Array.isArray(j.sold) ? j.sold.map(String) : []))
    .catch(() => [] as string[]);
  const timeout = new Promise<string[]>((ok) => window.setTimeout(() => ok([]), 7000));
  return Promise.race([ask, timeout]);
}

function Drawer({
  open,
  onClose,
  cart,
  setCart,
  origin,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setCart: (fn: (c: CartLine[]) => CartLine[]) => void;
  origin: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pickup, setPickup] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setWarn("");
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);

  const change = (id: string, by: number) =>
    setCart((c) => c.map((l) => (l.variantId === id ? { ...l, qty: Math.min(l.qty + by, 999) } : l)).filter((l) => l.qty > 0));

  async function checkout() {
    if (!cart.length || busy) return;
    setBusy(true);
    setWarn("");
    // The tab opens on the tap so the browser allows it, then goes to their
    // checkout once the store has said what is still in stock.
    const tab = window.open("", "_blank");
    if (tab) {
      try {
        tab.opener = null;
        tab.document.title = "Opening Cookie Paradise checkout";
        tab.document.body.innerHTML =
          '<p style="font:18px/1.5 system-ui,sans-serif;padding:28px;color:#593412">Checking stock and opening the Cookie Paradise checkout…</p>';
      } catch {
        /* fine */
      }
    }
    const sold = await soldOut(cart);
    const keep = cart.filter((l) => !sold.includes(l.variantId));
    if (sold.length) {
      const gone = cart.filter((l) => sold.includes(l.variantId)).map((l) => l.title);
      setCart(() => keep);
      setWarn(`Sold out at Cookie Paradise just now, so we took it out of your order: ${gone.join(", ")}.`);
    }
    if (!keep.length) {
      tab?.close();
      setBusy(false);
      return;
    }
    const url = cartPermalink(origin, keep, orderNote({ pickup, note }));
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setBusy(false);
  }

  const total = cartTotal(cart);
  return (
    <dialog
      ref={ref}
      className={s.drawer}
      aria-labelledby="cp-cart-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={s.drawerIn}>
        <div className={s.drawerHead}>
          <h2 id="cp-cart-title">Your order</h2>
          <button type="button" className={s.x} onClick={onClose} aria-label="Close your order">
            ✕
          </button>
        </div>
        <div className={s.drawerBody}>
          {warn && <p className={s.warn}>{warn}</p>}
          {!cart.length ? (
            <p className={s.empty} style={{ marginTop: 12 }}>
              No cookies yet. Pick some from the menu.
            </p>
          ) : (
            cart.map((l) => (
              <div key={l.variantId} className={s.line}>
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image} alt="" width={56} height={56} />
                ) : (
                  <span className={s.noimg} aria-hidden="true" />
                )}
                <div>
                  <b>{l.title}</b>
                  {l.variant && (
                    <>
                      <small>{l.variant}</small>
                      <br />
                    </>
                  )}
                  <small>{money2(l.price)} each</small>
                </div>
                <div className={s.qty}>
                  <button type="button" onClick={() => change(l.variantId, -1)} aria-label={`One less ${l.title}`}>
                    −
                  </button>
                  <span>{l.qty}</span>
                  <button type="button" onClick={() => change(l.variantId, 1)} aria-label={`One more ${l.title}`}>
                    +
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className={s.drawerFoot}>
          {cart.length ? (
            <>
              <div className={s.total}>
                <span>Subtotal</span>
                <span>{money2(total)}</span>
              </div>
              <label className={s.check}>
                <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} />
                <span>I&rsquo;ll pick up at the trailer. (Choose pickup at their checkout too.)</span>
              </label>
              <input
                className={s.noteInput}
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note for Cookie Paradise (optional): for our shower on December 12"
                aria-label="Note for Cookie Paradise, optional"
              />
              <button type="button" className={s.btn} onClick={checkout} disabled={busy}>
                {busy ? "Checking stock…" : "Check out on cookieparadise.co"}
              </button>
              <p className={s.fine} style={{ margin: 0, textAlign: "center" }}>
                You pay Cookie Paradise directly, on their own store. Choose trailer pickup, Columbus delivery or Indiana shipping
                there. Orders are ready the next day the trailer is open.
              </p>
            </>
          ) : (
            <a
              className={s.btn}
              href="#order"
              onClick={() => {
                onClose();
              }}
            >
              See the menu
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

export function OrderButton({ className }: { className?: string }) {
  const { openCart, mounted, count } = useShop();
  const n = mounted ? count : 0;
  return (
    <button type="button" className={className || `${s.btn} ${s.sm}`} onClick={openCart}>
      Your order{n > 0 && <b className={s.count}>{n}</b>}
    </button>
  );
}

function VariantPick({
  item,
  value,
  onChange,
  light,
}: {
  item: ShopItem;
  value: number;
  onChange: (i: number) => void;
  light?: boolean;
}) {
  if (item.variants.length < 2) return null;
  return (
    <select
      className={s.select}
      style={light ? { background: "#fff" } : undefined}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={`Choose an option for ${item.title}`}
    >
      {item.variants.map((v, i) => (
        <option key={v.id} value={i}>
          {pricesVary(item) ? `${v.title}, ${money2(v.price)}` : v.title}
        </option>
      ))}
    </select>
  );
}

function AddButton({ item, variant, className, label = "Add to order" }: { item: ShopItem; variant: ShopVariant; className?: string; label?: string }) {
  const { add, qtyOf, mounted } = useShop();
  const n = mounted ? qtyOf(variant.id) : 0;
  return (
    <button
      type="button"
      className={`${className || `${s.btn} ${s.sm}`} ${n ? s.added : ""}`}
      onClick={() => add(item, variant)}
      aria-label={n ? `Added ×${n}. Add one more ${item.title}` : `${label}: ${item.title}`}
    >
      {n ? `Added ×${n}` : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// The menu
// ---------------------------------------------------------------------------

function CookieCard({ item }: { item: ShopItem }) {
  const { notes } = useShop();
  const [pick, setPick] = useState(0);
  const v = item.variants[pick] || item.variants[0];
  const note = notes[item.handle]?.note;
  const many = item.variants.length > 1;
  return (
    <article className={s.cookie}>
      <a className={s.ph} href={item.url} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" loading="lazy" width={600} height={600} />
      </a>
      {isHoliday(item) && <span className={s.tag}>Seasonal</span>}
      <div className={s.body}>
        <h3>
          <a href={item.url} target="_blank" rel="noopener">
            {item.title}
          </a>
        </h3>
        <p className={s.price}>
          {priceLabel(item)}
          {!many && !isBox(item) ? " each" : ""}
        </p>
        {note && <p className={s.note}>{note}</p>}
        {item.blurb && <p className={s.blurb}>{item.blurb}</p>}
        <VariantPick item={item} value={pick} onChange={setPick} />
        <AddButton item={item} variant={v} />
      </div>
    </article>
  );
}

export function MenuGrid({ shopUrl }: { shopUrl: string }) {
  const { items } = useShop();
  const boxes = items.filter(isBox);
  const singles = items.filter((i) => !isBox(i));
  const [tab, setTab] = useState<"all" | "cookies" | "boxes">(singles.length ? "cookies" : "all");
  const shown = tab === "boxes" ? boxes : tab === "cookies" ? singles : [...singles, ...boxes];
  if (!items.length) {
    return (
      <div className={s.grid}>
        <p className={s.empty}>
          The menu is temporarily unavailable here.{" "}
          <a href={shopUrl} target="_blank" rel="noopener">
            See today&rsquo;s cookies on cookieparadise.co
          </a>
          .
        </p>
      </div>
    );
  }
  const tabs: { key: typeof tab; label: string; n: number }[] = [
    { key: "all", label: "Everything", n: items.length },
    { key: "cookies", label: "Cookies", n: singles.length },
    { key: "boxes", label: "Boxes and gifts", n: boxes.length },
  ];
  return (
    <>
      <div className={s.tabs} role="group" aria-label="Filter the cookie menu">
        {tabs
          .filter((t) => t.n > 0)
          .map((t) => (
            <button key={t.key} type="button" className={s.tab} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
              <small>{t.n}</small>
            </button>
          ))}
      </div>
      <div className={s.grid}>
        {shown.map((it) => (
          <CookieCard key={it.id} item={it} />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Seasonal: Thanksgiving until its pickup day, then whatever holiday boxes
// their store lists
// ---------------------------------------------------------------------------

function HolidayCard({ item }: { item: ShopItem }) {
  const [pick, setPick] = useState(0);
  const v = item.variants[pick] || item.variants[0];
  return (
    <div className={s.holidayCard}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt="" loading="lazy" width={84} height={84} />
      <div>
        <b>{item.title}</b>
        <span className={s.holidayPrice}>{priceLabel(item)}</span>
        <VariantPick item={item} value={pick} onChange={setPick} light />
        <div>
          <AddButton item={item} variant={v} className={`${s.btn} ${s.sm} ${s.honeyBtn}`} label="Add" />
        </div>
      </div>
    </div>
  );
}

function TdayAdd({ item }: { item: ShopItem }) {
  const [pick, setPick] = useState(0);
  const v = item.variants[pick] || item.variants[0];
  return (
    <div className={s.tdayAction}>
      <VariantPick item={item} value={pick} onChange={setPick} light />
      <AddButton item={item} variant={v} className={`${s.btn} ${s.light}`} label="Add a box" />
    </div>
  );
}

export function Seasonal({ thanksgiving }: { thanksgiving: { until: string; text: string; href: string } }) {
  const { items, now } = useShop();
  const holiday = items.filter((i) => isHoliday(i) && !/thanksgiving/i.test(i.title));
  const tday = !isOver(thanksgiving.until, now) ? items.find((i) => /thanksgiving/i.test(i.title)) : undefined;
  const showTday = !isOver(thanksgiving.until, now);
  if (!holiday.length && !showTday) return null;
  return (
    <div className={s.season}>
      {showTday && (
        <div className={s.seasonBox}>
          <div>
            <h3>Thanksgiving cookie boxes</h3>
            <p>{thanksgiving.text}</p>
          </div>
          {tday ? (
            <TdayAdd item={tday} />
          ) : (
            <a className={`${s.btn} ${s.light}`} href={thanksgiving.href} target="_blank" rel="noopener">
              See the boxes
            </a>
          )}
        </div>
      )}
      {holiday.length > 0 && (
        <div className={s.holiday}>
          <h3>Holiday cookie gift boxes</h3>
          <p>A gift for the host, the neighbors, or everyone at the office.</p>
          <div className={s.holidayRow}>
            {holiday.map((it) => (
              <HolidayCard key={it.id} item={it} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gift boxes, as a short list (the corporate section)
// ---------------------------------------------------------------------------

export function GiftBoxes() {
  const { items } = useShop();
  const boxes = countedBoxes(items);
  if (!boxes.length) return <p>Ask Cookie Paradise which gift boxes are available.</p>;
  return (
    <div className={s.boxes}>
      {boxes.map(({ item }) => (
        <div key={item.id} className={s.boxLine}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" loading="lazy" width={56} height={56} />
          <div>
            <b>{item.title}</b>
            <span>{priceLabel(item)}</span>
          </div>
          <AddButton item={item} variant={item.variants[0]} className={`${s.btn} ${s.sm} ${s.honeyBtn}`} label="Add" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dessert table planner: guests in, boxes out, straight into the order
// ---------------------------------------------------------------------------

export function Planner({ quoteUrl }: { quoteUrl: string }) {
  const { items, addPlan } = useShop();
  const [guests, setGuests] = useState(100);
  const [each, setEach] = useState(2);
  const boxes = countedBoxes(items);
  const flavors = Array.from(new Set(boxes.flatMap((b) => b.item.variants.map((v) => v.title).filter(Boolean))));
  const [flavor, setFlavor] = useState("");
  const pickFlavor = flavor && flavors.includes(flavor) ? flavor : flavors[0] || "";
  const variantFor = (item: ShopItem) => item.variants.find((v) => v.title === pickFlavor) || item.variants[0];
  const need = Math.max(0, Math.min(1000, Math.round(guests))) * each;
  const plan = boxPlan(
    need,
    boxes.map((b) => ({ size: b.size, price: variantFor(b.item).price })),
  );
  const bySize = new Map(boxes.map((b) => [b.size, b.item]));

  return (
    <div className={s.planner}>
      <p className={s.kicker}>Dessert table planner</p>
      <h3>How many cookies for your crowd?</h3>
      <div className={s.field}>
        <label htmlFor="cp-guest-count">Guest count</label>
        <span className={s.guestRow}>
          <input
            type="number"
            id="cp-guest-count"
            min={1}
            max={1000}
            value={guests}
            onChange={(e) => setGuests(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
          />
          <input type="range" min={10} max={300} step={5} value={Math.min(300, Math.max(10, guests))} onChange={(e) => setGuests(Number(e.target.value))} aria-label="Guests slider" />
        </span>
      </div>
      <div className={s.field}>
        Cookies per guest
        <div className={s.seg} role="group" aria-label="Cookies per guest">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" aria-pressed={each === n} onClick={() => setEach(n)}>
              {n === 1 ? "1 · With cake" : n === 2 ? "2 · Dessert table" : "3 · Extra to share"}
            </button>
          ))}
        </div>
      </div>
      {flavors.length > 1 && (
        <div className={s.field}>
          Box mix
          <div className={s.seg} role="group" aria-label="Box mix">
            {flavors.map((f) => (
              <button key={f} type="button" aria-pressed={pickFlavor === f} onClick={() => setFlavor(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={s.result} aria-live="polite">
        <p className={s.big}>{need.toLocaleString("en-US")} cookies</p>
        {plan ? (
          <ul>
            {plan.picks.map((p) => {
              const it = bySize.get(p.size)!;
              const v = variantFor(it);
              return (
                <li key={p.size}>
                  <span>
                    {p.count} × {p.size}-cookie box
                  </span>
                  <span>{money2(p.count * v.price)}</span>
                </li>
              );
            })}
            <li>
              <span>
                {plan.cookies} cookies in {plan.boxes} {plan.boxes === 1 ? "box" : "boxes"}
              </span>
              <span>{money2(plan.cost)}</span>
            </li>
          </ul>
        ) : (
          <p className={s.fine} style={{ margin: 0 }}>
            {boxes.length ? "Pick a guest count to see the boxes." : "Ask Cookie Paradise about boxes for your guest count."}
          </p>
        )}
      </div>
      <div className={s.plannerActions}>
        {plan && (
          <button
            type="button"
            className={s.btn}
            onClick={() =>
              addPlan(
                plan.picks.map((p) => {
                  const it = bySize.get(p.size)!;
                  return { item: it, variant: variantFor(it), qty: p.count };
                }),
                `${plan.boxes} ${plan.boxes === 1 ? "box" : "boxes"} added`,
              )
            }
          >
            Add boxes to order
          </button>
        )}
        <a className={`${s.btn} ${s.ghost}`} href={quoteUrl} target="_blank" rel="noopener">
          Get an event quote
        </a>
      </div>
      <p className={s.fine} style={{ margin: "12px 0 0" }}>
        Estimates use current online gift box prices. Cookie Paradise quotes event orders, favors, and the trailer separately.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Open now, and today's row in the hours table (Columbus time, after mount)
// ---------------------------------------------------------------------------

export function OpenStatus({ hours, fallback }: { hours: HoursRow[]; fallback: string }) {
  const { now, mounted } = useShop();
  const st = mounted ? openStatus(hours, now) : null;
  return (
    <p className={`${s.status} ${st?.open ? s.statusOpen : ""}`}>
      <i aria-hidden="true" />
      <span>{st ? st.text : fallback}</span>
    </p>
  );
}

export function HoursTable({ hours }: { hours: HoursRow[] }) {
  const { now, mounted } = useShop();
  const today = mounted
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone: "America/Indiana/Indianapolis", weekday: "short" }).format(now),
      )
    : -1;
  return (
    <table className={s.hours} aria-label="Hours">
      <tbody>
        {hoursTable(hours).map((r) => (
          <tr key={r.day} className={r.day === today ? s.today : undefined}>
            <td>
              {r.name}
              {r.day === today ? " (today)" : ""}
            </td>
            <td>{r.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
