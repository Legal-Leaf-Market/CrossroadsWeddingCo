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
  transactional email sends from **booking@crossroadsweddingco.com** and says plainly
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
| Resend | **Live** (2026-08-26). `RESEND_API_KEY` in Vercel; sender is `jake@crossroadsweddingco.com`, confirmed received by owner. Booking confirmations + notifications flow |
| Stripe | Not yet created. Checkout + webhook routes fail closed (501) until `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` exist. Connect payouts need business verification |
| Spotify | **Keys live** (2026-08-28) but playlist reads need one more step: the Feb 2026 API migration (enforced 2026-03-09) moved playlist reads to /playlists/{id}/items and made that endpoint reject client-credentials tokens (401, observed in prod logs). Owner authorizes once at /api/spotify/connect?key=<ADMIN_DASH_KEY> (redirect URI https://crossroadsweddingco.com/api/spotify/callback is registered on the app), pastes the shown refresh token into Vercel as SPOTIFY_REFRESH_TOKEN, redeploys. Client-credentials keys unlock playlist ingestion + track search (`lib/spotify.ts`, fails closed until then). The hub's playlist unfold + send-to-moment UI shipped 2026-08-28 (`/api/hub/[token]/playlist-tracks`, hub-token gated) and lights up the moment the keys land; note new Spotify dev apps can read user-created playlists but not Spotify-owned editorial ones (API change Nov 2024), which is fine since couples share their own |
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
  `/admin/[key]/hours`, and a Resend pair on success. Notification addresses come
  from `SCHEDULER_EMAIL_{JAKE,NIC,BRAYTON,ASHTON}` and fall back to `OWNER_EMAIL`,
  because a card in someone's wallet must not lead to a booking that reaches nobody.
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
  - `lib/team.ts` is deliberately still the two-person public "who you get" section
    and is NOT this list. Adding Brayton and Ashton there needs bios and photos from
    Jacob; keeping the lists apart is what let the cards ship before those exist.
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
