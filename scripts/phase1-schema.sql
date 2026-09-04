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
-- card resolves to: crossroadsweddingco.com/book?with=<slug>.
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
