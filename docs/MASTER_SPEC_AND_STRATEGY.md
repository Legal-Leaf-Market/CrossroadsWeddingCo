# MASTER_SPEC_AND_STRATEGY.md — Crossroads Wedding Co. & Agency OS

> **Directive for Claude / Claude Code:**  
> This document serves as the combined technical architecture, operational blueprint, and financial model for **Crossroads Wedding Co.** Treat this as an active brainstorming roadmap and strategic foundation, not an immutable source of truth. Use this context to implement features, refine data models, draft client communications, and build the partner presentation deck for Nic.

---

## 1. Executive Summary & Operational Boundaries (Years 1–2)

### 1.1 Regional Focus & Growth Cap
* **Operating Territory:** Strict 2-hour driving radius centered on **Columbus, Indiana** (Columbus, Bloomington, Greenwood, Downtown Indianapolis, Seymour, Nashville IN, North Louisville outskirts). Venues >60 minutes out incur a standard $100–$150 travel surcharge paid directly to talent.
* **2027 Volume Target:** Exactly **24 weddings** (capped at an average of 2 per month) to ensure 100% operational focus, flawless client reviews, and zero contractor burnout.
* **Talent Apprenticeship Model:** 6-gig structured progression for Nic (Gig #1 observation $\rightarrow$ Gigs #2–3 co-pilot $\rightarrow$ Gigs #4–5 reverse co-pilot $\rightarrow$ Gig #6 solo graduation).

---

## 2. Cash Flow Engineering & Nic's $2,000/Mo Draw Model

### 2.1 The Predictable Draw vs. True-Up Architecture
To transition Nic out of erratic hospitality/bartending hours into full operational partnership, the business implements a **$2,000/month flat draw** beginning **January 1, 2027** ($24,000 annualized base).

```
                         [ INBOUND REVENUE STREAM ]
              Sept–Dec 2026: 8–12 Retainers @ $500  = $4,000 – $6,000 Nest Egg
              Jan–Mar 2027:  12–14 Retainers @ $500 = $6,000 – $7,000 Wave
              Event Balances (14 days pre-event):    $500 – $1,300 per gig
                                       │
                                       ▼
                   ┌───────────────────────────────────────┐
                   │    Crossroads Operating Cash Float    │
                   └───────────────────┬───────────────────┘
                                       │
                                       ▼
                   ┌───────────────────────────────────────┐
                   │  Nic's Predictable Monthly Payout    │
                   │         $2,000 / month flat           │
                   └───────────────────┬───────────────────┘
                                       │ (Quarterly / Year-End)
                                       ▼
                   ┌───────────────────────────────────────┐
                   │           True-Up Reconcile           │
                   │  Total Earned Splits vs. Draw Paid   │
                   └───────────────────────────────────────┘
```

* **Seasonal Income Smoothing:** Weddings concentrate heavily between May and October. Paying a flat $2,000/month provides Nic consistent financial stability during slow winter months (Jan–April) without disrupting operations.
* **Cash-Float Reserve Mechanics:** 
  * The upfront retainer nest egg collected from Fall 2026 bookings ($4k–$6k) plus the Q1 post-holiday engagement wave ($6k–$7k) builds a **$10,000–$13,000 cash reserve**.
  * This liquid float covers monthly payroll distributions before the summer wedding balances clear 14 days prior to each event.
* **True-Up Formula:**
  $$\text{Net Due to Nic} = \sum (\text{Gig Payouts} + \text{Acoustic Add-ons} + \text{Tips}) - \sum (\text{Draws Paid})$$
  * Baseline Gig: $750 talent cut (75% of $1,000).
  * Hybrid Gig (DJ + Acoustic): $1,050 talent cut (75% of $1,400).
  * 24 weddings with realistic 40% acoustic attachment generates **~$20,800–$24,000+** in gross talent earnings, balancing the draw while adding tips and upsells.

---

## 3. Claude Task: Slide Deck Blueprint for Nic

> **Prompt for Claude:**  
> When requested, generate a clean, modern, high-impact 8-slide presentation deck (in Markdown / Marp / HTML format) to walk Nic through the business strategy, operational model, and financial roadmap.

### Slide-by-Slide Outline
1. **Slide 1: The Crossroads Opportunity** — The broken $2,500+ wedding industry vs. our streamlined $1,000 transparent flat-rate model.
2. **Slide 2: The Core Roles & Synergy** — Musician + Hospitality pedigree; combining DJing, MC timeline coordination, and live acoustic music into one package.
3. **Slide 3: Financial Predictability ($2k/Mo Draw)** — How the $2,000/month guaranteed base works starting January 2027, beating unpredictable service industry wages.
4. **Slide 4: Cash Flow & Seasonal Smoothing** — Visualizing the retainer float: how fall/winter booking deposits pay for monthly stability year-round.
5. **Slide 5: The 6-Gig Apprenticeship** — The roadmap from observation to solo mastery (Gigs 1 through 6).
6. **Slide 6: The Tech Edge (Agency OS)** — Why we don't do messy paperwork: our custom client dashboard, automated timeline engine, and live-drift MC tool.
7. **Slide 7: 2027 Calendar Pacing (24 Gigs Cap)** — The target pace (2 weddings/month max), maintaining quality and sanity.
8. **Slide 8: The Long Game** — Scaling beyond Columbus: turning this exact operating machine into a scalable multi-market franchise.

---

## 4. Technical Architecture (Agency OS + Planning Center Engine)

### 4.1 Tech Stack
- **Framework:** Next.js 14+ (App Router, Server Actions, Route Handlers)
- **Database:** Neon Serverless PostgreSQL with Drizzle ORM
- **State & Sync:** TanStack React Query v5, Zustand, WebSockets / Supabase Realtime
- **Payments:** Stripe Connect (Express accounts for talent/franchise payouts)
- **Comms & Auth:** Resend (Email), Twilio (SMS dispatch), NextAuth + Token Magic Links (Client PWA)

### 4.2 Multi-Tenant Neon Postgres Schema

```sql
-- Multi-Tenant Franchise Nodes
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    stripe_account_id VARCHAR(255),
    royalty_rate NUMERIC(4, 3) DEFAULT 0.070,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Users & Talent Roster
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'client',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE talent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    skills TEXT[] NOT NULL DEFAULT '{"dj", "mc"}',
    base_payout_rate NUMERIC(10, 2) DEFAULT 750.00,
    monthly_draw_rate NUMERIC(10, 2) DEFAULT 2000.00,
    stripe_connect_account_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true
);

-- Planning Center Blockouts
CREATE TABLE talent_blockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID REFERENCES talent_profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255)
);

-- Events Master
CREATE TABLE weddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    access_token VARCHAR(64) UNIQUE NOT NULL,
    couple_names VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    is_deposit_paid BOOLEAN DEFAULT false,
    is_balance_paid BOOLEAN DEFAULT false,
    assigned_talent_id UUID REFERENCES talent_profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'inquiry',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Dynamic Planning Center Live Run-Sheet
CREATE TABLE timeline_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    scheduled_start_time TIME NOT NULL,
    estimated_duration_minutes INT NOT NULL DEFAULT 10,
    actual_start_time TIMESTAMPTZ, -- Live-drift tracking
    is_completed BOOLEAN DEFAULT false,
    mc_notes TEXT,
    cue_notes TEXT
);

-- Acoustic Music Stand & DJ Cues
CREATE TABLE music_cues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    timeline_item_id UUID REFERENCES timeline_items(id) ON DELETE CASCADE,
    cue_type VARCHAR(100) NOT NULL,
    track_title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    key_signature VARCHAR(20),
    chord_chart_content TEXT,
    time_cue VARCHAR(100),
    is_live_performance BOOLEAN DEFAULT false
);

-- VIP Phonetics & Announcements
CREATE TABLE vip_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    role VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phonetic_spelling VARCHAR(255) NOT NULL
);
```

---

## 5. Client Planning Portal & Live Production Engine

### 5.1 Client Portal (PWA)
* **Access:** No passwords. Persistent magic links (`/hub/[token]`) with 1-click home screen install prompt.
* **Debounced Auto-Save:** Real-time form synchronization on timeline items and music blacklists.
* **3-Stage Progressive Intake:**
  1. *Foundation (Post-Deposit):* Venue address, coordinator contact, high-level vibe sliders.
  2. *Cues & VIPs (90–14 Days Out):* Processional/Recessional tracks, First Dance cues, Phonetic VIP roster.
  3. *Production Lock (14 Days Out):* Final timeline sign-off and 1-page printable run-sheet export.

### 5.2 "Crossroads Live" Drift Engine
* **Dynamic Time Shifting:** When the MC marks a timeline block (e.g. Speeches) as started, any delay automatically cascades forward across all remaining events (Cake Cutting, First Dance, Open Floor).
* **Vendor View:** Zero-auth, read-only web view (`/live/[token]`) accessible by photographers and venue coordinators on their phones.

---

## 6. Implementation Milestones

| Phase | Duration | Core Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Foundation & Leads** | Weeks 1–2 | Next.js 14 App Router, Neon Postgres connection, $1k landing page, Stripe $500 retainer checkout. |
| **Phase 2: Client Portal (PWA)** | Weeks 3–4 | Magic link client portal (`/hub/[token]`), debounced auto-save timeline, VIP phonetics, 1-page PDF export. |
| **Phase 3: Live Production** | Weeks 5–6 | "Crossroads Live" drift-engine clock, Planning Center blockouts, Acoustic chord stand. |
| **Phase 4: Slide Deck & Nic Launch** | Weeks 7–8 | Presentation deck generation for Nic, payroll tracking, Stripe Connect payout setup. |
