# CLAUDE.md — Crossroads Wedding Co. & Agency OS Platform Specification

## 1. Project & Business Architecture

### 1.1 Executive Overview
Crossroads Wedding Co. is a tech-enabled wedding entertainment and talent coordination platform operating an **"Agency-in-a-Box" (Agency OS)** model. It bridges the gap between budget-conscious couples seeking transparent flat-rate services and top-tier local gigging talent (DJs, MCs, acoustic musicians, certified bartenders).

The platform replaces traditional bloated production agencies ($2,000–$3,500 packages) with an automated, lean operational infrastructure centered around a **$1,000 baseline DJ/MC day rate** with high-margin modular upsells.

### 1.2 The Economic Engine & Revenue Distribution
The platform runs on an **80/20 / Multi-Tier Split** powered by Stripe Connect:

| Stakeholder | Baseline Tier ($1,000 Gig) | Acoustic Add-on ($400) | Bartender Add-on ($400) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Talent (1099 Contractor)** | $750.00 (75%) | $300.00 (75%) | $300.00 (75%) | High payout ensures top-tier talent retention & ownership |
| **Local Franchisee / Operator** | $180.00 (18%) | $72.00 (18%) | $72.00 (18%) | Local logistics, talent recruiting, emergency dispatch |
| **Platform Holding Co. (Royalty)**| $70.00 (7%) | $28.00 (7%) | $28.00 (7%) | SaaS licensing, automated intake, software updates, lead bridge |

* **Deposit Structure:** Fixed $500 non-refundable retainer due upon booking to lock date; remaining balance auto-charged 14 days prior to event date.
* **Talent Payout:** Automated disbursement via Stripe Connect 24–48 hours post-event upon submission of the digital event completion checklist.

---

## 2. Tech Stack & Infrastructure

- **Framework:** Next.js 14+ (App Router, Server Actions, Route Handlers)
- **Language:** TypeScript (Strict Mode)
- **Styling & UI:** Tailwind CSS, Radix UI primitives / `shadcn/ui`, Lucide Icons
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM (Connection pooling via `@neondatabase/serverless`)
- **State Management & Data Fetching:** TanStack React Query v5, Zustand (for live run-sheet state)
- **Authentication & Authorization:** 
  - Admin & Talent: NextAuth.js / Auth.js (OAuth + Passwordless Magic Email)
  - Client Portal: Secure UUID / Nonce Magic Links with persistent session tokens (PWA optimized, zero-friction client login)
- **Payments & Payouts:** Stripe Connect (Custom / Express accounts for talent and franchise nodes)
- **Real-Time Synchronization:** Supabase Realtime or Ably / WebSockets for the Live Run-Sheet Drift Engine
- **Transactional Comms:** Resend (Email briefs & magic links), Twilio (SMS dispatch alerts)
- **PDF Generation:** `@react-pdf/renderer` for client run-sheets, talent briefs, and instant COI dispatch
- **Hosting & Edge Deployment:** Vercel Edge Network

---

## 3. Multi-Tenant Database Schema (Neon Postgres / Drizzle ORM)

```sql
-- Schema Definition: PostgreSQL / Drizzle

-- 1. Tenants (Franchise Nodes)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL, -- e.g., "Crossroads Columbus", "Crossroads Nashville"
    slug VARCHAR(100) UNIQUE NOT NULL, -- "columbus", "nashville"
    domain VARCHAR(255), -- "crossroadsweddingco.shop", "nashvilleweddingco.com"
    stripe_account_id VARCHAR(255),
    royalty_rate NUMERIC(4, 3) DEFAULT 0.070, -- 7% platform fee
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Users & Roles
CREATE TYPE user_role AS ENUM ('super_admin', 'franchise_owner', 'talent', 'client');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Talent Profiles (Musicians, DJs, Bartenders)
CREATE TABLE talent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    skills TEXT[] NOT NULL DEFAULT '{"dj", "mc"}', -- 'dj', 'mc', 'acoustic_guitar', 'acoustic_vocals', 'bartender'
    base_payout_rate NUMERIC(10, 2) DEFAULT 750.00,
    stripe_connect_account_id VARCHAR(255),
    payout_percentage NUMERIC(4, 3) DEFAULT 0.750,
    bio TEXT,
    headshot_url TEXT,
    rating_avg NUMERIC(3, 2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Planning Center-Style Talent Blockout Dates
CREATE TABLE talent_blockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID REFERENCES talent_profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_talent_blockouts ON talent_blockouts (talent_id, start_date, end_date);

-- 5. Weddings / Events Master Record
CREATE TYPE event_status AS ENUM ('inquiry', 'deposit_paid', 'talent_assigned', 'planning_locked', 'in_progress', 'completed', 'cancelled');

CREATE TABLE weddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    access_token VARCHAR(64) UNIQUE NOT NULL, -- UUIDv4 / secure token for client magic portal
    client_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    couple_names VARCHAR(255) NOT NULL, -- e.g., "Jordan Hayes & Taylor Morgan"
    event_date DATE NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT NOT NULL,
    venue_contact_email VARCHAR(255),
    venue_requires_coi BOOLEAN DEFAULT true,
    package_type VARCHAR(100) DEFAULT 'standard_dj_mc', -- 'standard_dj_mc', 'hybrid_acoustic', 'full_suite'
    addons JSONB DEFAULT '[]'::jsonb, -- e.g., [{"type": "acoustic_ceremony", "fee": 400.00}]
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    is_deposit_paid BOOLEAN DEFAULT false,
    is_balance_paid BOOLEAN DEFAULT false,
    status event_status NOT NULL DEFAULT 'inquiry',
    assigned_talent_id UUID REFERENCES talent_profiles(id) ON DELETE SET NULL,
    secondary_talent_id UUID REFERENCES talent_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_weddings_event_date ON weddings (tenant_id, event_date);
CREATE INDEX idx_weddings_access_token ON weddings (access_token);

-- 6. Planning Center-Style Timeline Items (Real-Time Run Sheet)
CREATE TABLE timeline_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    title VARCHAR(255) NOT NULL, -- "Acoustic Prelude", "Processional", "Grand Entrance", "First Dance", "Dinner", "Speeches"
    category VARCHAR(100) DEFAULT 'ceremony', -- 'pre_ceremony', 'ceremony', 'cocktail', 'reception', 'dance'
    scheduled_start_time TIME NOT NULL,
    estimated_duration_minutes INT NOT NULL DEFAULT 10,
    actual_start_time TIMESTAMPTZ, -- Real-time drift tracking
    is_completed BOOLEAN DEFAULT false,
    mc_notes TEXT, -- "Introduce bridal party in this exact sequence..."
    cue_notes TEXT, -- "Fade in at chorus (0:45), volume at 80%"
    assigned_role VARCHAR(50) DEFAULT 'dj', -- 'dj', 'acoustic_musician', 'coordinator', 'bartender'
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_timeline_wedding ON timeline_items (wedding_id, order_index);

-- 7. Music Stand & Cue Attachments (Chords, Cues, Tracks)
CREATE TABLE music_cues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    timeline_item_id UUID REFERENCES timeline_items(id) ON DELETE CASCADE,
    cue_type VARCHAR(100) NOT NULL, -- 'processional', 'recessional', 'grand_entrance', 'first_dance', 'father_daughter', 'mother_son', 'cake_cutting'
    track_title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    spotify_url VARCHAR(500),
    time_cue VARCHAR(100), -- "Drop needle at 0:42, fade out at 2:15"
    key_signature VARCHAR(10), -- e.g., "Key of G", "Capo 2" for live acoustic
    chord_chart_content TEXT, -- ChordPro format or markdown chord sheet
    audio_file_url VARCHAR(500),
    is_live_performance BOOLEAN DEFAULT false -- true if acoustic, false if DJ playback
);

-- 8. VIP Pronunciation & Bridal Party Roster
CREATE TABLE vip_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    role VARCHAR(100) NOT NULL, -- 'Maid of Honor', 'Best Man', 'Father of Bride', 'Mother of Groom'
    full_name VARCHAR(255) NOT NULL,
    phonetic_spelling VARCHAR(255) NOT NULL, -- "Jordan Hayes (JOR-din HAYZ)"
    entrance_song_override VARCHAR(255),
    notes TEXT
);

-- 9. Music Playlists & Blacklists
CREATE TABLE playlist_curations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'must_play', 'play_if_possible', 'cocktail_vibe', 'dinner_vibe', 'do_not_play'
    track_title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    spotify_id VARCHAR(100),
    notes TEXT
);

-- 10. Automated Talent Dispatch Cascade
CREATE TYPE dispatch_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE talent_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    talent_id UUID REFERENCES talent_profiles(id) ON DELETE CASCADE,
    dispatched_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    status dispatch_status DEFAULT 'pending',
    response_at TIMESTAMPTZ,
    payout_offered NUMERIC(10, 2) NOT NULL
);

-- 11. Inbound Leads (The Knot / WeddingWire Lead Ingestion)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL, -- 'the_knot', 'wedding_wire', 'organic_seo', 'instagram'
    raw_payload JSONB,
    bride_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    target_date DATE,
    venue_name VARCHAR(255),
    auto_provisioned_wedding_id UUID REFERENCES weddings(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'provisioned', 'contacted', 'booked', 'lost'
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Planning Center-Inspired Production Engine

### 4.1 Automated Talent Dispatch Matrix
Eliminates manual text/call chains through automated availability querying and timeout cascades:

```
[ New Client Deposit Paid ($500) ]
                 │
                 ▼
[ Query Talent in Tenant Pool where Event Date NOT IN (talent_blockouts) ]
                 │
                 ├─► Match by Skill Match (e.g., DJ + Acoustic Guitar)
                 ├─► Send SMS/Email with 24-hr Expiration & Accept/Decline Token
                 │
  ┌──────────────┴──────────────┐
  ▼                             ▼
[ Talent Clicks "Accept" ]     [ Decline or 24h Timeout ]
  │                             │
  ├─► Assign to `weddings`      └─► Cascade to Next Ranked Talent in Pool
  ├─► Lock Calendar Date
  └─► Auto-email Intro to Couple
