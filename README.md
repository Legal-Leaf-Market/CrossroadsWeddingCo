# Crossroads Wedding Co.

Marketing site for Crossroads Wedding Co.: Next.js 15 (App Router), Tailwind v4,
deployed on Vercel.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm check      # tsc --noEmit
pnpm build
pnpm ig:posts   # regenerate the Instagram images in content/instagram/
```

## Environment variables

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Lead form, booking flow, schema migration | Postgres connection string. Name is matched case-insensitively (`POSTGRES_URL` and friends also work) and the value is sanitized, so quoted or prefixed pastes still resolve; the build log prints the host it dialed. `pnpm build` applies `scripts/phase1-schema.sql` (idempotent, additive) before compiling; run `pnpm db:migrate` to apply it manually. |
| `NEXT_PUBLIC_BOOKING_URL` | The "Book a call" card | Public booking page for the intro call. See below. |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs | Optional. Defaults to `https://crossroadsweddingco.shop`; set it on staging aliases or forks so canonicals and the sitemap don't point at production. |
| `RESEND_API_KEY` | Booking emails | Confirmation to the couple + notification to you on each booking request. Silent no-op while unset. |
| `RESEND_FROM` | Booking emails | Optional. Defaults to `Crossroads Wedding Co. <hello@crossroadsweddingco.shop>`, must be a Resend-verified domain. |
| `RESEND_NOTIFY_TO` | Booking emails | Optional. Defaults to `jake@crossroadsweddingco.shop`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Booking texts | Confirmation text to the couple (+ optional owner text via `TWILIO_NOTIFY_TO`). Needs a sender: `TWILIO_MESSAGING_SERVICE_SID` (preferred) or `TWILIO_FROM_NUMBER`. Silent no-op while unset. |
| `STRIPE_SECRET_KEY` | `/api/checkout` | Deposit payments. Fails closed (501) while unset. |
| `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` | Marks deposits paid. Fails closed (501) while unset. |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Playlist ingestion & track search | Free app at developer.spotify.com. `lib/spotify.ts` fails closed while unset. |
| `ADMIN_API_TOKEN` | `/api/spotify/playlist` | Shared secret gating internal tooling endpoints. |
| `IG_STUDIO_TOKEN` | `/ig-studio` | Shared secret. Unset means the API fails closed with a 501. |
| `ANTHROPIC_API_KEY` | `/ig-studio` | |
| `UNSPLASH_ACCESS_KEY` | `/ig-studio` | |
| `SIGNUP_OPEN` | `/signup` | Set to `1` to let other businesses create accounts. Unset means the page says signups aren't open and `/api/signup` answers 403. |
| `NEXT_PUBLIC_PLATFORM_NAME` | `/signup`, `/login`, `/app`, sign-in emails | Name of the software sold to other businesses. Defaults to the working name "Crossroads Agency OS". |
| `RESEND_PLATFORM_FROM` | Sign-in emails | Optional. Defaults to `<platform name> <booking@crossroadsweddingco.shop>`. |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Bank and card feeds (`/app/integrations`) | From the Plaid dashboard. Unset means the page shows "Not available yet" and every Plaid route answers 501. |
| `PLAID_ENV` | Bank feeds | `sandbox` (default, Plaid's test banks) or `production`. |
| `PLAID_WEBHOOK_URL` | Bank feeds | Optional. Defaults to `<site>/api/webhooks/plaid`. |
| `INTEGRATIONS_KEY` | Bank feeds | 64 hex characters (`openssl rand -hex 32`). Encrypts stored bank access tokens; without it nothing can be connected. Losing it means every bank must be reconnected, so keep a copy somewhere safe. |
| `HOUSE_BOOKS_EMAILS` | Crossroads' own books (`/app/books`, `/app/transactions`, `/app/integrations`) | Comma-separated emails allowed to keep the house account's books, e.g. `jake@crossroadsweddingco.shop`. Sign in at `/login` with an emailed link; there are no passwords. Checked on every request, so removing an email locks that person out at once. Unset means nobody. |
| `IG_STUDIO_MODEL` | `/ig-studio` | Optional model override. |

`NEXT_PUBLIC_*` variables are inlined at build time, so changing one in Vercel
requires a redeploy to take effect.

## Setting up the booking page

The "Book a call" card in the contact section renders only when
`NEXT_PUBLIC_BOOKING_URL` is set, until then the section falls back to the lead
form and the mailto link, so there's never a dead button in production.

A Google Calendar appointment schedule is free on a personal Google account and
gives you one booking page, which is all this needs:

1. Google Calendar → **Create** → **Appointment schedule**
2. Set the appointment length to 30 minutes and pick your availability
3. Open **Share** → copy the **booking page** link
4. Add it as `NEXT_PUBLIC_BOOKING_URL` in the Vercel project settings, then
   redeploy

Any other scheduler works the same way, the card just needs a URL. Calendly's
free tier also covers a single event type if you'd rather use that.

## Booking flow

`/book` collects the date request (couple, date, venue, add-ons, optional Spotify
playlist link) and writes a `weddings` row with status `inquiry`. If the platform
schema isn't applied yet the request falls back to the legacy `leads` table, so
no inquiry is ever lost. With `RESEND_API_KEY` set, the couple gets a
confirmation email and you get a notification. Stripe deposit checkout and the
webhook are scaffolded and fail closed until keys exist.

City landing pages live at `/{state}/{city}/wedding-dj` for the six markets in
`lib/cities.ts`; each carries its own copy and Service JSON-LD, and they're all
in the sitemap and footer.

## Client planning hub

Every booking mints a 48-hex `access_token` on the `weddings` row, and the
confirmation email links the couple to `/hub/[token]`. No passwords: the link is
the login. The hub has four autosaving sections (venue basics, run-of-show
timeline, music cues + labeled Spotify playlist links + must/do-not-play lists,
VIP names with phonetic spellings) that debounce writes to `PUT /api/hub/[token]/*` routes,
each of which validates the token, zod-checks the body, and replaces that
wedding's rows in a transaction guarded by a per-section revision counter
(`weddings.hub_section_revs`): a stale tab gets a 409 plus the current rows
and refreshes instead of overwriting what the other partner saved. `/hub/[token]/runsheet` renders a
print-optimized one-pager for the venue and crew; the PWA manifest lets couples
pin the hub to a phone home screen.

`/hub/[token]/live` runs the day: the MC taps Start as each block begins and
the drift engine shifts every downstream time, on every open screen (15s
poll). `/live/[share_token]` is the read-only version of the same view for
vendors; the share token grants exactly that read and nothing else.

`/hub/preview`, `/hub/preview/runsheet`, and `/hub/preview/live` are dev-only
sample-data twins used for layout QA; they 404 in production builds. `/api/`
is disallowed in `robots.ts`; the tokened pages rely on noindex metadata.

## Layout

| Path | |
| --- | --- |
| `app/` | Routes, metadata, `robots.ts`, `sitemap.ts`, generated icons and OG image |
| `components/` | Homepage sections |
| `lib/site.ts` | Canonical URL, contact email, day rate, service list, the facts that appear in more than one place |
| `lib/images.ts` | Unsplash photo IDs, named by subject |
| `lib/db/` | Drizzle schema (platform tables + legacy leads) and pool |
| `lib/hub.ts` / `lib/hub-constants.ts` | Hub data access (server) and client-safe constants |
| `components/hub/` | Planning hub sections (client components, autosave) |
| `lib/cities.ts` | Service-area city data driving the landing pages, footer, and areaServed markup |
| `lib/email.ts` / `lib/spotify.ts` | Resend + Spotify integrations, both fail closed without keys |
| `content/instagram/` | Generated post images and their captions |
| `scripts/` | The leads table DDL and the Instagram image generator |

## Business accounts (multi-tenant signup)

Other wedding and event businesses can sign up for the platform at `/signup`
once `SIGNUP_OPEN=1` is set. Each signup creates a `tenants` row (their
account, on a 14-day trial, no card) and a `users` row for the owner. Sign-in
is an emailed link: `/login` sends it, `/login/verify` holds a button that
spends it, and `/app` is the signed-in workspace. Crossroads itself is the
house account (`HOUSE_TENANT_ID` in `lib/tenant-constants.ts`); every existing
table defaults to it, and `/admin/[key]` reads only house rows. Without
`RESEND_API_KEY` in production, signup and sign-in refuse with a 503 instead
of promising an email; in local dev the link is printed to the server log.

## Bank and card feeds (Plaid)

`/app/integrations` lets a business account connect bank and card accounts
through Plaid. The access token Plaid returns is encrypted with
`INTEGRATIONS_KEY` (AES-256-GCM, `lib/secrets.ts`) and never reaches a
browser. Transactions arrive through `/transactions/sync` (`lib/integrations/bank-feed.ts`),
on connect, on the Refresh button, and when Plaid's signed webhook
(`/api/webhooks/plaid`) says there is something new. Amounts are stored as
integer cents with positive meaning money in. Rows land as "unreviewed":
nothing is categorized or posted to books yet.
