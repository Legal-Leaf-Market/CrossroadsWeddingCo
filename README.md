# Crossroads Wedding Co.

Marketing site for Crossroads Wedding Co. — Next.js 15 (App Router), Tailwind v4,
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
| `DATABASE_URL` | The lead form (`/api/leads`) | Postgres connection string. Run `scripts/create-leads-table.sql` once against the database — there's no migration tooling here. |
| `NEXT_PUBLIC_BOOKING_URL` | The "Book a call" card | Public booking page for the intro call. See below. |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs | Optional. Defaults to `https://crossroadsweddingco.com`; set it on staging aliases or forks so canonicals and the sitemap don't point at production. |
| `IG_STUDIO_TOKEN` | `/ig-studio` | Shared secret. Unset means the API fails closed with a 501. |
| `ANTHROPIC_API_KEY` | `/ig-studio` | |
| `UNSPLASH_ACCESS_KEY` | `/ig-studio` | |
| `IG_STUDIO_MODEL` | `/ig-studio` | Optional model override. |

`NEXT_PUBLIC_*` variables are inlined at build time, so changing one in Vercel
requires a redeploy to take effect.

## Setting up the booking page

The "Book a call" card in the contact section renders only when
`NEXT_PUBLIC_BOOKING_URL` is set — until then the section falls back to the lead
form and the mailto link, so there's never a dead button in production.

A Google Calendar appointment schedule is free on a personal Google account and
gives you one booking page, which is all this needs:

1. Google Calendar → **Create** → **Appointment schedule**
2. Set the appointment length to 30 minutes and pick your availability
3. Open **Share** → copy the **booking page** link
4. Add it as `NEXT_PUBLIC_BOOKING_URL` in the Vercel project settings, then
   redeploy

Any other scheduler works the same way — the card just needs a URL. Calendly's
free tier also covers a single event type if you'd rather use that.

## Layout

| Path | |
| --- | --- |
| `app/` | Routes, metadata, `robots.ts`, `sitemap.ts`, generated icons and OG image |
| `components/` | Homepage sections |
| `lib/site.ts` | Canonical URL, contact email, day rate, service list — the facts that appear in more than one place |
| `lib/images.ts` | Unsplash photo IDs, named by subject |
| `lib/db/` | Drizzle schema and pool for the leads table |
| `content/instagram/` | Generated post images and their captions |
| `scripts/` | The leads table DDL and the Instagram image generator |