```

### 4.2 "Crossroads Live" (Dynamic Run-Sheet & Live-Drift Engine)
A synchronized, mobile-optimized live production clock for DJs, MCs, and Day-of Coordinators:

* **Estimated Timeline Calculation:** Each block computes dynamic start times based on preceding durations.
* **Live-Drift Detection:** When an MC marks a timeline block as started (`actual_start_time`), the system calculates the delta against `scheduled_start_time`.
* **Dynamic Cascade:** If speeches run 18 minutes over schedule, all downstream events (First Dance, Open Floor, Last Song) automatically shift +18 minutes in real time.
* **Synchronized Web View:** Photographers and Venue staff access a zero-auth, read-only live URL (`crossroadsweddingco.shop/live/[token]`) to stay aligned without verbal interruption.

### 4.3 The "Music Stand" & Acoustic Chord Transposer
Directly inside the timeline run sheet, acoustic performers access chord sheets formatted in ChordPro:
- Built-in dynamic key transposition (+1/-1 semitone, Capo calculator).
- Embedded audio scratch tracks and tempo/metronome markers.
- Seamless DJ transition cues (e.g., *"End acoustic set at 4:15 PM -> Start DJ Cocktail House Playlist 1 immediately"*).

---

## 5. Client Planning Portal (PWA Architecture)

### 5.1 Onboarding & Access Flow
- **Magic Link Tokenization:** No passwords or app store installs. Couples receive a persistent link (`/hub/[token]`) upon deposit payment.
- **PWA Prompt:** Web manifest and iOS/Android "Add to Home Screen" prompt for 1-tap mobile dashboard access.
- **Debounced Auto-Save Engine:** Real-time form synchronization with 500ms debounce directly into Neon via Next.js Server Actions.

### 5.2 Three-Stage Progressive Milestone UI
To prevent cognitive overload, the portal reveals modules in chronological phases:

1. **Stage 1: Foundation (Post-Booking -> 90 Days Out)**
   - Venue coordinates, load-in specifications, vendor team contacts (Photographer, Caterer).
   - High-level aesthetic profile (Genre preferences, decade sliders, energy curve).
2. **Stage 2: Formal Cues & VIP Roster (90 Days -> 14 Days Out)**
   - Processional, Recessional, Grand Entrance, and First Dance track selectors (Spotify search integration).
   - VIP Pronunciation Recorder & Phonetic Spellings (Voice memo upload or text-to-speech check).
   - The "Do Not Play" Blacklist (Hard veto for specific tracks or genres).
3. **Stage 3: Production Lock (14 Days Out -> Event Day)**
   - Final schedule sign-off and timeline lock.
   - Automated 1-page PDF export for venue approval and talent load-in.

---

## 6. Lead Ingestion & Conversion Optimization

### 6.1 The Knot & WeddingWire Lead Bridge
* **Email / Webhook Parser:** An edge route (`/api/webhooks/inbound-lead`) parses incoming lead notification emails from The Knot Worldwide.
* **Instant Provisioning (Sub-60-Second SLA):**
  1. Creates an unconfirmed booking record in `weddings`.
  2. Generates a personalized proposal URL (`crossroadsweddingco.shop/quote/[slug]`).
  3. Dispatches automated SMS & Email: *"Hey [Name]! Got your inquiry on The Knot. Your $1,000 flat-rate quote and custom planning portal are ready here: [Link]"*
* **Competitive Bypass:** Pulls couples directly out of the congested multi-vendor lead inbox into a dedicated branded portal.

### 6.2 SEO Architecture & Programmatic Landing Pages
- **Target Keywords:** `wedding dj columbus in`, `budget wedding dj bloomington`, `flat rate wedding entertainment indiana`, `wedding acoustic musician cocktail hour indy`.
- **Dynamic Routing:** `/[state]/[city]/wedding-dj` (e.g., `/in/columbus/wedding-dj`, `/in/bloomington/wedding-dj`, `/in/nashville/wedding-dj`).
- **Structured Data:** Full `LocalBusiness` / `EntertainmentBusiness` JSON-LD schema on all city pages. `AggregateRating` ships only once genuine, on-page reviews exist (see §9.1) — rating markup without visible reviews violates Google's guidelines and risks a manual action.

---

## 7. Implementation Roadmap & Milestones

```
PHASE 1: Core Foundation & Booking Engine (Weeks 1–2)
├── Next.js 14 App Router setup with Tailwind & shadcn/ui
├── Neon Postgres connection + Drizzle ORM schema deployment
├── Transparent $1,000 flat-rate landing page + City landing pages
├── Stripe Checkout integration for $500 retainer deposits
└── COI vault & auto-dispatch (store the insurer-issued certificate, auto-send to venues on request — see §9.1)

PHASE 2: Client Planning Portal (PWA) (Weeks 3–4)
├── Tokenized magic link client portal (`/hub/[token]`)
├── Debounced auto-save timeline builder
├── Spotify search & playlist curation module
├── VIP phonetic pronunciation intake
└── 1-Page Talent Run Sheet PDF compilation

PHASE 3: Talent Dispatch & "Crossroads Live" (Weeks 5–6)
├── Talent profile management & blockout calendar
├── Automated SMS/Email dispatch cascade engine
├── Real-time "Crossroads Live" drift-tracking run sheet
└── Acoustic Music Stand (ChordPro renderer & key transposer)

