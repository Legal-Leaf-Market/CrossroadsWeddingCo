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
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs | Optional. Defaults to `https://crossroadsweddingco.com`; set it on staging aliases or forks so canonicals and the sitemap don't point at production. |
| `RESEND_API_KEY` | Booking emails | Confirmation to the couple + notification to you on each booking request. Silent no-op while unset. |
| `RESEND_FROM` | Booking emails | Optional. Defaults to `Crossroads Wedding Co. <hello@crossroadsweddingco.com>`, must be a Resend-verified domain. |
| `RESEND_NOTIFY_TO` | Booking emails | Optional. Defaults to `jake@crossroadsweddingco.com`. |
| `STRIPE_SECRET_KEY` | `/api/checkout` | Deposit payments. Fails closed (501) while unset. |
| `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` | Marks deposits paid. Fails closed (501) while unset. |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Playlist ingestion & track search | Free app at developer.spotify.com. `lib/spotify.ts` fails closed while unset. |
| `ADMIN_API_TOKEN` | `/api/spotify/playlist` | Shared secret gating internal tooling endpoints. |
| `IG_STUDIO_TOKEN` | `/ig-studio` | Shared secret. Unset means the API fails closed with a 501. |
| `ANTHROPIC_API_KEY` | `/ig-studio` | |
| `UNSPLASH_ACCESS_KEY` | `/ig-studio` | |
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

## Layout

| Path | |
| --- | --- |
| `app/` | Routes, metadata, `robots.ts`, `sitemap.ts`, generated icons and OG image |
| `components/` | Homepage sections |
| `lib/site.ts` | Canonical URL, contact email, day rate, service list, the facts that appear in more than one place |
| `lib/images.ts` | Unsplash photo IDs, named by subject |
| `lib/db/` | Drizzle schema and pool for the leads table |
| `lib/cities.ts` | Service-area city data driving the landing pages, footer, and areaServed markup |
| `lib/email.ts` / `lib/spotify.ts` | Resend + Spotify integrations, both fail closed without keys |
| `content/instagram/` | Generated post images and their captions |
| `scripts/` | The leads table DDL and the Instagram image generator |
