-- Phase 1 platform schema (CLAUDE.md §3, deviations §9.3).
-- Idempotent and additive by policy: safe to run on every build,
-- including against a completely fresh database.

-- The legacy leads table predates the platform (scripts/create-leads-table.sql
-- was only ever run by hand). Created here first so the ALTERs at the bottom
-- work on a fresh database, not just the one prod DB that already has it.
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  event_date TEXT,
  venue TEXT,
  services TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enums: CREATE TYPE has no IF NOT EXISTS, so guard each one.
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('super_admin', 'franchise_owner', 'talent', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('inquiry', 'deposit_paid', 'talent_assigned', 'planning_locked', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispatch_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- To add an enum value later, append an ALTER TYPE ... ADD VALUE IF NOT EXISTS
-- line below. Editing the CREATE TYPE lists above never reaches a database
-- where the type already exists (duplicate_object is swallowed by design).

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    stripe_account_id VARCHAR(255),
    royalty_rate NUMERIC(4, 3) DEFAULT 0.070,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    skills TEXT[] NOT NULL DEFAULT '{dj,mc}',
    base_payout_rate NUMERIC(10, 2) DEFAULT 750.00,
    stripe_connect_account_id VARCHAR(255),
    payout_percentage NUMERIC(4, 3) DEFAULT 0.750,
    bio TEXT,
    headshot_url TEXT,
    rating_avg NUMERIC(3, 2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talent_blockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID REFERENCES talent_profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_talent_blockouts ON talent_blockouts (talent_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS weddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    access_token VARCHAR(64) UNIQUE NOT NULL,
    client_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    couple_names VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    event_date DATE NOT NULL,
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT,
    venue_contact_email VARCHAR(255),
    venue_requires_coi BOOLEAN DEFAULT true,
    package_type VARCHAR(100) DEFAULT 'standard_dj_mc',
    addons JSONB DEFAULT '[]'::jsonb,
    spotify_playlist_url VARCHAR(500),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    is_deposit_paid BOOLEAN DEFAULT false,
    is_balance_paid BOOLEAN DEFAULT false,
    status event_status NOT NULL DEFAULT 'inquiry',
    assigned_talent_id UUID REFERENCES talent_profiles(id) ON DELETE SET NULL,
    secondary_talent_id UUID REFERENCES talent_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weddings_event_date ON weddings (tenant_id, event_date);
-- access_token is UNIQUE, which already indexes it; drop the redundant index
-- an earlier build may have created.
DROP INDEX IF EXISTS idx_weddings_access_token;

CREATE TABLE IF NOT EXISTS timeline_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'ceremony',
    scheduled_start_time TIME NOT NULL,
    estimated_duration_minutes INT NOT NULL DEFAULT 10,
    actual_start_time TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT false,
    mc_notes TEXT,
    cue_notes TEXT,
    assigned_role VARCHAR(50) DEFAULT 'dj',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_wedding ON timeline_items (wedding_id, order_index);

CREATE TABLE IF NOT EXISTS music_cues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    timeline_item_id UUID REFERENCES timeline_items(id) ON DELETE CASCADE,
    cue_type VARCHAR(100) NOT NULL,
    track_title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    spotify_url VARCHAR(500),
    time_cue VARCHAR(100),
    key_signature VARCHAR(10),
    chord_chart_content TEXT,
    audio_file_url VARCHAR(500),
    is_live_performance BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS vip_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    role VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phonetic_spelling VARCHAR(255) NOT NULL,
    entrance_song_override VARCHAR(255),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS playlist_curations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    track_title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    spotify_id VARCHAR(100),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS talent_dispatch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    talent_id UUID REFERENCES talent_profiles(id) ON DELETE CASCADE,
    dispatched_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    status dispatch_status DEFAULT 'pending',
    response_at TIMESTAMPTZ,
    payout_offered NUMERIC(10, 2) NOT NULL
);

-- The live leads table predates the platform: keep it, extend it additively
-- (CLAUDE.md §9.3). Existing columns and serial PK are untouched.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id UUID;
-- SET NULL, not CASCADE: leads predate tenants and deleting a tenant must not
-- erase inquiry history. The DO block also repairs any DB where an earlier
-- build applied the constraint as CASCADE.
DO $$ BEGIN
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_tenant_id_fkey;
  ALTER TABLE leads ADD CONSTRAINT leads_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'site_form';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS auto_provisioned_wedding_id UUID REFERENCES weddings(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'new';

-- Phase 2 review fix: per-section revision counters for the hub's replace-all
-- saves. A stale tab or second device must get a 409 and refresh instead of
-- silently wiping rows the other partner just saved.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS hub_section_revs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Couples split their music across multiple shared Spotify playlists
-- (cocktail hour, dinner, dance floor), so the hub stores a list of
-- {label, url} rows. The original single spotify_playlist_url column stays
-- as the booking-form capture and legacy fallback.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS spotify_playlist_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Phase 3: read-only share token for the zero-auth live day-of view
-- (/live/[share_token]). Separate from access_token so vendors and printed
-- pages never carry the write-capable hub credential. pgcrypto backfills
-- existing rows; new bookings mint the token in app code.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
DO $$ BEGIN
  UPDATE weddings SET share_token = encode(gen_random_bytes(24), 'hex') WHERE share_token IS NULL;
EXCEPTION WHEN undefined_function THEN
  -- No pgcrypto means no cryptographically random backfill; leave NULL (the
  -- hub hides the share card for those rows) rather than mint weak tokens
  -- from random(), which is not a CSPRNG.
  NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_weddings_share_token ON weddings (share_token);

-- Milestone check-in texts (90/30/14 days out, daily cron): the milestones
-- already sent per wedding, e.g. [90, 30]. Marked inside the cron route so a
-- text never repeats; jsonb so future milestone sets need no DDL.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS checkins_sent JSONB NOT NULL DEFAULT '[]'::jsonb;

-- One master conversation per wedding (owner decision 2026-08-28, AppFolio
-- model): couple and team write into the same thread; the hub renders it for
-- the couple, the admin dashboard renders it for Jake and Nic. Email and,
-- later, SMS are only doors into this thread, never the thread itself.
CREATE TABLE IF NOT EXISTS wedding_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL, -- 'couple' | 'team'
    sender_name VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    read_by_team BOOLEAN NOT NULL DEFAULT false,
    read_by_couple BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wedding_messages_thread ON wedding_messages (wedding_id, created_at);

-- Service agreement (owner directive 2026-08-30). The couple accepts in the
-- hub; the snapshot freezes the exact terms they agreed to (services, prices,
-- date, venue) so later edits to the wedding row can never rewrite history.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS contract_version VARCHAR(20);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS contract_accepted_at TIMESTAMPTZ;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS contract_accepted_name VARCHAR(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS contract_snapshot JSONB;

-- Countersignature (owner directive 2026-10-20): the printed copy a couple is
-- handed must show both sides signed and dated. Written once, after the
-- couple's acceptance, from /admin/[key]/contract/[weddingId].
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS contract_countersigned_at TIMESTAMPTZ;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS contract_countersigned_name VARCHAR(255);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS contract_countersigned_title VARCHAR(255);

-- Custom arrangements (owner directive 2026-08-30): some weddings predate the
-- pricing model or settle in trade. When set, this free text replaces the
-- standard cost section of the service agreement verbatim, so the couple's
-- paperwork matches the deal they actually made.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS custom_terms TEXT;

-- Per-moment notes on music cues (owner directive 2026-08-30): couples explain
-- what a song is for and how to handle it ("fade it early, it runs long"), and
-- the DJ reads it off the run sheet.
ALTER TABLE music_cues ADD COLUMN IF NOT EXISTS notes TEXT;

-- The couple's own documents (owner directive 2026-08-30). Kat's order-of-
-- events graphic, wedding-party card and printed timeline are the OFFICIAL
-- communication; our run sheet shadows them. They live beside our schedule in
-- the hub so the couple can audit one against the other. Bytes go in Postgres
-- deliberately: no blob store is configured, the files are a handful of images
-- per wedding, and a hub document must never outlive the wedding row.
CREATE TABLE IF NOT EXISTS wedding_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID REFERENCES weddings(id) ON DELETE CASCADE,
    label VARCHAR(120) NOT NULL DEFAULT '',
    file_name VARCHAR(255) NOT NULL DEFAULT '',
    mime_type VARCHAR(100) NOT NULL,
    byte_size INTEGER NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wedding_documents ON wedding_documents (wedding_id, created_at);

-- Per-wedding art theme (owner directive 2026-08-30). Couples can bring their
-- own invitation art for the guest-facing pages. The slug names a folder under
-- public/wedding-art/, and it lives on the row rather than in code because the
-- repository is PUBLIC: keying art by a wedding's share token would publish a
-- live read credential.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS art_theme VARCHAR(60);

-- The couple's own wedding website and the dress code they published to guests
-- (owner directive 2026-08-30). Couples send guests to a Zola or Squarespace
-- site long before they meet us; our guest-facing order of events should point
-- back at it rather than compete with it, and the MC needs to know what the
-- room was told to wear.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS wedding_site_url VARCHAR(500);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS dress_code VARCHAR(200);

-- Songs are a list, not a fixed grid (owner directive 2026-08-30). A wedding
-- can need two or three processional songs, or a moment we never thought of,
-- so a cue carries its own label and its own place in the order rather than
-- being keyed one-per-type.
ALTER TABLE music_cues ADD COLUMN IF NOT EXISTS label VARCHAR(120);
ALTER TABLE music_cues ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- Couple names as four fields instead of one free-text string (owner directive
-- 2026-09-03). The booking form asked for "Jane & Sam" in a single box, which
-- is fine to print at the top of a hub and useless for anything else. Surnames
-- are what make a hub URL readable, so they have to be captured separately.
--
-- couple_names stays and stays authoritative for display: it holds the first
-- names ("Jane & Sam") and existing rows keep whatever was typed. Nothing
-- backfills the four columns for old weddings, because guessing which half of
-- "Jane & Sam" is a surname is how you end up addressing a couple wrongly on
-- their own wedding portal.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS partner_one_first VARCHAR(120);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS partner_one_last VARCHAR(120);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS partner_two_first VARCHAR(120);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS partner_two_last VARCHAR(120);

-- Extra people the couple wants in their hub: a planner, a parent, a maid of
-- honour. Stored on the wedding rather than in their own table because an
-- invite is a list of addresses, not an account: everyone reads the same hub
-- through the same credential.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS hub_invite_emails TEXT[] NOT NULL DEFAULT '{}';

-- Who can speak on the couple's side of the thread (owner directive
-- 2026-09-03). Before this, every message from the hub was stored under
-- couple_names, so a bride and her mother-in-law reading the same thread both
-- appeared as "Jane & Sam" and neither the couple nor the crew could tell who
-- had actually written anything.
--
-- This mirrors the team side exactly, and for the same reason: there is no
-- per-person login on either side of this product, so identity is declared,
-- not proven. The team picks from TEAM_NAMES; the hub picks from this list.
-- Nothing here is an access control. The hub URL is still the only credential,
-- and anyone holding it can pick any name on it.
--
-- Deliberately NOT backfilled by splitting couple_names on "&": "Jane & Sam"
-- is a display string, not a schema, and a hub that guesses a person's name
-- wrong is worse than one that asks. Existing weddings fall back to offering
-- couple_names as a single option until someone adds their own.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS hub_speakers TEXT[] NOT NULL DEFAULT '{}';

-- Archiving, not deleting (owner directive 2026-09-03). Test bookings made
-- while building the site clutter the dashboard, and the obvious fix is a
-- delete button. A delete button on a table of real weddings is a mistake
-- waiting for a tired Friday: the row that goes is the one somebody is
-- standing at a venue for. Archived weddings vanish from the dashboard and
-- live on their own screen, which costs nothing and cannot lose anything.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_weddings_archived ON weddings (archived_at);

-- Native intro-call booking with per-person office hours (owner directive
-- 2026-09-03: "we'll move forward with the calendar booking with office
-- hours. It's built natively"). This replaces the unset NEXT_PUBLIC_BOOKING_URL
-- Calendly-shaped hole, and it is what the QR code on every printed business
-- card resolves to: crossroadsweddingco.shop/book?with=<slug>.
--
-- OFFICE HOURS ARE WALL CLOCK IN THE VENUE ZONE, because that is how a person
-- thinks about their own evening: "Tuesdays, six to eight". Stored as minutes
-- from midnight rather than TIME, for two reasons. A TIME column looks like it
-- knows a timezone and does not, which is the exact confusion this feature has
-- to avoid; and lib/scheduling.ts does its arithmetic in minutes anyway, so an
-- integer is the value with no parse step and no format to get wrong.
CREATE TABLE IF NOT EXISTS office_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_slug VARCHAR(40) NOT NULL,
    weekday SMALLINT NOT NULL,        -- 0 = Sunday, matching Date#getDay
    start_minute SMALLINT NOT NULL,   -- minutes from venue-local midnight
    end_minute SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_office_hours_person ON office_hours (person_slug, weekday);

-- An appointment is an INSTANT, not a wall clock. Everything the visitor sees
-- is rendered from this instant into the venue zone, so a couple booking from
-- a phone still set to Pacific sees the time Indiana will actually ring.
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_slug VARCHAR(40) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    duration_minutes SMALLINT NOT NULL DEFAULT 30,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    event_date DATE,
    notes TEXT NOT NULL DEFAULT '',
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_person ON appointments (person_slug, starts_at);

-- THE DOUBLE-BOOKING GUARD IS A CONSTRAINT, NOT A CHECK BEFORE THE INSERT.
-- Two people at the same bridal expo scan the same card and tap the same 6:00
-- within a second of each other. A read-then-write cannot see the other
-- request; a unique index can, and the loser gets told the time just went
-- rather than both being told yes. Partial on cancelled_at so a cancelled slot
-- frees up again.
--
-- This catches identical start instants, which is the only collision that
-- exists while every slot for a person comes off one grid at one length. If a
-- second appointment length is ever offered, a 6:00 sixty and a 6:30 thirty
-- would overlap without colliding and this index would stop being sufficient:
-- it would need an EXCLUDE USING gist over a tstzrange instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_slot
    ON appointments (person_slug, starts_at) WHERE cancelled_at IS NULL;

-- One-time seed of everyone's call times (owner directive 2026-09-04, asked
-- and answered: "Mon-Thu, 6pm to 8pm" for all four).
--
-- Saturdays are deliberately empty and so are Fridays and Sundays: Saturday is
-- a wedding, Friday is setup and travel, Sunday is the day after. Four 30
-- minute slots a night, sixteen a week each.
--
-- SEEDS ARE RECORDED, NOT RE-DERIVED. The obvious guard is "insert only if
-- office_hours is empty", and it is wrong in one specific way that would look
-- like a haunting: somebody deliberately clears all four calendars for a
-- fortnight in August, and the next deploy quietly reopens every one of them.
-- A row in schema_seeds says this ran once and it never runs again, whatever
-- the table happens to hold afterwards.
CREATE TABLE IF NOT EXISTS schema_seeds (
    name VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO office_hours (person_slug, weekday, start_minute, end_minute)
SELECT p.slug, d.weekday, 1080, 1200   -- 18:00 to 20:00, venue wall clock
FROM (VALUES ('jake'), ('nic'), ('brayton'), ('ashton')) AS p(slug)
CROSS JOIN (VALUES (1), (2), (3), (4)) AS d(weekday)  -- Monday through Thursday
WHERE NOT EXISTS (SELECT 1 FROM schema_seeds WHERE name = 'office_hours_v1');

INSERT INTO schema_seeds (name) VALUES ('office_hours_v1') ON CONFLICT (name) DO NOTHING;

-- Lead attribution (2026-11-01, getting off WeddingPro): where each couple
-- found us, so every replacement channel can be judged on bookings rather than
-- on hope. See lib/lead-sources.ts. Additive and nullable: older rows simply
-- predate the question.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS lead_source VARCHAR(40);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS lead_source_detail VARCHAR(200);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS lead_src_tag VARCHAR(40);

-- Intro-call attribution (2026-11-01, corporate holiday party calls): the
-- ?src= tag a visitor carried when they booked a call. Corporate inquiries
-- come in as calls, not weddings rows, so without this a venue referral from
-- /events?src=venue would never be counted. Additive and nullable.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS src_tag VARCHAR(40);

-- Public notes board at /reviews (2026-11-01, Jacob). Anyone can sign it with
-- just a name, no email or login, so nothing shows until a person approves it:
-- approved_at NULL means waiting, hidden_at set means turned down. Nothing is
-- deleted, so a wrong click is one more click to undo. No rating column on
-- purpose: there are no stars, and no Review/AggregateRating markup.
CREATE TABLE IF NOT EXISTS guestbook_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL,
    relation VARCHAR(60) NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    featured BOOLEAN NOT NULL DEFAULT false,
    approved_at TIMESTAMPTZ,
    hidden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guestbook_created ON guestbook_entries (created_at DESC);

-- Custom edit flag per song (2026-11-05). A cue marked custom_edit is a cut,
-- mashup or fade the DJ must have prepared; the run sheet warns until the day.
ALTER TABLE music_cues ADD COLUMN IF NOT EXISTS custom_edit BOOLEAN NOT NULL DEFAULT false;

-- Shared call log for the lead playbook served at /admin/[key]/playbook
-- (2026-11-06, Jacob: "make this a static link that saves the changes we
-- make"). One row per lead id (the card's id in the playbook), holding the
-- same fields the claude.ai copy keeps: status, note, followUp, stars,
-- starWhy, starBy, at, by. Bookings feed the weekly deposit goal.
CREATE TABLE IF NOT EXISTS playbook_calls (
    lead_id VARCHAR(100) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS playbook_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Multi-tenant signup, first slice (2026-11-09, Jacob: "start on the
-- multi-tenant signup"). The platform is being opened to other wedding and
-- event businesses, so every row needs an owner account. Crossroads itself is
-- the HOUSE tenant, with a fixed id so code can name it without a lookup.
--
-- How the existing app keeps working untouched: tenant_id gets a DEFAULT of
-- the house id on every table the current code writes to, and NULLs are
-- backfilled to it. Every insert path that exists today (bookings, calls,
-- reviews, the playbook) therefore lands in the house account without a code
-- change, and the /admin/[key] dashboard reads only house rows. A customer
-- account's rows can never appear on the Crossroads dashboard.
--
-- New tenant_id columns use ON DELETE RESTRICT: deleting an account must never
-- silently take its bookings with it. (weddings and leads keep the FKs they
-- already had; there is no tenant delete anywhere in the app, on purpose.)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'customer';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type VARCHAR(40);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

INSERT INTO tenants (id, name, slug, domain, kind, plan)
VALUES ('00000000-0000-4000-8000-000000000001', 'Crossroads Wedding and Event Co.',
        'crossroads', 'crossroadsweddingco.shop', 'house', 'house')
ON CONFLICT (id) DO NOTHING;

UPDATE weddings SET tenant_id = '00000000-0000-4000-8000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE weddings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-4000-8000-000000000001';
UPDATE leads SET tenant_id = '00000000-0000-4000-8000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE leads ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-4000-8000-000000000001';

-- Guard for real client records (2026-11-09, Jacob: "these are real weddings and clients"). The
-- app never wrote tenant_id before accounts existed, but a tenant row inserted by hand would have
-- become kind 'customer' through the column default above and taken its weddings off the
-- Crossroads dashboard. A real customer account always has its owner user, created in the same
-- transaction as the tenant (lib/auth.ts createAccount), so a non-house tenant with NO users is
-- one that predates accounts: its weddings and leads belong to the house. Idempotent, and a no-op
-- when nothing matches, which is the expected case.
UPDATE weddings SET tenant_id = '00000000-0000-4000-8000-000000000001'
 WHERE tenant_id IN (SELECT t.id FROM tenants t
                      WHERE t.id <> '00000000-0000-4000-8000-000000000001'
                        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id));
UPDATE leads SET tenant_id = '00000000-0000-4000-8000-000000000001'
 WHERE tenant_id IN (SELECT t.id FROM tenants t
                      WHERE t.id <> '00000000-0000-4000-8000-000000000001'
                        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id));

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id UUID
    NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE office_hours ADD COLUMN IF NOT EXISTS tenant_id UUID
    NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;
ALTER TABLE guestbook_entries ADD COLUMN IF NOT EXISTS tenant_id UUID
    NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'
    REFERENCES tenants(id) ON DELETE RESTRICT;

-- Account owners sign in with an emailed link: no passwords. Both tables store
-- only a SHA-256 of the token, so a database read never yields a working link
-- or a working session. A login token is single use (used_at) and short lived;
-- the link opens a page with a button that POSTs, because mail scanners
-- prefetch GET links and would otherwise burn the token before the person
-- ever clicks it.
CREATE TABLE IF NOT EXISTS login_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_tokens_user ON login_tokens (user_id, created_at);

CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);

-- Integrations groundwork (2026-11-09, Jacob: "start laying the groundwork for
-- integrating with Plaid and Found"). Bank and card feeds come in through an
-- aggregator (Plaid first; Found has no public API, so a Found account is
-- reached through an aggregator if at all). These tables are the raw feed the
-- general ledger will later sit on: amounts are integer cents, every row
-- belongs to an account (tenant), and a provider's own ids are kept with a
-- unique constraint so a re-sync can never double-insert.
--
-- secret_ciphertext holds the provider's long-lived access token encrypted
-- with AES-256-GCM under INTEGRATIONS_KEY (lib/secrets.ts). It is never stored
-- or logged in plain text, and nothing in the app ever sends it to a browser.
CREATE TABLE IF NOT EXISTS integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    provider VARCHAR(30) NOT NULL,              -- 'plaid'
    external_id VARCHAR(200) NOT NULL,          -- Plaid item_id
    institution_id VARCHAR(100),
    institution_name VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- active | needs_reauth | disconnected | error
    secret_ciphertext TEXT,
    sync_cursor TEXT,
    last_synced_at TIMESTAMPTZ,
    last_error TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_external
    ON integration_connections (provider, external_id);
CREATE INDEX IF NOT EXISTS idx_integration_tenant ON integration_connections (tenant_id);

CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE RESTRICT,
    external_id VARCHAR(200) NOT NULL,          -- Plaid account_id
    name VARCHAR(200) NOT NULL,
    official_name VARCHAR(200),
    mask VARCHAR(10),
    type VARCHAR(30),                           -- depository | credit | loan | investment
    subtype VARCHAR(40),                        -- checking | savings | credit card ...
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    current_balance_cents BIGINT,
    available_balance_cents BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_external ON bank_accounts (connection_id, external_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON bank_accounts (tenant_id);

-- amount_cents: POSITIVE = money INTO the account, negative = money out.
-- Plaid reports the opposite sign (positive = outflow); lib/integrations/plaid.ts
-- flips it once on the way in so nothing downstream has to remember.
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
    external_id VARCHAR(200) NOT NULL,          -- Plaid transaction_id
    posted_date DATE NOT NULL,
    authorized_date DATE,
    amount_cents BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    merchant VARCHAR(255),
    description TEXT NOT NULL DEFAULT '',
    raw_category VARCHAR(120),
    pending BOOLEAN NOT NULL DEFAULT false,
    -- Review state for the coming categorization step. Nothing here posts to a
    -- ledger yet; a bank line only becomes books when a person or a rule says so.
    review_status VARCHAR(20) NOT NULL DEFAULT 'unreviewed', -- unreviewed | categorized | matched | excluded
    removed_at TIMESTAMPTZ,                     -- the bank withdrew it (pending that never posted)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_tx_external ON bank_transactions (bank_account_id, external_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_tenant_date ON bank_transactions (tenant_id, posted_date DESC);

-- ── Bank transaction review: categories, rules, and who sorted what ──────────
-- (2026-11-09) The review queue sits on bank_transactions. A category is the
-- business's own word for a kind of money (Event income, Gear, Fuel); it is
-- NOT a general-ledger account yet. gl_code is left for the ledger layer to
-- fill in from the posting rules, so this table can be mapped, not rebuilt.
CREATE TABLE IF NOT EXISTS ledger_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(80) NOT NULL,
    kind VARCHAR(20) NOT NULL,                  -- income | expense | transfer | equity
    tax_line VARCHAR(80),                       -- a Schedule C hint, never a promise
    gl_code VARCHAR(20),                        -- filled in by the ledger layer
    sort_order INT NOT NULL DEFAULT 100,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_categories_name ON ledger_categories (tenant_id, lower(name));

-- A rule sorts NEW bank lines the way a person already sorted one. It never
-- touches a row a person has reviewed or reopened (rules_paused).
CREATE TABLE IF NOT EXISTS categorization_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    match_field VARCHAR(20) NOT NULL,           -- merchant | description
    match_type VARCHAR(20) NOT NULL,            -- equals | contains
    pattern VARCHAR(200) NOT NULL,
    direction VARCHAR(10) NOT NULL DEFAULT 'any', -- any | in | out
    action VARCHAR(20) NOT NULL,                -- categorize | exclude
    category_id UUID REFERENCES ledger_categories(id) ON DELETE RESTRICT,
    applied_count INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_tenant ON categorization_rules (tenant_id);

ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES ledger_categories(id) ON DELETE RESTRICT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES categorization_rules(id) ON DELETE SET NULL;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS rules_paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS pending_external_id VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_bank_tx_review ON bank_transactions (tenant_id, review_status, posted_date DESC);

-- ── The ledger (docs/FINANCIALS_SPEC.md, 2026-11-09) ─────────────────────────
-- Double entry, cash basis, append-only. Entries are derived from sorted bank
-- lines; a change voids the old entry and posts a new one, nothing is edited.
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(20) NOT NULL,                  -- asset | liability | equity | income | expense
    system_key VARCHAR(40),                     -- transfers_clearing | opening_equity
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_accounts_code ON ledger_accounts (tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_accounts_system ON ledger_accounts (tenant_id, system_key) WHERE system_key IS NOT NULL;

ALTER TABLE ledger_categories ADD COLUMN IF NOT EXISTS ledger_account_id UUID REFERENCES ledger_accounts(id) ON DELETE RESTRICT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS ledger_account_id UUID REFERENCES ledger_accounts(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    entry_date DATE NOT NULL,
    memo TEXT NOT NULL DEFAULT '',
    source_type VARCHAR(30) NOT NULL,           -- bank_transaction | opening_balance
    source_id UUID,                             -- bank_transactions.id or bank_accounts.id
    status VARCHAR(10) NOT NULL DEFAULT 'posted', -- posted | void
    voided_at TIMESTAMPTZ,
    void_reason VARCHAR(200),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- What the entry was posted from (date, accounts, amount). A source whose
-- fingerprint no longer matches gets its entry voided and reposted.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(200);
-- One live entry per source: the guard against double posting under a race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_live_source
    ON journal_entries (tenant_id, source_type, source_id) WHERE status = 'posted';
CREATE INDEX IF NOT EXISTS idx_journal_tenant_date ON journal_entries (tenant_id, entry_date);

CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    debit_cents BIGINT NOT NULL DEFAULT 0,
    credit_cents BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT journal_line_one_side CHECK (
        debit_cents >= 0 AND credit_cents >= 0 AND (debit_cents = 0) <> (credit_cents = 0)
    )
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines (tenant_id, account_id);

-- Checked at COMMIT: every entry touched balances, has at least two lines, and
-- every line's account and tenant match the entry's tenant. The code checks this
-- too; the database is the lock that holds when the code is wrong.
CREATE OR REPLACE FUNCTION journal_entry_check() RETURNS trigger AS $$
DECLARE
    eid UUID := COALESCE(NEW.entry_id, OLD.entry_id);
    d BIGINT; c BIGINT; n INT; bad INT; etenant UUID;
BEGIN
    SELECT tenant_id INTO etenant FROM journal_entries WHERE id = eid;
    SELECT COALESCE(sum(debit_cents),0), COALESCE(sum(credit_cents),0), count(*)
      INTO d, c, n FROM journal_lines WHERE entry_id = eid;
    IF n < 2 OR d <> c THEN
        RAISE EXCEPTION 'journal entry % does not balance (debits %, credits %, lines %)', eid, d, c, n;
    END IF;
    SELECT count(*) INTO bad FROM journal_lines l JOIN ledger_accounts a ON a.id = l.account_id
     WHERE l.entry_id = eid AND (l.tenant_id <> etenant OR a.tenant_id <> etenant);
    IF bad > 0 THEN
        RAISE EXCEPTION 'journal entry % mixes tenants', eid;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS journal_lines_balance ON journal_lines;
CREATE CONSTRAINT TRIGGER journal_lines_balance
    AFTER INSERT OR UPDATE OR DELETE ON journal_lines
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION journal_entry_check();

-- ── Matching deposits to bookings (2026-11-09) ──────────────────────────────
-- A money-in bank line can be tied to one of the account's bookings. Matching
-- is a link on the line, not a review status: a matched line is still a sorted
-- (categorized) income line and posts to the ledger exactly as before.
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES weddings(id) ON DELETE SET NULL;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS payment_kind VARCHAR(20); -- deposit | balance
CREATE INDEX IF NOT EXISTS idx_bank_tx_booking ON bank_transactions (tenant_id, booking_id) WHERE booking_id IS NOT NULL;

-- Wedding website (2026-11-11, Jacob: "mock up a public site for Lauren and
-- Clay"). A public page for guests at /w/<site_slug>, switched on by the couple
-- from their hub and built from what they already entered there (names, date,
-- venue, the guest schedule, dress code) plus the few things only a website
-- needs: their story, links (registry, hotel block) and answers to guest
-- questions. Off by default: nothing about a wedding is public until the
-- couple turns it on. The slug carries a six-character random tail, so knowing
-- a couple's names is not enough to find their page.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS site_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS site_slug VARCHAR(90);
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS site_story TEXT;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS site_links JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS site_faq JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS idx_weddings_site_slug ON weddings (site_slug) WHERE site_slug IS NOT NULL;

-- Notes tied to an event (2026-11-11, Jacob: "a page for Kat and Tanis ... and a
-- place for the bride and groom to comment their experience"). A note signed on
-- an event page carries that page's slug; a note the couple writes from inside
-- their own planning hub carries their wedding, which is what proves it is
-- them. Both still wait for approval like every other note.
ALTER TABLE guestbook_entries ADD COLUMN IF NOT EXISTS event_slug VARCHAR(80);
ALTER TABLE guestbook_entries ADD COLUMN IF NOT EXISTS wedding_id UUID REFERENCES weddings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_guestbook_event ON guestbook_entries (event_slug);
CREATE INDEX IF NOT EXISTS idx_guestbook_wedding ON guestbook_entries (wedding_id);

-- Engagement photos for the wedding website (2026-11-11, Jacob: "add any
-- engagement pictures"). Bytes in Postgres like wedding_documents, for the same
-- reasons: no blob store, a handful per wedding, and a photo must never outlive
-- its wedding. The hub resizes each photo in the browser before upload (long
-- edge 2000px, re-encoded as JPEG), which also drops EXIF and GPS. Served
-- publicly only while the couple's site is switched on.
CREATE TABLE IF NOT EXISTS site_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
    mime_type VARCHAR(40) NOT NULL,
    byte_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    caption VARCHAR(200) NOT NULL DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_photos_wedding ON site_photos (wedding_id, order_index);

-- Vendors (2026-11-11, Jacob: "Vendors", "think wedding ERP"). The people and
-- companies an account pays: second DJs, techs, rentals, the music pool. A
-- vendor's payments are FOUND, not typed: money-out bank lines whose merchant
-- or description contains one of the vendor's match words. Contractors get a
-- yearly total against the IRS 1099-NEC threshold. Only a "W-9 on file" flag
-- is stored, never a taxpayer id: this table is not the place for one.
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'contractor', -- contractor | supplier | venue | subscription | other
    email VARCHAR(255),
    phone VARCHAR(50),
    match_text VARCHAR(400) NOT NULL DEFAULT '',     -- comma separated words found on bank lines
    is_1099 BOOLEAN NOT NULL DEFAULT false,
    w9_on_file BOOLEAN NOT NULL DEFAULT false,
    notes TEXT NOT NULL DEFAULT '',
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors (tenant_id);

-- Where each business account came from (2026-11-11, Jacob: "aggressively
-- guerilla market in person"). The first-touch ?src= tag the visitor arrived
-- with (expo QR, DJ meetup card, an ad), so every channel is judged on
-- signups, not hope. Same tag rules as weddings.lead_src_tag.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS signup_src VARCHAR(40);

-- Separate service agreements inside a couple's hub (2026-11-12, Jake and
-- Terry). First kind: officiating, sold as Compass Events by Crossroads
-- Wedding and Event Co. and signed for Compass Events by Terry Winchester,
-- its CEO. Own deposit, balance and signatures; the wedding's Crossroads
-- agreement is untouched. One live agreement per wedding and kind.
CREATE TABLE IF NOT EXISTS service_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wedding_id UUID NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL DEFAULT 'officiant',
    brand VARCHAR(30) NOT NULL DEFAULT 'compass',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    fee_usd NUMERIC(10, 2) NOT NULL,
    deposit_usd NUMERIC(10, 2) NOT NULL,
    balance_due_hours INTEGER NOT NULL DEFAULT 48,
    accepted_at TIMESTAMPTZ,
    accepted_name VARCHAR(255),
    snapshot JSONB,
    countersigned_at TIMESTAMPTZ,
    countersigned_name VARCHAR(255),
    countersigned_title VARCHAR(255),
    deposit_paid_at TIMESTAMPTZ,
    balance_paid_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_agreements_live
    ON service_agreements (wedding_id, kind) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_agreements_wedding ON service_agreements (wedding_id);