PHASE 4: Multi-Tenant Franchise Rollout (Weeks 7–8)
├── Tenant isolation logic (`tenant_id` RLS / query scoping)
├── Stripe Connect custom payout splits (Talent 75% / Franchisee 18% / Platform 7%)
├── Inbound lead scraper & auto-provisioning bridge
└── Franchise Admin Dashboard (Volume, P&L, Talent Roster)
```

---

## 8. Claude Code Guidelines & Execution Directives

1. **Database Queries:** Always write modular queries using Drizzle ORM with explicit relations and tenant scoping (`where: eq(table.tenantId, currentTenantId)`).
2. **Server Actions:** Validate all form mutations using `zod` schemas before executing database writes.
3. **Component Structure:** Keep UI components atomic under `@/components/ui`, feature components under `@/components/features/[feature-name]`, and layout wrappers under `@/components/layouts`.
4. **Zero-Fluff Error Handling:** Wrap all external API integrations (Stripe, Twilio, Resend, Spotify) in structured try-catch blocks with descriptive server-side error logging.
5. **No Client Secrets:** Ensure all Stripe secret keys, Twilio auth tokens, and Neon direct connection strings remain strictly confined to server-side environments.

---

## 9. Implementation Notes: Repo Reality (maintained by Claude Code)

### 9.1 Corrections to the original spec
1. **COI:** A Certificate of Insurance is issued by the insurer. The platform stores the real
   certificate and auto-dispatches it to venues; it never generates one.
2. **AggregateRating:** rating JSON-LD is withheld until real reviews are collected and displayed
   on-page. Shipping it earlier is a documented Google-penalty trigger.

### 9.2 Decisions made after the spec was written (owner-confirmed)
- **Add-on pricing (2026-08-26, Jacob; sharpened 2026-08-27 with Nic; raised to $500
  2026-08-27 after the WeddingPro meeting with Adam):** the acoustic package is a
  **live SOLO acoustic set**, flat $500, published: one performer, singer-songwriter
  style, ceremony or cocktail hour, one hour preferred and two hours absolute max, and
  up to three requested songs learned per wedding with adequate notice (the rest comes
  from the standing repertoire). Bartending is a **$500 minimum, never a quote on the
  site**: copy must read as "minimum, real number on the intro call" because shelf and
  guest count move the price. The booking flow adds $500 to the total for acoustic;
  bartending is stored as an interest flag with a $500 floor. Both were $400 until
  2026-08-27; the spec's §1.2 add-on table predates the change.
- **Bar service is priced per bartender (2026-10-03, Jacob), replacing the $500
  minimum:** $250 for one bartender, $400 for two. This is a model change, not a
  number change: there is no "minimum" any more, so no copy, quote, or structured
  data may reintroduce that framing. Guest count decides the crew size, the crew
  size decides the price, and the number quoted at booking is the number paid.
  `BARTENDER_MIN_USD` is gone; `BARTENDER_ONE_USD`, `BARTENDER_TWO_USD` and
  `bartenderFeeUsd(staff)` replace it, and tsc catches any stale consumer. The
  /book form carries a one-or-two picker (owner directive, same day) so the total
  shown at booking is final; `addons` now stores `{type:"bar_service", fee, staff}`
  where it used to store `{fee:null, minFee:500}`, and `bartenderStaffFromAddons`
  reads older rows as one bartender, which is how they were all sold. The
  agreement names the crew size and both published rates, and says the price moves
  only between them if the guest count changes. CONTRACT_VERSION bumped to
  2026-10-03. NOT YET REFLECTED: the published main reel's recorded voiceover still
  says "five hundred is the minimum" at 0:14; the on-screen text is corrected in
  `scripts/generate-reel.mjs` but the mp4 needs a re-record before it is re-rendered.
- **Bar service is serve-only, never sell (standing until legal review says otherwise,
  2026-08-27):** the couple or venue provides the alcohol; we staff and pour. Selling or
  marking up alcohol in Indiana requires a quota-bound three-way retailer permit (secondary
  market $20k+) plus a supplemental caterer's permit, so no copy, quote, or feature may
  imply we supply or sell alcohol. At licensed venues we work under the venue's permit.
- **Balance due 24 hours after the wedding's START time (2026-08-27, Jacob and Nic).**
  Supersedes the spec's "auto-charged 14 days prior" in §1.2: nobody pays in full for a
  service not yet rendered. A 3 PM wedding means paid by 3 PM the next day. Start time is
  the anchor because the end time is never known in advance. The same 24 hours is the
  couple's window for comments, concerns, and criticisms about the day, and the invoice can
  be adjusted based on performance; the contract must state this plainly. No public site
  copy ever promised the old timing, so this is contract + docs only.
- **Deposits are cash and check for roughly the first 4 months (2026-08-27, Jacob).** Stripe
  stays scaffolded and gated off; do not prioritize Stripe keys or build further payment
  automation until Jacob says so. Site and email copy already read "payment details come with
  the confirmation", which covers cash/check with no change.
- **Intro call:** 30 minutes, booked via the contact-section card
  (`NEXT_PUBLIC_BOOKING_URL`, Google Calendar appointment schedule).
- **Service area:** based in Columbus, Indiana; two-hour radius, Indianapolis, Bloomington,
  Nashville (IN), Louisville (KY), Cincinnati (OH). Encoded in `lib/cities.ts` and the
  homepage `areaServed` structured data.
- **Spotify is a priority integration (2026-08-26, Jacob):** the target market curates its own
  playlists in Spotify, so the platform meets them there. Flow: couples build playlists in
  their own account and share the links. One link is captured at booking
  (`weddings.spotify_playlist_url`); the hub manages a labeled list of them
  (`weddings.spotify_playlist_urls` jsonb, "Add a playlist" per Jacob 2026-08-27, since
  couples split cocktail hour, dinner, and dance floor into separate playlists). Ingestion
  into `playlist_curations` via the client-credentials API once
  `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` exist. Write-back (collaborative playlists from
  our side) requires the OAuth authorization-code flow, Phase 3+.

- **Communication strategy (2026-08-27/28, Jacob, the "AppFolio model"):** one master
  message thread per wedding, stored in our platform (`wedding_messages`), NOT in email.
  Couple writes from the hub's Messages tab; Jake and Nic both read and reply from the
  admin dashboard, each reply labeled with the teammate's first name, and the couple sees
  one fluid Crossroads thread. Email's only job is getting the couple INTO the hub: all
  transactional email sends from **booking@crossroadsweddingco.shop** and says plainly
  "don't reply to this email, message us in your hub"; team replies trigger a pointer
  email only ("new message in your hub"), never the content. Couples can download their
  conversation any time. Jacob must keep booking@ alive as a Workspace alias/group
  (deliver to him and Nic) so strays never bounce. SMS will later become a second door
  into the same thread (the AppFolio text behavior); that waits on Twilio.

- **A la carte standalone services + site as directory (2026-08-28, Jacob, confirmed to
  Adam at WeddingPro):** the acoustic set and bar service are sold standalone, bolted onto
  weddings where someone else is the DJ, at the same $500 (acoustic flat, bar minimum).
  The framing to protect everywhere: DJ and MC is $1,000 flat; acoustic or bartending on
  their own are $500; never let $500 read as the DJ price. The site grows from a landing
  page into a service directory: shareable pages at `/acoustic` and `/bartending`
  (footer-linked like the city pages), plus a "Who you get" team section. The /book form
  is service-aware (shipped 2026-08-29): three service cards (DJ $1,000 / acoustic $500 /
  bar from $500), any combination, at least one required; the service pages deep-link
  with ?service=acoustic|bartending; DJ-less bookings store package_type 'a_la_carte'
  with deposit_amount capped at the quote. OPEN OWNER DECISION: the a-la-carte deposit
  amount; all copy for DJ-less bookings deliberately promises no number ("deposit details
  come with your confirmation").
- **Brayton (SPELLING UNCONFIRMED, heard "Braiton"; 2026-08-28, Jacob; NOT yet approved
  by Nic, so nothing public until Jacob confirms):** roommate/best friend, strong on sound
  engineering and people. Planned as Chief Business Officer (org sketch: Jacob CEO, Nic
  COO, Brayton CBO), same model as Nic: 3 weddings/month in 2027, $2,000/month baseline
  with upside. When approved: add him to `lib/team.ts` (appears on the site instantly)
  and to the partner-economics records.

- **Back to Jake and Nic only (2026-10-06, Jacob: "Brayton and Ashton need to be
  scraped from the site and it's just Jake Nic for now").** Both came out of
  `lib/team.ts`, which is the only edit the removal needed: `lib/schedulers.ts`
  derives from TEAM and skips a slug with no entry, so `/book?with=brayton` and
  `?with=ashton` fall through to the ordinary booking page rather than 404ing a
  printed QR code. Their slugs STAY listed in `BOOKABLE` and must never be
  reused for a different person, because the cards are printed. `TEAM_NAMES`
  (hub-constants) drops to Jake and Nic, so the admin reply picker offers only
  people who can actually reply; `isTeamName` already guards localStorage, so a
  device holding "Brayton" falls back to Jake instead of breaking. Their seeded
  `office_hours` rows are left in place, harmless: the booking API re-derives
  every slot from `findScheduler`, which now returns null for them, so nothing
  can be booked against those hours. Restoring either person is putting their
  entry back in `lib/team.ts` and nothing else.
- **Correction (2026-11-01, Jacob): the first wedding was October 17 at Valle Vista Golf
  Club & Conference Center, Greenwood.** It went very well with strong reviews; the venue
  coordinator was on her third wedding. Valle Vista is now the warmest venue lead. Kat's
  November 7 wedding below is the second, not the first.
- **Kat McKinney's wedding is the first live one: November 7 (2026-08-28, Jacob).**
  Partner is **Tanis** (confirmed 2026-08-30 from her own hub record; the earlier
  "tennis" was a voice-transcription artifact). Married name on her run sheet: **Copeland**.
  Venue: **Forge on 4th, 418 4th St, Columbus, IN 47201**. Jacob DJs; the new partners shadow (Kat's permission requested by
  Messenger). The couple gets workshop status: features get trialed with them first.
  Their deal includes the pilot referral program: for each future wedding they refer
  that books, the referrer gets $75 and the referred couple gets $25 off, capping our
  cost at $100 per referred wedding, applying only to referred bookings. Software
  tracking for referrals is future work; for now it lives in this record and the
  contract. The hub's "Your email" field (Details section) was added same-day so
  Jacob can put Kat's real email on her booking record himself.

- **Service agreement (2026-08-30, Jacob asked for it):** plain-language contract generated
  from `lib/contract.ts` off the same constants as the site, so a price can never differ
  between what a couple reads and what they sign. Couple reads and accepts at
  `/hub/[token]/contract` (typed name + explicit checkbox, same magic-link credential as
  the rest of the hub); acceptance writes `contract_accepted_at/name/version` plus a
  `contract_snapshot` jsonb freezing the exact terms, so later edits to the wedding row
  can never rewrite what was agreed. Re-accepting is refused (409), not overwritten. Clauses
  encode the standing decisions: balance 24h after start time with that window doubling as
  the comments-and-concerns period and the invoice adjustable, serve-only bar (host provides,
  we never sell or supply, ATC permits, venue permit at licensed venues), cash/check for now,
  acoustic 1hr/2hr max and 3 learned songs with 30 days notice, travel surcharge, cancellation
  (deposit non-refundable; 50% of remainder inside 30 days), our-cancellation full refund,
  force majeure, gear damage, marketing photo use with opt-out by message. `CONTRACT_VERSION`
  bumps on any wording change so snapshots stay traceable. **NOT lawyer-reviewed: Jacob should
  have an Indiana attorney read it before it carries real weight.**

- **Countersignature and the printed copy (2026-10-20, Jacob):** a couple is handed a
  hard copy, so the agreement must show both sides signed and dated on paper. The
  couple's typed acceptance is their signature; the company now signs too, once, from
  `/admin/[key]/contract/[weddingId]` (dashboard "Agreement" button), typed name + title +
  explicit checkbox, writing `contract_countersigned_at/name/title`. Only after the couple
  has accepted, never overwritten: the conditional UPDATE carries both rules, verified with
  three simultaneous POSTs (one 200, two 409). Both the couple's hub copy and the owner's
  copy end in one shared `SignatureBlock`: each party's typed name in a script face, the
  printed name, title, and the date in bold, with the signing time and an electronic-
  signature line (Indiana UETA, IC 26-2-8, and E-SIGN). An unsigned side prints blank ink
  lines so paper can still be finished by pen. The owner page's print button masks the
  admin key out of the browser's print header. Countersigning does not touch the frozen
  snapshot or `CONTRACT_VERSION`.
- **Custom arrangements + owner write access (2026-08-30, Jacob):** some weddings predate
  the pricing model or settle in trade (Kat & Tanis: equipment plus cash, deposit and
  balance already square). `weddings.custom_terms` holds free text that replaces the
  agreement's cost section verbatim, and the dashboard gained its first write surface, an
  "Edit money" panel per booking (total, deposit received, balance settled, custom
  arrangement) behind `PATCH /api/admin/[key]/wedding/[id]`. This deliberately relaxes the
  earlier read-only dashboard rule: the money fields have no couple-facing home, so the
  owner needs somewhere to set them. Everything else about a wedding still comes only from
  the couple's hub.
- **Songs are the rows (2026-08-30, Jacob, second pass):** the big-moment grid became
  song cards. Each moment card takes the song's own Spotify link (`music_cues.spotify_url`,
  parsed by `parseTrackId`) and renders Spotify's compact single-track player inline, with
  a notes column beside it and a played-live checkbox in the card header. No link yet means
  plain track and artist boxes instead, so nothing depends on Spotify. This is the shape
  Jacob asked for: annotate the song itself rather than name it in a form.
- **Music is one section (2026-08-30, Jacob):** the hub's two music cards merged into a
  single "Music" card: playlists with their embedded players at the top, then the big
  moments, then must-play and do-not-play. Playlist panels stay MOUNTED once opened and are
  hidden with CSS when collapsed, so the embed never reloads and several can stay open at
  once while the couple picks songs. Each big moment is now a collapsible row (summary line
  when closed) holding track, artist, a free-text note, and the live-on-guitar checkbox;
  `music_cues.notes` is additive and prints on the run sheet under its moment. A cue row
  with only a note typed still saves.
- **Spotify playlists embed natively (2026-08-30):** unfolding a playlist in the hub now
  renders Spotify's own iframe player (`open.spotify.com/embed/playlist/{id}`), which needs
  no API, no keys, and no login from us, and plays full tracks for any viewer already
  signed into Spotify in that browser (30-second previews otherwise). The API-backed track
  list with send-to-a-moment still sits below it and lights up when SPOTIFY_REFRESH_TOKEN
  lands; until then that area shows a quiet line instead of an error. Dragging a song out
  of the iframe into our page is impossible by browser design (cross-origin), so
  tap-to-send stays the mechanism.

- **The couple's documents are the official record (2026-08-30, Jacob):** a couple who has
  already sent guests an order-of-events graphic, a wedding-party card and a printed
  timeline is working from those, not from us. Our run sheet SHADOWS their paperwork, and
  the couple must be able to audit one against the other without leaving the hub. So
  `wedding_documents` stores their files (bytes in Postgres: no blob store is configured,
  it is a handful of images per wedding, and a document must never outlive its wedding
  row), and the hub's "Your documents" section sits directly ABOVE the schedule. Upload
  and remove are per-file requests, deliberately outside the debounced autosave engine.
  Only inert types are accepted (PNG, JPG, WEBP, GIF, HEIC, PDF: no SVG, no HTML, both
  execute script from our own origin), 4 MB each to stay under Vercel's 4.5 MB body cap,
  12 per wedding. The file route is scoped to the token's own wedding and answers with
  nosniff plus a CSP sandbox.
- **Guest order of events (2026-08-30):** `/schedule/[share_token]` renders the couple's
  timeline as a guest-facing schedule, times and titles only, never the MC notes on the
  same rows. Same zero-auth read-only token as the vendor live view. It reads live data,
  so unlike an exported graphic it cannot drift from the run sheet.

- **/messaging is a proxy, not part of this app (2026-10-13, Jacob).** Crossroads Private
  Line, the encrypted 1-to-1 text, voice and video tool, lives in its own repo
  (Legal-Leaf-Market/messaging), deployed on Netlify as messging.netlify.app, and is served
  here at crossroadsweddingco.shop/messaging/. `netlify.toml` proxies it at Netlify's edge
  (proxy rule first, then the /messaging 301, because Netlify normalizes trailing slashes),
  and `next.config.mjs` `rewrites()` does the same on any other host. Do not add a route,
  middleware or Permissions-Policy header that covers /messaging: the tool needs the camera
  and microphone on this origin. Change the tool in its own repo, not here.
- **The live site is on Netlify, not Vercel (owner-confirmed 2026-10-13).**
  crossroadsweddingco.shop answers with `server: Netlify`; Netlify project
  comforting-kataifi-0c8252 builds from `main`. References to Vercel elsewhere in this file
  predate the move. Consequence still open: Netlify ignores `vercel.json`, so the daily
  `/api/cron/checkins` job declared there does not run until it is recreated as a Netlify
  scheduled function. Environment variables now live in Netlify's site settings.

- **Getting off WeddingPro, and lead attribution (2026-11-01, Jacob).** WeddingPro is
  the only lead source and it is going away; the plan is `docs/GET_OFF_WEDDINGPRO.md`
  (venues and vendors first, Zola, Google Business Profile, referrals, print, the Feb
  bridal expo, and a small Roku/Hulu test in January). Every booking now records where
  the couple found us: `weddings.lead_source` (the "How did you find us?" answer),
  `lead_source_detail` (who: the friend, the venue) and `lead_src_tag` (the `?src=` tag
  the visitor first arrived with, remembered 120 days by `SourceCapture`). The list of
  sources and tags is `lib/lead-sources.ts` and nothing else; tags go on paper and in
  ads, so ADD, NEVER RENAME. `/tv` is the TV vanity URL (307 to `/?src=tv`). The
  dashboard opens with a per-channel tally, and an unknown source value is dropped,
  never refused, so attribution can never cost a booking. Do not build couple
  prospecting from registries (Target, Amazon, Zola): no bulk access, against their
  terms, and spam-law exposure.
- **Corporate and event rate: $1,500 flat for DJ and sound (2026-11-01, Jacob).**
  `CORPORATE_DJ_SOUND_USD` in `lib/site.ts`. A **$1,000 deposit** locks a corporate
  date (`CORPORATE_DEPOSIT_USD`), against $500 for weddings. The $1,000 wedding rate is never quoted for
  a corporate event; acoustic and bar staff are quoted per event. The business is
  **renamed Crossroads Wedding and Event Co. everywhere (2026-11-01, Jacob: "change the
  name everywhere")**: `SITE_NAME` in `lib/site.ts` drives the header, titles, emails, the
  agreement and the JSON-LD `name` (`alternateName` keeps the old "Crossroads Wedding Co."
  so search engines connect the two). `EVENT_BRAND_NAME` is now an alias of `SITE_NAME`.
  `CONTRACT_VERSION` bumped to 2026-11-01 because the agreement names the company;
  accepted snapshots keep the old name. The domain stays crossroadsweddingco.shop. Not yet
  changed: the printed trifold and business cards, rendered images and reels (their
  generator scripts now say the new name), and any `RESEND_FROM` override in Netlify. The homepage leads with corporate for the holiday season: a `HolidayBanner` strip
  above the header ($1,500 flat, "December dates are still open", no invented scarcity),
  "Book your holiday party" as the primary hero button, and a corporate card beside the
  wedding card. The header nav gained "Corporate events" (/events) on every page. `/events` (footer-linked, in the sitemap) is the corporate
  page: $1,500 for DJ and sound, acoustic and bar quoted per event, calls go to
  `/book?with=jake`. Partner pitches for Ryan Furr (Ryan Furr Creative, Indiana
  Sentinels) and Matty Ortega (Matty O Entertainment / MOE) are cards in the committed
  playbook's "Partners: walk in first" section (PR #83), and the playbook carries a
  weekly goal tracker ($5,000 in deposits: 2 weddings at $500, 4 corporate at $1,000)
  that saves to the artifact's `booked` collection; on the site copy it is local only.
- **Three paths: weddings, corporate events, private parties (2026-11-01, Jacob).** Weddings
  are the specialty and lead the hero and nav; corporate stays $1,500 flat; private parties
  (birthdays, Halloween, graduations, anniversaries) live at `/parties` and both the DJ and
  the bar are **quoted on the call** (owner's answer), so that page carries no price and no
  JSON-LD Offer. The bar rules are written once in `components/BarRules.tsx` with a per-path
  tail and shown on `/bartending`, `/events` and `/parties`: serve-only, ATC permits, venue
  permit at licensed venues, 21+ and ID checks, no service to the visibly intoxicated, and for
  private parties no cash bar, no drink tickets for sale, no cover that includes drinks.
- **Holiday party call list and venue referrals (2026-11-01, Jacob).** The Nov 1 call
  list (venues, planners, Nov to Dec events, chamber members) is built into the
  "Crossroads Lead Playbook" artifact (claude.ai/artifact/C2wNZGNDXoDWv7YK5dfkz1) with a
  shared call log. Jake, Nic and Terry are partners and all call from it; a "Calling as"
  picker fills each person's name and number into the scripts. So partners on another
  claude.ai account can reach it, a copy is served at `/admin/<ADMIN_DASH_KEY>/playbook`
  (Jacob, 2026-11-01): source `content/playbook/crossroads-playbook.html`, rebuilt into
  `lib/playbook-html.ts` by `node scripts/build-playbook.mjs`. The site copy has its own
  shared call log (2026-11-06, Jacob: "make this a static link that saves the changes we make"):
  `playbook_calls` and `playbook_bookings` behind `/api/admin/[key]/playbook`, which the page
  reaches through `window.CR_PLAYBOOK_API` and polls every 15 seconds. It is separate from the
  claude.ai copy's log, which this repo cannot read. Notes saved on a device before it connected
  are uploaded once. The "New as of 11.6.26" list filter shows leads with `fresh:1`; `also`
  puts a lead in a second section's filter. Steven is in the "Calling as" picker (2026-11-02), number (336) 684-8418 in `NUMS`. Every list puts dated leads first, most urgent on top (Jacob, 2026-11-02: "if there is ever a date associated, place this in the most urgent to least urgent order"): a lead's date is the earlier of its follow-up date (overdue follow-ups lead) and its upcoming `when` event date; undated leads follow by stars; past event dates sink to the bottom. Each dated card shows a chip (overdue/today in red, within a week in amber). "Best 10 for today" keeps its fixed call order. The "Nov to Dec events" section leaves out anything on Nov 6 or 7 because the Kat and Tanis wedding has the crew and gear that weekend (Jacob, 2026-11-02). Every lead carries a 1 to 5 star rating (Jacob, 2026-11-02, "that's totally a sales thing"): 5 = confirmed they need a DJ (they told us or posted it), 4 = warm or entertainment not set, 3 = their page shows a fit, 2 = real contact with no sign of need, 1 = long shot. Starting ratings live in `STARS` in the playbook and come only from what each listing says; a caller's rating and reason, saved in the log as `stars`/`starWhy`/`starBy`, replace them. Sections sort by stars (events stay in date order) and "Hottest first" lists everything by stars. Personal-connection leads (Jacob, 2026-11-02): Andrew Sutherland (Sutherland's Exteriors, LLC, confirmed on the NC registry) and Tim (Victory Roofing, unconfirmed, marked "Needs verification") sit in Partners; the Crump Theatre and the Tony Stewart Foundation (reported closing at the end of 2024, flagged) sit in Venues. Their cards carry business facts only: no personal phone numbers (Jake has them), nothing about anyone's private life, and the year and details of the Crump fundraiser stay out of public copy until Jacob confirms. Scripts say "Jake", never "Jake Kennedy", because the Calling-as picker swaps the first name. `docs/EVENT_LEAD_RESEARCH_BRIEF.md` is the Claude in Chrome research brief for the event leads; its results come back in a fixed block format meant to update `STARS` and each lead's `why`. **The call list IS in git, in a public repo, on purpose**
  (Jacob, 2026-11-01, asked and answered after being told it would be readable on
  GitHub): every entry came from a public listing. This supersedes the earlier rule that
  contact data stays out of git. Do not delete or scrub the file as a leak; editing a
  contact is fine. The claude.ai copy does not sync: an edit there needs the HTML
  updated, the build script run, and a push. Valle Vista leads that list, since the October 17 wedding outranks
  anything a web search found. On the site: `/events` has a "For venues and event
  planners" section handing out `crossroadsweddingco.shop/events?src=venue` (`planner`
  is also a tag, mapping to "vendor"). Corporate inquiries arrive as intro calls, not
  weddings rows, so `appointments.src_tag` now stores the first-touch tag and the
  team's call-booked email says where the caller came from. `SourceCapture` no longer
  tags an internal click on "Book a call with Jake" as a printed card: "card" is
  inferred only when `/book?with=` arrives without a same-origin referrer. The dashboard's
  "Booked intro calls" section lists upcoming calls (from yesterday on, not cancelled)
  with who they're with, contact, their date, notes and the link tag, so a venue
  referral is visible without the email.
- **Invoices and corporate bookings (2026-11-02, Jacob: "build build build ... invoicing first").**
  Every booking card on the dashboard has an **Invoice** button opening
  `/admin/[key]/invoice/[weddingId]`, printable to one Letter page (the print button masks the
  admin key, like the agreement). `lib/invoice.ts` is pure and builds it from the booking row
  and the `lib/site.ts` prices: line items from the services, and the STORED total is the
  truth, so if "Edit money" sets a different total one "Additional" or "Adjustment" line makes
  the lines add up rather than inventing a price. Custom terms replace the line items. Before
  the deposit lands, "Deposit due now" is the amount due and the balance shows separately;
  after, the balance is due 24 hours after the start time (the corporate rule is assumed to
  match weddings until Jacob says otherwise); a settled balance prints a PAID stamp. Payment is
  cash or check to the business name. The number is `CR-<event date>-<first 4 of the id>`,
  stable with no counter. Corporate events are booked by phone, so the dashboard has an "Add
  corporate booking" form (`POST /api/admin/[key]/corporate`) that writes a `weddings` row with
  `package_type = 'corporate'` ($1,500 and $1,000 defaults, editable), minting the same tokens
  and emailing nobody. Corporate rows show a "corporate" chip, hide the wedding Agreement button
  and chip (the agreement is written for weddings; there is no corporate contract yet), and are
  excluded from the check-in texts. The invoice footer is one quiet line pitching the tech and
  process work ("Like how this invoice works? We built it ourselves ... Ask Jake"); point it at
  the tech business's own page once that business has a name. Verified against a real Postgres
  and headless Chromium: corporate and wedding invoices, a discount, a trade deal, the PAID
  stamp, the 404 on a wrong key, no sideways scroll at 390 and 768.
- **Terry is a bookable partner (2026-11-01, Jacob).** `lib/team.ts` has Terry with
  title "Partner" (the only title stated) and `showOnTeam: false`, so `/book?with=terry`
  works and the hours editor lists him, but the public "Who you get" section
  (`PUBLIC_TEAM`) still shows only Jake and Nic until Jacob writes his roles and bio.
  No office hours are seeded for him: he sets them at `/admin/[key]/hours`, and until
  then his page offers no times and hands visitors to the date form. terry@ is not
  printed on a card or confirmed to exist, so set `SCHEDULER_EMAIL_TERRY` in Netlify to
  his real address; the owner is copied on every call regardless. Follow-up text
  automation is parked (Jacob, 2026-11-01: "don't worry about it rn").
- **Three partners with officer titles (2026-11-08, Jacob: "it's now me, Nic and Terry").**
  Jacob is Chief Executive Officer, Nic Chief Operating Officer, Terry (Winchester) Chief
  Business Officer. `TeamMember.executiveTitle` in `lib/team.ts` holds the officer title and
  shows first on "Who you get" and on `/book?with=<slug>`; `title`/`roles` stay the on-the-day
  jobs (Jake Event Producer, Nic Event Manager, Terry Stage Manager: DJ, bar, stage management).
  Terry is on the public team section now (`showOnTeam: false` removed) and in `TEAM_NAMES`, so
  he can reply in the hub thread. His bio says only what Jacob stated: lots of event promotion
  and execution experience, the go-to guy on most things. The countersign form defaults to
  "Chief Executive Officer". This supersedes the earlier "Terry is a bookable partner" note.
- **Reviews page and moderated notes board (2026-11-01, Jacob).** `/reviews` (footer,
  sitemap) is a public board anyone can sign with a name, a "writing about" choice and
  a note, no email or login, so Jacob can send the link to someone like Adam and they
  sign it as themselves. Rows land in `guestbook_entries` as waiting; nothing is public
  until Jake or Nic approves it at `/admin/[key]/reviews` (dashboard link "Reviews to
  approve"), and each new note emails the owner. Moderation is approve, hide or pin to
  top: never edit or delete words, never write, seed or invent an entry, and no stars,
  ratings, or Review/AggregateRating JSON-LD (§9.1). Bots get a honeypot field and a
  per-instance rate limit. Photos and video from real events go in
  `REVIEW_EVENTS` (`lib/review-constants.ts`, files in `public/reviews/<event>/`,
  web-sized); an empty list renders no gallery. The October 17 Valle Vista set is up
  (five photos and a 5-second clip): orientation fixed, long edge 1600, a very light
  contrast and warmth lift, EXIF and GPS stripped, video re-encoded to H.264 720x1280
  with a poster. Light edits only, per Jacob; keep it that way for future sets.
- **crossroadsweddingco.shop is the only domain (2026-10-14, Jacob: "we completely
  abandoned .com").** Web addresses AND email addresses moved to .shop; .com no longer
  exists for us, so nothing may reintroduce it. `SITE_URL` falls back to the .shop host,
  every address in `lib/site.ts`/`lib/schedulers.ts` is `@crossroadsweddingco.shop`, and
  older .com mentions in this file were rewritten in place. Owner-side follow-ups: verify
  crossroadsweddingco.shop as a sending domain in Resend (sends from booking@ fail until it
  is), make sure Netlify's `NEXT_PUBLIC_SITE_URL`, `RESEND_FROM`, `RESEND_NOTIFY_TO` and any
  `SCHEDULER_EMAIL_*` overrides do not still name .com, and register
  https://crossroadsweddingco.shop/api/spotify/callback on the Spotify app. The main reel
  mp4 still shows .com and waits on its voiceover re-record (see bar-pricing note);
  printed business cards carrying a .com QR need reprinting.

- **Multi-tenant signup, first slice (2026-11-09, Jacob: "start on the multi-tenant signup in
  Crossroads", after the EverSet competitor research).** The platform is being opened to other
  wedding and event businesses (DJs first, then planners, photographers, venues). Crossroads is
  the **house tenant** with a fixed id (`HOUSE_TENANT_ID`, `lib/tenant-constants.ts`): the
  migration seeds it, backfills NULL `tenant_id` on `weddings` and `leads`, and sets it as the
  column DEFAULT there and on new `tenant_id` columns on `appointments`, `office_hours` and
  `guestbook_entries` (ON DELETE RESTRICT). So every existing write path lands in the house
  account with no code change. `lib/admin.ts` and the check-in cron are scoped to the house
  tenant: a customer's booking can never appear on the Crossroads dashboard, and its id 404s
  there (verified). Accounts: `tenants.kind` ('house' | 'customer'), `business_type`, `plan`,
  `trial_ends_at` (14 days, no card); the owner is a `users` row with role `franchise_owner`
  (the existing enum value, read as "account owner"; no enum change, since ADD VALUE cannot be
  used inside the migration's single transaction). Sign-in is passwordless (`lib/auth.ts`):
  `login_tokens` (30 minutes, single use) and `user_sessions` (30 days, httpOnly `cw_session`
  cookie) store only SHA-256 hashes. The emailed link opens `/login/verify`, whose button POSTs,
  because mail scanners prefetch GET links. Redeeming is one conditional UPDATE (three
  simultaneous POSTs: one session, two expired). Signup and login answer identically for new and
  existing emails. **Signups stay closed until `SIGNUP_OPEN=1`**, and all account pages are
  noindex. `/app` is the workspace: trial days, the account's own bookings (scoped by the
  session's tenant, never a request parameter) and an honest empty state. NOT YET: customers
  cannot create bookings, hubs or timelines (every booking route still writes the house
  tenant), there is no billing, no per-account branding, Stripe Connect or Twilio, and the
  appointments double-booking index is global on `(person_slug, starts_at)`, which must gain
  `tenant_id` before customers get calendars. There is deliberately no tenant delete: the
  `weddings` and `leads` FKs from the original schema still CASCADE.

- **Customer bookings (2026-11-09, Jacob: "yes, start on customer bookings").** A signed-in
  account adds bookings at `/app/bookings/new` and manages them at `/app/bookings/[id]`
  (details, money, status, archive). `lib/workspace.ts` takes the tenant id from the session
  only and puts it in every WHERE, so another account's id and a wrong id both 404 (verified,
  including a Crossroads booking id from a customer session). Writes also check Origin. A
  booking mints the same hub and share tokens as a Crossroads one, emails nobody, and its
  hub, run sheet, live console, vendor view and guest schedule all work unchanged.
  **Brand on couple-facing pages comes from the booking's account** (`lib/brand.ts`):
  header, run sheet footer, live pages, guest schedule, PWA manifest, AND the tab title and
  link-preview metadata (`brandedMetadata`), because the root layout's defaults otherwise put
  "Crossroads" in the preview a text message shows. Verified: no "Crossroads" anywhere in the
  HTML of a customer's hub pages; house pages are unchanged. **Crossroads-only, gated on
  `isHouseTenant`:** the service agreement (`/hub/[token]/contract` + its API), the Messages
  thread (it emails Jake), and video calls all 404 for customer bookings until each is
  rebuilt per account. `weddings.package_type` holds `EVENT_TYPES` keys for customer rows.

- **Integrations groundwork: Plaid bank and card feeds (2026-11-09, Jacob: "start laying the
  groundwork for integrating with Plaid and Found").** Found has no public developer API
  (checked 2026-11-09; it is a fintech whose accounts sit at Lead Bank), so Found, like any
  bank, is reached through Plaid if Plaid lists it; do not build a direct Found integration
  without a published API. Tables: `integration_connections` (one per Plaid item, unique on
  provider + external id; an item already on another account is refused, never moved),
  `bank_accounts`, `bank_transactions` (integer cents, POSITIVE = money in; Plaid's sign is
  flipped once in `plaidAmountToCents`; `review_status` starts `unreviewed`; removals set
  `removed_at`, nothing is deleted). Access tokens are AES-256-GCM under `INTEGRATIONS_KEY`
  (`lib/secrets.ts`, `v1:` prefix for future rotation); without the key nothing can be saved.
  `lib/integrations/plaid-client.ts` is fetch-only (no SDK, no new dependency) and verifies
  webhooks (ES256 JWT, key by kid from /webhook_verification_key/get, iat within 5 minutes,
  body SHA-256). `syncConnection` pages to the end, restarts from the original cursor on
  TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION, and applies every page plus the new cursor in
  ONE transaction. `PLAID_BASE_URL` points at a stand-in server for local tests and is ignored
  in production. Verified against a local Plaid stand-in: connect, two-page sync with a forced
  restart, add/modify/remove, ITEM_LOGIN_REQUIRED to needs_reauth, signed webhooks (tampered,
  stale and unsigned all 401), cross-account 404s, no token in the DB in clear or in logs.
  Plaid production pricing is not public; new US teams since 2026-04-15 get a free trial
  plan capped at 10 production items. NEXT: categorization rules and the ledger
  (docs from Jacob: "Crossroads Financials" spec, GL posting rules) sit on these rows.

- **Bank review queue and rules (2026-11-09, Jacob: "pick up where this left off").** A
  signed-in account sorts its bank lines at `/app/transactions` (tabs: To sort, oldest first;
  Sorted; Not business) and manages categories and rules at `/app/transactions/rules`.
  `lib/books/review.ts` is server-only; `lib/books/categories.ts` is the client-safe half
  (§9.3's split). **Sorting is a label, not bookkeeping**: `bank_transactions` gains
  `category_id`, `note`, `reviewed_at/by`, `rule_id`, `rules_paused`, and nothing writes a
  debit or credit. `ledger_categories` is per account, seeded once with 25 starter
  categories for an event business (seeded only when the account has none, so an account
  that trims its own list keeps it); `kind` is income / expense / transfer / equity,
  `tax_line` is a Schedule C HINT left blank where the line depends on facts we lack (gear),
  and `gl_code` is empty on purpose for the ledger layer to map. Categories are hidden,
  never deleted. Nothing is preselected in the picker: the bank's own guess shows as
  "Bank says: ..." text only, because a guess that gets saved is a wrong book. **Rules**
  (`categorization_rules`) come only from "Always do this" on a person's own sort
  (merchant equals, or description contains, plus money in or out); a person's sort is
  saved first, so a refused rule never costs it. Rules sort only rows that are unreviewed,
  not removed and not `rules_paused`, re-checked in the UPDATE's WHERE so a person sorting
  the same row at the same moment wins; any person action (sort, set aside, move back)
  pauses rules on that row for good, so a later sync can never undo a decision. Most
  specific rule wins (exact, then longer, then newest); duplicates are refused; deleting a
  rule leaves what it sorted. **Pending to posted**: Plaid removes a pending line and adds a
  posted one carrying `pending_transaction_id` (now stored as `pending_external_id`); a
  decision made on the pending line carries to the posted one. Both run in `afterSync`,
  called after the sync transaction commits and caught, so sorting can never fail a sync.
  `/api/app/transactions/export` is the CSV for the accountant (formula-leading cells
  neutralized). Verified against a real Postgres and headless Chromium: cross-account ids
  update 0 rows, another account's category is refused, cross-origin 403, no session 401,
  rule backfill, duplicate rule refused while the sort saves, a moved-back row survives a
  re-run, pending carry-over, case-insensitive merchant match, no sideways scroll at 390 and
  1280. NOT YET: split transactions, matching deposits to bookings (`review_status`
  'matched' is reserved for it), the house account (Crossroads uses `/admin`, which has no
  bank feed yet), and the ledger itself, which waits on Jacob's "Crossroads Financials" spec
  and GL posting rules (they were in the claude.ai chat, not in this repo).

- **The ledger (2026-11-09, Jacob: "do your own financial spec, keep moving").** The spec is
  `docs/FINANCIALS_SPEC.md`, written by Claude Code because the claude.ai one never reached
  the repo; if that one turns up and disagrees, the owner decides and the file is corrected.
  **Double entry, cash basis, append-only.** `ledger_accounts` is a per-account chart
  (codes by range: assets 1000s, liabilities 2000s, equity 3000s, income 4000s, expenses
  6000s, steps of 10, never reused), generated by `ensureLedger`: each category gets its own
  account (`ledger_categories.ledger_account_id`, code mirrored into `gl_code`), every
  "Moving money" category shares ONE clearing account, 1900 Transfers in transit, and each
  bank account gets its own (cards and loans are liabilities, `accountTypeForBank`), plus
  3900 Opening balance equity. `journal_entries` / `journal_lines` hold the books; a
  DEFERRABLE constraint trigger (`journal_entry_check`) refuses at COMMIT any entry that does
  not balance, has under two lines, or uses an account from another tenant, so the database
  holds the rule even when code is wrong (both refusals verified). **Entries are derived**:
  `postBankLedger` posts every bank line that is categorized, not pending and not removed
  (money in: debit bank, credit category; money out: the reverse; correct for cards too), and
  VOIDS the live entry of any line whose `fingerprint` (date, accounts, amount) changed or that
  no longer qualifies (moved back, set aside, withdrawn), keeping the void with its reason.
  It is idempotent and serialized per tenant with a transaction advisory lock, and a partial
  unique index allows one live entry per source (six simultaneous runs: no duplicates). It
  runs after every sort, rule run and sync (`postBankLedgerQuietly`, which never throws, since
  the next run heals), and on every `/app/books` load and ledger export. **Opening balances
  are entered from a statement, never computed** (a set-aside line on a business account
  still moved cash, and a computed opening would hide that): one entry against 3900, a new one
  voids the old; for a card it is the amount owed. `/app/books`: profit and loss by period
  (this month, last month, this year, last year; calendar dates in Indiana time), "Do your
  books match the bank?" per account (books against Plaid's balance, with the three reasons a
  difference happens: no opening balance, lines waiting, lines set aside that are really owner
  draws), a note when Transfers in transit is not zero (a transfer with one side missing), and
  balances today with earnings to date so the equation visibly balances.
  `/api/app/books/ledger` is the general ledger CSV. Verified against a real Postgres and
  headless Chromium (21 checks: no-op repost, pending/removed/unreviewed never post, card
  charge plus payment nets the card and the clearing account to zero, assets equal liabilities
  plus equity, re-sort and move-back void, a bank amount change voids and reposts, the two
  database refusals, opening balances and their tenant check, CSV debits equal credits, another
  tenant's books stay empty; no sideways scroll at 390 and 1280). NOT YET (spec "Not in v1"):
  accrual and booking deposits as a liability, matching deposits to bookings, split lines,
  manual journal entries, closing periods, sales tax, and the house account.

- **Matching payments to bookings (2026-11-09, Jacob: "yes, start on matching deposits to
  bookings").** Spec items 12 to 15 in `docs/FINANCIALS_SPEC.md`; code in
  `lib/books/matching.ts`. A money-in line gets `bank_transactions.booking_id` +
  `payment_kind` (deposit | balance) AND is sorted into an income category in the same step
  (chosen, else Event income), so it posts to the ledger as ordinary income; matching is a
  column, not a review status, and `review_status` 'matched' stays unused. The fingerprint now
  includes the booking, so a match reposts with the booking's name in the memo. In the queue,
  money-in rows show up to three suggestions (`suggestFor`, pure): the exact deposit, balance or
  full amount still owed, or a client name token (3+ letters, stop words dropped) on the line,
  with a penalty for dates far from the event, each saying why; plus "Match to a booking" for any
  open booking (not archived, not cancelled). Nothing is matched automatically. Received per
  booking is the sum of matched, not-withdrawn lines; covering the deposit sets
  `is_deposit_paid` (and inquiry to deposit_paid), covering the total sets `is_balance_paid`.
  Flags are only SET, never cleared, because the owner may have marked cash paid by hand; the
  booking page's "Payments received" section shows the real figure beside them. Sort, set
  aside or move back clears a match. Verified against a real Postgres and headless Chromium
  (25 checks plus API and browser: suggestions on amount, on name, on both, none without
  evidence, never for money out; another tenant's booking refused and not offered; money out
  and expense categories refused; deposit then balance flags; ledger memo and Event income;
  no-op repost; moving back clears the match, voids the entry and leaves the flag; a withdrawn
  line stops counting; Sorted tab shows the booking; no sideways scroll at 390 and 1280). NOT
  YET: one line paying several bookings, refunds matched back, the house account.

- **Real client records survive this branch untouched, and that is proven, not assumed
  (2026-11-09, Jacob: "make sure and convert over all my current customers and their info
  flawlessly ... these are real weddings and clients for next year").** `main` never wrote
  `tenant_id` or created a tenant, so in production every wedding and lead has it NULL and the
  migration moves them to the house account. One gap was closed: `tenants.kind` defaults to
  'customer', so a tenant row inserted by hand would have taken its weddings off `/admin`; a
  guard now moves weddings and leads of any non-house tenant with NO users to the house (a real
  customer always has its owner, written in the same transaction). Verified on a copy of
  `main`'s schema seeded across every client table (weddings with a signed and countersigned
  contract snapshot, a trade deal, corporate, archived, cancelled, one on a hand-made tenant;
  timeline, music, VIPs, do-not-play, messages, an uploaded file, leads, appointments, office
  hours, reviews, playbook): an md5 of every row, tenant_id aside, is IDENTICAL before and after
  three migration runs (62 rows); all six weddings land in the house account (the hand-made one
  only because of the guard); the dashboard lists every active one and the archive the archived
  one; every hub, run sheet, vendor live view and guest schedule answers 200; the contract still
  shows the countersignature; the trade-deal invoice and the message thread are unchanged. Run
  the same kind of check before any migration that touches existing rows.
- **The house account keeps its books under /app (2026-11-09).** `HOUSE_BOOKS_EMAILS` (comma
  separated, read on every request, unset = nobody) lists who may. `/login` creates the house
  user on first request for a listed email (`findOrCreateHouseUser`; an email already on a
  customer account is never moved); `getBooksWorkspace` admits a customer or a still-listed
  house user, and replaced `getCustomerWorkspace` on every money page and API (transactions,
  rules, categories, integrations, books, ledger). Booking pages and APIs stay customer-only:
  the house's bookings live in `/admin`. A house user at `/app` lands on `/app/books`, the
  header drops the Bookings link, and the dashboard header links to Books. Matching runs
  against the real Crossroads weddings. Verified: listed email gets a link, a stranger gets
  the same reply and no link; all four money pages 200; customer booking pages and API refuse;
  removing the email locks a live session out of pages and API at once.
- **Paid by hand counts (2026-11-09, found on the realistic data).** `creditFor` in
  `lib/books/logic.ts`: a deposit the owner marked paid with no deposit matched from the bank
  was paid outside it (cash or check, which is how deposits are taken for now), and a booking
  marked paid in full owes nothing. Without this a trade deal was suggested as owing $1,000, a
  cash deposit read as unpaid, and a cash deposit plus a Zelle balance never marked the booking
  paid. The booking page lists "Deposit, marked paid by hand" beside matched lines. A far-off
  date now drops a one-piece-of-evidence suggestion (amount OR name), keeping amount AND name.
- **`lib/books/logic.ts` is the pure core** (no imports): rule matching and order, posting
  lines, credit, suggestions. `node --experimental-strip-types scripts/verify-books.mjs` checks
  it (38 cases); five deliberate sabotages (cash deposit ignored, paid-in-full ignored, weak
  date penalty, money out allowed, stop words dropped) are each caught. Run it after touching
  any of this.
- **`/my-wedding`, the one link Jake sends every couple (2026-11-09, Jacob: "make a public site
  for all my current customers ... I'll send them the link").** A couple types the email on
  their booking and that address gets their private planning hub link (`sendHubLinks`). No
  accounts and NO PASSWORDS: Jacob asked to give every couple the password "changme1234"; that
  was declined, because one shared, guessable password would open every couple's agreement,
  money and messages to anyone who learns it, and the hub link already does the job privately.
  `lib/my-wedding.ts` `hubsForEmail`: house-account weddings only (the page is Crossroads
  branded; a customer account's couple with the same email is never sent anything),
  cancelled left out, archived kept, matching `contact_email` or any `hub_invite_emails`
  entry, case-insensitive, at most five. The reply is identical whether or not the email is
  on file, so the page cannot be used to check who our clients are; rate limited per IP and
  per email. noindex. A booking with no email on it cannot use this; add one from the hub's
  Details or the dashboard first. Needs `RESEND_API_KEY` and crossroadsweddingco.shop verified
  in Resend, or nothing is sent (logged in production, printed locally). Verified on the
  realistic copy: booking email in capitals and an invited email both get the right hub, the
  other account's couple and a cancelled booking get nothing, a stranger gets the same reply,
  the fourth try in an hour is refused, the emailed hub link opens, no sideways scroll at 390
  and 1280.

- **Wedding website, replacing Zola / The Knot / WeddingWire (2026-11-11, Jacob: "mock up a
  public site for Lauren and Clay ... this would be to replace Zola or Wedding Wire ... not
  RSVP type ... engagement pictures ... map integration with the venue address ... a checkbox
  for using internal Crossroads website, and then an optional box for existing Zola, Wedding
  Wire, the Knot").** `/w/<site_slug>`, switched on from the hub's "Your wedding website"
  section ("Use the <brand> wedding website?"), which also holds engagement photos, story,
  links (registry, hotel block), guest Q&A and the optional outside-site link (it edits the
  same `weddings.wedding_site_url` as Details, and the public page lists it as "Our wedding
  site"). No RSVP. Columns `site_enabled` (default false), `site_slug` (names + 6 random hex,
  minted on first switch-on and kept), `site_story`, `site_links`, `site_faq`. **Nothing is
  public until it is switched on; switched off, the page and every photo URL 404 at once.**
  Schedule shows times and titles only, never MC notes. Map: Google's keyless embed of
  venue name + address, plus a directions link; no API key. Never indexed. Branded with the
  booking's own account. Photos (`site_photos`, bytes in Postgres, max 12, 3 MB): the hub
  resizes to a 2000px long edge and re-encodes to JPEG in the browser, which strips EXIF and
  GPS (verified: no Exif in stored bytes); the server trusts magic bytes, not the label
  (JPEG/PNG/WebP), counts under a row lock, and serves with nosniff + CSP sandbox; the hub
  reads its own photos even while the site is off. `/w/preview` is the dev-only twin. The
  Lauren and Clay mockup was rendered from a LOCAL test booking with sample details and
  placeholder photos; nothing about them is in the repo. Verified against a real Postgres
  and headless Chromium at 390 and 1280.
- **Event pages and the couple's own note (2026-11-11, Jacob: "a page up for Kat and Tanis
  ... like you have for Adam's Valle Vista wedding and a place for the bride and groom to
  comment their experience").** `REVIEW_EVENTS` entries gain `slug` and `eventDate`; each
  gets `/weddings/<slug>` (gallery, approved notes, a sign form tagged with the slug) and is
  in the sitemap; `/reviews` and the homepage gallery link to them. Pages are titled by venue
  and date, never the couple's names. Kat and Tanis is `forge-on-4th-2026-11-07` with NO
  its own look (`theme: "goth"`, Jacob 2026-11-11: "emo pop punk Gothic"): black and
  violet from their day, their own "'Til We Are Ghosts" sign as the headline, and each photo
  a tarot card (`GothGallery`, after their tarot-named tables) taped at a fixed tilt. Seven
  photos, prepared like Valle Vista (long edge 1600, EXIF/GPS stripped). Deliberately left
  out: the seating-chart mirror (about 90 guests' full names legible) and a photo of two
  guests, who are not covered by the couple's marketing-photo consent. The couple writes from their
  own hub: a "How was your day?" card appears on house weddings once the event date has
  come (Indiana time), posts to `/api/hub/[token]/review` (relation "Our wedding",
  `guestbook_entries.wedding_id`, three a day), emails the owner, and waits for approval like
  every note; the moderation screen says where each note came from. An event page shows
  approved notes tagged with its slug or written from a house wedding's hub on its date.

- **Operations and growth batch (2026-11-11, Jacob: "think wedding ERP", "Accounting",
  "Vendors", "market heavy", "price it at $50 flat a month").**
  - **`/venues`**: "Your in-house DJ, without the payroll." Crossroads' own DJ service pitched
    to venues: published prices from `lib/site.ts`, the live timeline and printed run sheet
    for the coordinator, real event pages as proof, `/?src=venue` to hand couples. Promises
    no insurance paperwork, exclusivity or referral fee (none decided). Footer and sitemap.
  - **Platform price: `PLAN_PRICE_USD = 50`**, one plan, every feature (owner decision). The
    signup page leads with "Your books are built in. No QuickBooks.", Jake in his own words
    ("a seasoned accountant, technologist and DJ"; quote: "You don't need anyone but me."),
    and tax filing "through Smart CFO, under confidentiality" with no price shown. Do not call
    Jake a CPA. Open item for Jake: paid preparers need an IRS PTIN; Oscar Rodriguez (Smart
    CFO) is NOT named publicly without his OK. A DJ's books go to an accountant only by that
    DJ's opt-in (feature not built yet).
  - **`/app/money`** (`lib/money.ts`): cash and card balances (Plaid's last report), owed to
    you and past due (`openBookings`/`creditFor`, the matching math), money collected for
    events still to come (with a "may have to go back on a cancellation" note; deliberately NO
    "safe to spend"), next 30 days in (balances due) and out (expected repeat charges), and
    repeat charges from `lib/books/recurring.ts` (evidence only: 3 charges, 2 for yearly,
    steady cadence and amount, still active; 26 months of history so yearly bills are seen).
    "Needs you": bank logins to repair, lines to sort, contractors needing a W-9, past due.
  - **Vendors** (`vendors` table, `lib/vendors.ts`, pure rules `lib/books/vendor-logic.ts`,
    `/app/vendors`): payments are FOUND on the bank feed by the vendor's match words, never
    typed. 1099-NEC counts bank payments only (card payments go on a 1099-K); threshold by
    payment year in `NEC_THRESHOLD_CENTS` ($600 to 2025, $2,000 for 2026, later years say
    "not published yet" instead of guessing). Only a "W-9 on file" flag is stored, never a
    tax id. Verify scripts: `verify-money.mjs` (18), `verify-vendors.mjs` (17).
  - **Signup attribution**: `tenants.signup_src` takes the first-touch `?src=` tag
    (`SourceCapture`, `cleanSrcTag`, never refused). `/admin/[key]` shows "Platform signups":
    totals, trials, paying, by source, by business type, latest 15 (`lib/platform-stats.ts`,
    counts only, no customer's bookings or money).
  - **`docs/MARKETING_GRAPHICS_BRIEF.md`**: the brief Jake hands a design chat: true messages,
    real features, exact palette from `app/globals.css`, first batch of graphics, in-person
    pieces with their `?src=` tags, and the don'ts (no invented numbers, testimonials or
    unsourced competitor claims; no em dashes).

### 9.2a Strategy doc №2 (docs/MASTER_SPEC_AND_STRATEGY.md, 2026-08-26)
A second brainstorm doc (Jacob & Jim), same standing: steering input, not gospel. New
decisions absorbed from it:
- **Travel surcharge:** venues past ~60 min of Columbus carry $100–$150, quoted up front,
  paid directly to talent. Encoded in `lib/cities.ts` (`hasTravelSurcharge`), Louisville and
  Cincinnati pages disclose it; the four near markets stay surcharge-free. The earlier
  "no travel fee anywhere" copy was corrected before it ever shipped.
- **2027 pacing:** 24 weddings cap (~2/month). Business policy, not yet software-enforced.
- **Nic (spelled N-i-c):** apprentice partner, 6-gig progression, $2,000/month draw from
  Jan 2027 with quarterly/year-end true-up. `talent_profiles` will gain `monthly_draw_rate`
  when payroll tracking ships (Phase 4); partner deck lives at
  `content/partner/crossroads-partner-brief-nic.pptx`. Bar credentials (2026-08-27): about
  20 years serving/bartending, holds a current Indiana ATC employee permit, heard as
  expiring June 21 of next year (2027); verify the exact date on the card before renewal
  season. The "licensed bartenders" copy is literally backed by this.
- Where the two docs disagree, the newer doc + owner's live word wins; this appendix is the
  tiebreaker record.

### 9.3 Deviations from the spec, and why
- **Next.js 15 / Tailwind v4**, newer than the spec's 14+. shadcn/ui is NOT installed: the site
  has an established hand-rolled design system (cream/parchment/charcoal/terracotta, Spectral +
  Karla). Introducing a second component language would fork the visual identity; revisit only
  for the admin dashboard (Phase 4).
- **`leads` table extended additively**, not replaced. It predates the spec, holds production
  rows, and keeps its serial PK. Spec columns (`tenant_id`, `source`, `raw_payload`,
  `target_date`, `status`, `phone`) were added via `ALTER TABLE ... IF NOT EXISTS`. The spec's
  `bride_name` does not exist, the live table's neutral `name` covers it.
- **`weddings` gains `contact_email` / `contact_phone`**, inquiry-stage bookings arrive before
  any `users` row exists, so the contact must live on the wedding record. `venue_address` is
  nullable for the same reason.
- **Migrations** are hand-authored idempotent SQL in `scripts/phase1-schema.sql`, applied by
  `scripts/migrate.mjs` which runs at the front of `pnpm build` (skips cleanly when
  `DATABASE_URL` is unset, fails the build on real SQL errors). Additive-only by policy.
- **Run sheet is a print-optimized page, not `@react-pdf/renderer`.** The hub links to
  `/hub/[token]/runsheet`, styled for `window.print()`, so the browser's save-as-PDF covers
  the venue/talent export with zero new dependencies. Revisit `@react-pdf` when the platform
  must attach PDFs to outbound email (COI dispatch, Phase 3+).
- **The spec's three-stage progressive intake shipped flat**: one hub page, four sections
  (basics, timeline, music, VIPs), all visible from day one. Stage gating adds real
  complexity and only pays off at volume; the copy tells couples to fill in what they know
  and skip the rest.
- **`lib/hub.ts` (server, Drizzle) is split from `lib/hub-constants.ts` (client-safe).**
  Client components under `components/hub/` may only import the constants module; importing
  `lib/hub.ts` drags `pg` into the client bundle and breaks the build (webpack catches it,
  tsc does not).

### 9.4 External dependencies, status
| Dependency | Status |
| --- | --- |
| Neon Postgres | Wired 2026-08-26 after three rounds: the Vercel variable is named `Database_URL` (mixed case, resolver matches case-insensitively and sanitizes the value), and the first two pastes were not the connection string. The schema self-applies at build; the build log prints the host it dialed. Verify claims like this against build logs, not session lore |
| Resend | **Live** (2026-08-26). `RESEND_API_KEY` in Vercel; sender is `jake@crossroadsweddingco.shop`, confirmed received by owner. Booking confirmations + notifications flow |
| Stripe | Not yet created. Checkout + webhook routes fail closed (501) until `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` exist. Connect payouts need business verification |
| Spotify | **Keys live** (2026-08-28) but playlist reads need one more step: the Feb 2026 API migration (enforced 2026-03-09) moved playlist reads to /playlists/{id}/items and made that endpoint reject client-credentials tokens (401, observed in prod logs). Owner authorizes once at /api/spotify/connect?key=<ADMIN_DASH_KEY> (redirect URI https://crossroadsweddingco.shop/api/spotify/callback is registered on the app), pastes the shown refresh token into Vercel as SPOTIFY_REFRESH_TOKEN, redeploys. Client-credentials keys unlock playlist ingestion + track search (`lib/spotify.ts`, fails closed until then). The hub's playlist unfold + send-to-moment UI shipped 2026-08-28 (`/api/hub/[token]/playlist-tracks`, hub-token gated) and lights up the moment the keys land; note new Spotify dev apps can read user-created playlists but not Spotify-owned editorial ones (API change Nov 2024), which is fine since couples share their own |
| Twilio | Booking texts wired 2026-08-27, fails closed until keys exist. On the docket once keys exist (Jacob 2026-08-27): milestone check-in texts on a daily cron, e.g. 90 days out "Hey, checking in. Getting close. Let us know if you need anything.", plus similar touches at 30 and 14 days; needs a Vercel cron route guarded by CRON_SECRET. Jacob needs: twilio.com account (paid, not trial), a toll-free number with toll-free verification (simplest US A2P path) or a local number with 10DLC brand+campaign registration, then `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SERVICE_SID` (or `TWILIO_FROM_NUMBER`) in Vercel. Optional `TWILIO_NOTIFY_TO` texts the owner on each booking. The dispatch cascade (Phase 3) reuses this |
| WeddingPro (The Knot / WeddingWire vendor advertising) | Signing 2026-08-27 (quote Q-472003, rep Adam Muir, owner decision): $4,994.40/12 months non-cancellable, ~$416/mo, 4 items (Knot Spotlight Banner Musicians, Knot DJs Platinum, WW DJs regional, WW DJs Indianapolis city). BEFORE CONFIRMING Jacob is fixing: 3 items quoted for the "Indianapolis, Lafayette, Terre Haute Region", the wrong half of the state. The three push markets are Indianapolis, Bloomington, and Louisville (KY, a separate Knot market), per Jacob 2026-08-27. Also the account email is nic@nicotiamarket.com (wrong brand; leads will land there). AUTO-RENEWS annually at up to +50% price; cancel at least 10 days before renewal (calendar reminder late July 2027); bundle discounts are all-or-nothing. Arbitration opt-out available within 30 days of acceptance (by ~2026-09-26) via arbitrationtop@theknotww.com, keeps the contract intact. Once live: build the inbound lead bridge against the first real lead notification email (Jacob forwards it), auto-provisioning a wedding + hub + instant quote email per §6.1 |
| Realtime provider | Not yet created (Phase 3+) |

### 9.5 Standing conventions in this repo
- **No em dashes, anywhere a human reads (owner directive, 2026-08-26, given twice;
  do not make Jacob say it a third time).** Site copy, emails, error messages, titles,
  metadata, social captions, generated images, decks, and docs: restructure the sentence
  (period, comma, colon, parentheses) instead of dropping in an em dash. The one allowed
  dash is the short en dash inside numeric ranges ($100–$150, 2–3). This applies to all
  future writing in this repo.
- Business facts (rates, deposit, contact, service area) live in `lib/site.ts`, never hardcode
  them in components; the JSON-LD reads the same constants, and price drift between visible copy
  and structured data is a Google penalty.
- Every externally-gated feature fails closed and renders nothing rather than a dead control
  (see `BookCallCard`, the IG Studio 501s, and the Stripe routes).
- `pnpm check` (tsc) and `pnpm build` must pass before any push; layout changes get measured in
  headless Chromium (`/opt/pw-browsers/chromium-1194/...`) at 360/390/768/1280/1440 widths.
- Layout QA for token-gated pages runs against `/hub/preview` and `/hub/preview/runsheet`:
  dev-only sample-data twins of the portal pages that 404 in production builds.

### 9.6 Phase log
- **Phase 3, sixth slice (2026-09-04): native intro-call booking with office hours.**
  Replaces the unset `NEXT_PUBLIC_BOOKING_URL` Calendly hole, and it is what the QR
  code on every printed business card resolves to: `/book?with=<slug>` for jake, nic,
  brayton, ashton (`lib/schedulers.ts`; **those slugs are printed, so add, never
  rename**). Two tables (`office_hours`, `appointments`), a public
  `/api/bookings/call` (GET the calendar, POST one booking), an owner editor at
  `/admin/[key]/hours`, and a Resend pair on success. **Each person's alert defaults
  to the address printed on their own business card** (`<slug>@crossroadsweddingco.shop`,
  confirmed to exist per CARD_PRINT_SPEC.md), not to an env var and not to the owner:
  a feature that only behaves correctly once somebody remembers a dashboard setting is
  a feature that ships subtly wrong, and this one would have put every call for all
  four people in Jake's inbox. `SCHEDULER_EMAIL_{JAKE,NIC,BRAYTON,ASHTON}` remain as
  overrides for anyone who wants a personal address instead. `OWNER_EMAIL` is always
  copied and deduped, so a misconfigured mailbox cannot turn a booked call into one
  nobody knows about until the phone fails to ring.
  The load-bearing outcomes, all measured against a real Postgres and headless
  Chromium rather than reasoned about:
  - **Office hours are wall clock, appointments are instants**, and the conversion is
    the whole feature. `lib/scheduling.ts` is pure and takes `now`, so
    `node --experimental-strip-types scripts/verify-scheduling.mjs` checks it across
    both Indiana DST transitions in both directions. Run that script when you touch
    this arithmetic. Its three load-bearing cases are mutation-tested: dropping the
    second offset pass, dropping the touching-block dedupe, and letting a slot
    straddle two blocks each fail it, and the single-pass mutation is off by exactly
    the hour the clock moved.
  - **The double-booking guard is a partial unique index, not a check before the
    insert.** Two people at one bridal expo tap the same 6:00 within a second; a
    read-then-write cannot see the request racing it. Verified with three
    simultaneous POSTs: one 200, two 409, exactly one row. It is partial on
    `cancelled_at` so cancelling reopens the slot, also verified.
  - **Drizzle wraps the driver error**, so the `23505` SQLSTATE is on `.cause` and
    reading `err.code` directly is silently always undefined. The first race put a
    500 and "Internal Server Error" in front of the losing couple instead of "someone
    just took that time". `isUniqueViolation` walks the cause chain. This path only
    exists under real concurrency, so it cannot be found by reading the code.
  - **Nothing is ever offered that its owner did not agree to.** A person with no
    office hours has no slots, and the page says so and hands the visitor to the date
    form; it does not seed a plausible week. Server-side every POST re-derives the
    grid from that person's own hours, so an off-grid instant, a wrong weekday and a
    past time are all refused whatever the client posts.
  - **Everyone's hours are seeded once, and recorded as seeded.** Mon to Thu, 6 to
    8pm for all four (owner directive 2026-09-04, asked and answered): Saturday is a
    wedding, Friday is setup, Sunday is the day after. The guard is a row in
    `schema_seeds`, not "insert if office_hours is empty", and the difference is one
    scenario that would look like a haunting: somebody clears all four calendars for
    a fortnight in August and the next deploy quietly reopens every one of them.
    Verified across four deploys on a real Postgres: seeds 16 rows, a second deploy
    is a no-op, a hand edit survives, and deliberately cleared calendars stay cleared.
  - **`lib/team.ts` is now the single source for who these four are** (owner
    directive 2026-09-04, "add brayton and ashton to the team page"). It holds name,
    title, roles and bio; `lib/schedulers.ts` reads it and adds only a notify address,
    so a title cannot say one thing in "who you get" and another on the page a QR code
    opens. Titles are the ones on the printed cards, which corrected two existing
    entries: Jake and Nic were showing CEO and COO, their holding-company titles
    rather than their jobs at a wedding, and Nic's roles line omitted DJ and MC while
    the card in a couple's hand says he does both. All four DJ and MC.
  - **Bios are role, not biography.** Nic's is the only one carrying a hard claim
    (about twenty years, a current Indiana ATC permit) because it is the only one
    anybody has stated. Do not invent an experience, a credential or a number here:
    this is the section couples read to decide whether to trust four strangers with
    their wedding. Photos are still missing and still cost nothing, since a member
    with no `photoUrl` renders brand initials.
  - Adding two people made a piece of stale copy contradict itself: the couple's
    Messages header still read "Your direct line to Jake and Nic. We both see
    everything here." while `TEAM_NAMES` had offered all four as senders since the
    identity slice, so a couple could receive a message signed Brayton on a thread
    that had told them only two people were on it. It now names the team rather than
    counting it, which stays true the next time the roster changes.
- **Run sheet pre-flight, proof/final, custom edits (2026-11-05, from the Gemini DJ prep kit
  spec for the Kat and Tanis wedding).** The spec proposed a separate Python repo; it was built
  here instead so the checks read the rows the hub writes. `lib/preflight.ts` is pure and flags:
  blocks at the same minute, a block running into the next, a song moment on the schedule with no
  song, one song set for two moments, a song both requested and on do-not-play (title or a banned
  artist), every custom edit, and a reminder to check against the couple's uploaded documents (the
  official record; nothing here reads a PDF). **Deliberately not ported:** the recessional-under-2:15
  and open-floor 85 to 95% crate checks, because both need song lengths this site does not store
  and must never guess. The run sheet prints a PROOF banner and the checks by default; `?final=1`
  hides both from print. `music_cues.custom_edit` is a per-song "Custom edit" checkbox in the hub.
  The Kat and Tanis trifold and runbook were already sent and were not touched.
- **Phase 1 (live 2026-08-26):** flat-rate site, city pages, booking flow writing `weddings`
  rows (legacy `leads` fallback), Resend emails from jake@, Stripe scaffolded and gated,
  schema self-applying at build.
- **Phase 2 (live 2026-08-26):** client planning hub at `/hub/[token]` (48-hex magic link
  minted at booking, emailed to the couple). Four autosaving sections (debounced 700ms PUT
  replace-all APIs under `/api/hub/[token]/*`), print run sheet at `/hub/[token]/runsheet`,
  per-wedding PWA manifest, portal-gated Spotify track search (501 until keys exist). Booking
  confirmation email and success panel now carry the hub link. A 32-agent adversarial review
  confirmed 26 findings, all fixed before ship; the load-bearing outcomes:
  - `weddings.hub_section_revs` optimistic concurrency: each replace-all route locks the
    wedding row, compares the client's per-section revision, answers 409 with the current
    rows on mismatch (client refreshes and says so), increments on success. This is what
    stops one partner's stale tab from wiping the other's saved rows; keep it on any future
    hub write route.
  - Autosave engine (`components/hub/shared.tsx`): sequence counter + promise chain (no
    overlapping or out-of-order replace-alls from one tab), pagehide/visibility flush with
    keepalive, bounded quiet retries, badge never claims Saved while newer edits are unsaved,
    server error messages surface in the badge.
  - No silent drops: server schemas accept partially filled rows (empty titles, roles); the
    run sheet skips blanks at render instead. Client inputs carry maxLength matching zod caps
    and validate times before saving.
  - The PWA manifest is per-token (`/hub/[token]/manifest.webmanifest`, start_url and scope
    on the hub) because a global start_url "/" strands a pinned hub icon on the marketing
    homepage. There is deliberately no global manifest.
  - `/hub/` is deliberately NOT in robots.txt disallow: the pages carry noindex metadata and
    a crawler must fetch to see it, else a leaked URL gets indexed URL-only. Do not "fix" by
    re-adding the disallow.
  - PrintButton swaps a tokenless URL into history during window.print() so browser print
    headers do not hand the write-capable token to the venue. The durable fix, the read-only
    share token, shipped with the first Phase 3 slice below.
- **Phase 3, third slice (2026-08-28): Messages, the one-master-thread inbox.**
  `wedding_messages` table; couple chat at `/hub/[token]/messages` (Messages button with
  unread badge in the hub header), team inbox at `/admin/[key]/messages/[weddingId]`
  (Messages button with unread count on each dashboard card, "Replying as Jake/Nic"
  remembered per device). 12s polling with a stale-poll guard, optimistic sends, 4000-char
  cap, download-as-txt. Couple posts email an alert to OWNER_EMAIL with a direct dashboard
  reply link; team posts email the couple a pointer only. Booking email now sends from
  booking@, tells couples not to reply, and carries a "Message us in your planning hub"
  button. Notification emails are awaited (Promise.allSettled) before the response, per
  the serverless-freeze lesson. Dev previews: `/hub/preview/messages`,
  `/admin/preview/messages/[id]`.
- **Phase 3, second slice (2026-08-28): milestone check-in texts + owner dashboard.**
  `/api/cron/checkins` (vercel.json cron, daily 15:00 UTC) sends the 90/30/14-days-out
  check-in texts with the hub link; `weddings.checkins_sent` marks sent milestones (only
  the tightest reached milestone is texted, all reached ones are marked, so late bookings
  never get a stack). Gated on `CRON_SECRET` (Vercel sends it as the Bearer token
  automatically) plus the Twilio keys; fails closed at every layer. `/admin/[key]` is the
  read-only owner dashboard (upcoming and past weddings, contacts, money and deposit
  state, hub/run-sheet/live/vendor links, legacy leads), gated on `ADMIN_DASH_KEY`
  (generate with `openssl rand -hex 24`; keys under 16 chars are treated as unconfigured;
  timing-safe compare; 404 on any mismatch). `/admin/preview` is the dev-only QA twin.
- **Phase 3, first slice (2026-08-27): "Crossroads Live" drift engine.**
  `/hub/[token]/live` is the MC's tap-to-run console: Start on a block anchors it to now,
  closes everything before it, reopens everything after, and the drift (actual minus
  scheduled of the latest start) shifts every downstream time. `/live/[share_token]` is the
  zero-auth read-only vendor view (photographer, venue) of the same state.
  `weddings.share_token` (additive migration, pgcrypto backfill, minted at booking) grants
  exactly that read. Both pages poll every 15s; drift math is client-side
  (`lib/live.ts`, pure) so wall-clock deltas use the venue device's timezone. Live writes
  are deliberately last-write-wins single-field updates, not rev-guarded: a mid-ceremony
  tap must never be blocked, and the poll reconverges all devices. Still Phase 3 backlog:
  dispatch cascade (needs Twilio), blockout calendar, Music Stand/ChordPro, realtime push
  instead of polling.
