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
    domain VARCHAR(255), -- "crossroadsweddingco.com", "nashvilleweddingco.com"
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
* **Synchronized Web View:** Photographers and Venue staff access a zero-auth, read-only live URL (`crossroadsweddingco.com/live/[token]`) to stay aligned without verbal interruption.

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
  2. Generates a personalized proposal URL (`crossroadsweddingco.com/quote/[slug]`).
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

## 9. Implementation Notes — Repo Reality (maintained by Claude Code)

### 9.1 Corrections to the original spec
1. **COI:** A Certificate of Insurance is issued by the insurer. The platform stores the real
   certificate and auto-dispatches it to venues; it never generates one.
2. **AggregateRating:** rating JSON-LD is withheld until real reviews are collected and displayed
   on-page. Shipping it earlier is a documented Google-penalty trigger.

### 9.2 Decisions made after the spec was written (owner-confirmed)
- **Add-on pricing (2026-08-26, Jacob):** Live acoustic set is a **flat $400**, published.
  Bartending is **from $400**, fully quoted at intake once date and headcount are known.
  The booking flow adds $400 to the total for acoustic; bartending is stored as an interest
  flag with a $400 floor and quoted on the intro call.
- **Intro call:** 30 minutes, booked via the contact-section card
  (`NEXT_PUBLIC_BOOKING_URL`, Google Calendar appointment schedule).
- **Service area:** based in Columbus, Indiana; two-hour radius — Indianapolis, Bloomington,
  Nashville (IN), Louisville (KY), Cincinnati (OH). Encoded in `lib/cities.ts` and the
  homepage `areaServed` structured data.
- **Spotify is a priority integration (2026-08-26, Jacob):** the target market curates its own
  playlists in Spotify, so the platform meets them there. Flow: couples build the playlist in
  their own account and share the link — captured at booking (`weddings.spotify_playlist_url`,
  no API needed), ingested into `playlist_curations` via the client-credentials API once
  `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` exist. Write-back (collaborative playlists from
  our side) requires the OAuth authorization-code flow and ships with the Phase 2 portal.

### 9.2a Strategy doc №2 (docs/MASTER_SPEC_AND_STRATEGY.md, 2026-08-26)
A second brainstorm doc (Jacob & Jim) — same standing: steering input, not gospel. New
decisions absorbed from it:
- **Travel surcharge:** venues past ~60 min of Columbus carry $100–$150, quoted up front,
  paid directly to talent. Encoded in `lib/cities.ts` (`hasTravelSurcharge`) — Louisville and
  Cincinnati pages disclose it; the four near markets stay surcharge-free. The earlier
  "no travel fee anywhere" copy was corrected before it ever shipped.
- **2027 pacing:** 24 weddings cap (~2/month). Business policy, not yet software-enforced.
- **Nic (spelled N-i-c):** apprentice partner — 6-gig progression, $2,000/month draw from
  Jan 2027 with quarterly/year-end true-up. `talent_profiles` will gain `monthly_draw_rate`
  when payroll tracking ships (Phase 4); partner deck lives at
  `content/partner/crossroads-partner-brief-nic.pptx`.
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
  `bride_name` does not exist — the live table's neutral `name` covers it.
- **`weddings` gains `contact_email` / `contact_phone`** — inquiry-stage bookings arrive before
  any `users` row exists, so the contact must live on the wedding record. `venue_address` is
  nullable for the same reason.
- **Migrations** are hand-authored idempotent SQL in `scripts/phase1-schema.sql`, applied by
  `scripts/migrate.mjs` which runs at the front of `pnpm build` (skips cleanly when
  `DATABASE_URL` is unset, fails the build on real SQL errors). Additive-only by policy.

### 9.4 External dependencies — status
| Dependency | Status |
| --- | --- |
| Neon Postgres | Live (`DATABASE_URL` in Vercel) |
| Resend | Account exists (multi-domain). Wire `RESEND_API_KEY` (+ optional `RESEND_FROM`, `RESEND_NOTIFY_TO`) into Vercel to activate booking emails |
| Stripe | Not yet created. Checkout + webhook routes fail closed (501) until `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` exist. Connect payouts need business verification |
| Spotify | **Priority.** Free developer app needed at developer.spotify.com — client-credentials keys unlock playlist ingestion + track search (`lib/spotify.ts`, fails closed until then) |
| Twilio, The Knot / WeddingWire vendor accounts, realtime provider | Not yet created (Phases 2–4) |

### 9.5 Standing conventions in this repo
- Business facts (rates, deposit, contact, service area) live in `lib/site.ts` — never hardcode
  them in components; the JSON-LD reads the same constants, and price drift between visible copy
  and structured data is a Google penalty.
- Every externally-gated feature fails closed and renders nothing rather than a dead control
  (see `BookCallCard`, the IG Studio 501s, and the Stripe routes).
- `pnpm check` (tsc) and `pnpm build` must pass before any push; layout changes get measured in
  headless Chromium (`/opt/pw-browsers/chromium-1194/...`) at 360/390/768/1280/1440 widths.
