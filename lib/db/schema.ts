import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";

// Enums (CLAUDE.md §3). Kept in sync with scripts/phase1-schema.sql by hand;
// migrations in this repo are hand-authored, additive, idempotent SQL.
// Adding a value here requires an ALTER TYPE ... ADD VALUE IF NOT EXISTS line
// in the SQL file: editing its CREATE TYPE list is a silent no-op on any
// database where the type already exists.
export const userRole = pgEnum("user_role", [
  "super_admin",
  "franchise_owner",
  "talent",
  "client",
]);

export const eventStatus = pgEnum("event_status", [
  "inquiry",
  "deposit_paid",
  "talent_assigned",
  "planning_locked",
  "in_progress",
  "completed",
  "cancelled",
]);

export const dispatchStatus = pgEnum("dispatch_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);

// 1. Tenants (franchise nodes)
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  domain: varchar("domain", { length: 255 }),
  stripeAccountId: varchar("stripe_account_id", { length: 255 }),
  royaltyRate: numeric("royalty_rate", { precision: 4, scale: 3 }).default("0.070"),
  isActive: boolean("is_active").default(true),
  /** "house" for Crossroads itself, "customer" for a business that signed up. */
  kind: varchar("kind", { length: 20 }).notNull().default("customer"),
  /** BUSINESS_TYPES key from lib/tenant-constants.ts. */
  businessType: varchar("business_type", { length: 40 }),
  plan: varchar("plan", { length: 20 }).notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  /** First-touch ?src= tag the owner arrived with (expo, card, ad). lib/lead-sources.ts cleanSrcTag. */
  signupSrc: varchar("signup_src", { length: 40 }),
  /** Platform billing (Stripe). See lib/billing.ts. */
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  /** Stripe's subscription status as last reported: trialing, active, past_due, canceled... */
  billingStatus: varchar("billing_status", { length: 30 }),
  billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }),
  /** Created time of the last Stripe event applied, so an older event never overwrites a newer one. */
  billingEventAt: timestamp("billing_event_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. Users & roles
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: userRole("role").notNull().default("client"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. Talent profiles
export const talentProfiles = pgTable("talent_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  skills: text("skills").array().notNull().default(["dj", "mc"]),
  basePayoutRate: numeric("base_payout_rate", { precision: 10, scale: 2 }).default("750.00"),
  stripeConnectAccountId: varchar("stripe_connect_account_id", { length: 255 }),
  payoutPercentage: numeric("payout_percentage", { precision: 4, scale: 3 }).default("0.750"),
  bio: text("bio"),
  headshotUrl: text("headshot_url"),
  ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).default("5.00"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 4. Talent blockout dates
export const talentBlockouts = pgTable(
  "talent_blockouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    talentId: uuid("talent_id").references(() => talentProfiles.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_talent_blockouts").on(t.talentId, t.startDate, t.endDate)],
);

// 5. Weddings / events master record.
// Deviations from spec (CLAUDE.md §9.3): contact_email/contact_phone live here
// because inquiry-stage bookings predate any users row; venue_address is
// nullable for the same reason; spotify_playlist_url captures the couple's own
// shared playlist (§9.2, priority integration).
export const weddings = pgTable(
  "weddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    accessToken: varchar("access_token", { length: 64 }).notNull().unique(),
    // Read-only credential for /live/[share_token]; never grants writes.
    shareToken: varchar("share_token", { length: 64 }).unique(),
    clientUserId: uuid("client_user_id").references(() => users.id, { onDelete: "set null" }),
    coupleNames: varchar("couple_names", { length: 255 }).notNull(),
    // Display name for the hub heading, e.g. "Jane & Sam". The four fields
    // below are the structured version: first names for addressing them,
    // surnames for building a readable hub URL. Nullable because weddings
    // booked before 2026-09-03 only ever had the single free-text field.
    partnerOneFirst: varchar("partner_one_first", { length: 120 }),
    partnerOneLast: varchar("partner_one_last", { length: 120 }),
    partnerTwoFirst: varchar("partner_two_first", { length: 120 }),
    partnerTwoLast: varchar("partner_two_last", { length: 120 }),
    // Extra addresses the couple asked us to let into their hub.
    hubInviteEmails: text("hub_invite_emails").array().notNull().default([]),
    // First names allowed on the couple's side of the message thread. Declared,
    // not authenticated: see the note in phase1-schema.sql.
    hubSpeakers: text("hub_speakers").array().notNull().default([]),
    // Set when the wedding is hidden from the dashboard. Never deleted: see
    // the note in phase1-schema.sql.
    /** When the booking was cancelled; a kept deposit is earned that day (accrual, 2026-11-13). */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    eventDate: date("event_date").notNull(),
    venueName: varchar("venue_name", { length: 255 }).notNull(),
    venueAddress: text("venue_address"),
    venueContactEmail: varchar("venue_contact_email", { length: 255 }),
    venueRequiresCoi: boolean("venue_requires_coi").default(true),
    packageType: varchar("package_type", { length: 100 }).default("standard_dj_mc"),
    addons: jsonb("addons").default([]),
    spotifyPlaylistUrl: varchar("spotify_playlist_url", { length: 500 }),
    // [{label, url}] rows managed in the hub; the single column above is the
    // booking-form capture and read-only fallback seed.
    spotifyPlaylistUrls: jsonb("spotify_playlist_urls").notNull().default([]),
    // Per-section revision counters ({"timeline": 3, ...}) backing the hub's
    // optimistic concurrency; bumped inside each replace-all transaction.
    hubSectionRevs: jsonb("hub_section_revs").notNull().default({}),
    // Milestone check-in texts already sent for this wedding, e.g. [90, 30].
    checkinsSent: jsonb("checkins_sent").notNull().default([]),
    // Service agreement: version accepted, who typed their name, when, and a
    // frozen snapshot of the terms as of acceptance.
    contractVersion: varchar("contract_version", { length: 20 }),
    contractAcceptedAt: timestamp("contract_accepted_at", { withTimezone: true }),
    contractAcceptedName: varchar("contract_accepted_name", { length: 255 }),
    contractSnapshot: jsonb("contract_snapshot"),
    // Our countersignature: who signed for Crossroads, as what, and when. Set
    // once, from the owner's agreement page, only after the couple accepted.
    contractCountersignedAt: timestamp("contract_countersigned_at", { withTimezone: true }),
    contractCountersignedName: varchar("contract_countersigned_name", { length: 255 }),
    contractCountersignedTitle: varchar("contract_countersigned_title", { length: 255 }),
    // Free-text arrangement that replaces the agreement's standard cost
    // section: legacy deals, trades, comped weddings.
    customTerms: text("custom_terms"),
    /** Slug of a folder under public/wedding-art/, or null for the plain look. */
    artTheme: varchar("art_theme", { length: 60 }),
    /** The couple's own wedding site (Zola, Squarespace, The Knot). */
    weddingSiteUrl: varchar("wedding_site_url", { length: 500 }),
    /** What guests were told to wear, in the couple's own words. */
    dressCode: varchar("dress_code", { length: 200 }),
    /** Public wedding website at /w/<siteSlug>: off until the couple turns it on. */
    siteEnabled: boolean("site_enabled").notNull().default(false),
    siteSlug: varchar("site_slug", { length: 90 }),
    siteStory: text("site_story"),
    /** [{label, url}] registry, hotel block, their own site. lib/wedding-site-constants.ts */
    siteLinks: jsonb("site_links").notNull().default([]),
    /** [{q, a}] answers to guest questions. */
    siteFaq: jsonb("site_faq").notNull().default([]),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("1000.00"),
    depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull().default("500.00"),
    isDepositPaid: boolean("is_deposit_paid").default(false),
    isBalancePaid: boolean("is_balance_paid").default(false),
    status: eventStatus("status").notNull().default("inquiry"),
    assignedTalentId: uuid("assigned_talent_id").references(() => talentProfiles.id, {
      onDelete: "set null",
    }),
    secondaryTalentId: uuid("secondary_talent_id").references(() => talentProfiles.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    // Where the couple found us (lib/lead-sources.ts). lead_source is what they
    // told us, lead_source_detail who (the friend, the venue), lead_src_tag what
    // the link told us (?src= on a QR code or TV vanity URL). Nullable: every
    // booking before 2026-11-01 predates the question.
    leadSource: varchar("lead_source", { length: 40 }),
    leadSourceDetail: varchar("lead_source_detail", { length: 200 }),
    leadSrcTag: varchar("lead_src_tag", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_weddings_event_date").on(t.tenantId, t.eventDate)],
);

// 6. Timeline items (real-time run sheet)
export const timelineItems = pgTable(
  "timeline_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }).default("ceremony"),
    scheduledStartTime: time("scheduled_start_time").notNull(),
    estimatedDurationMinutes: integer("estimated_duration_minutes").notNull().default(10),
    actualStartTime: timestamp("actual_start_time", { withTimezone: true }),
    isCompleted: boolean("is_completed").default(false),
    mcNotes: text("mc_notes"),
    cueNotes: text("cue_notes"),
    assignedRole: varchar("assigned_role", { length: 50 }).default("dj"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_timeline_wedding").on(t.weddingId, t.orderIndex)],
);

// 7. Music cues (chords, cues, tracks)
export const musicCues = pgTable("music_cues", {
  id: uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
  timelineItemId: uuid("timeline_item_id").references(() => timelineItems.id, {
    onDelete: "cascade",
  }),
  cueType: varchar("cue_type", { length: 100 }).notNull(),
  trackTitle: varchar("track_title", { length: 255 }).notNull(),
  artist: varchar("artist", { length: 255 }).notNull(),
  spotifyUrl: varchar("spotify_url", { length: 500 }),
  timeCue: varchar("time_cue", { length: 100 }),
  keySignature: varchar("key_signature", { length: 10 }),
  chordChartContent: text("chord_chart_content"),
  audioFileUrl: varchar("audio_file_url", { length: 500 }),
  isLivePerformance: boolean("is_live_performance").default(false),
  /** The couple's own name for this moment, e.g. "Processional 2". */
  label: varchar("label", { length: 120 }),
  /** Songs are an ordered list; several can share a cue type. */
  orderIndex: integer("order_index").notNull().default(0),
  // The couple's own note for this moment, shown to the DJ on the run sheet.
  notes: text("notes"),
  /** The DJ plays a custom edit of this song (a cut, a mashup, a fade the
   *  couple asked for), so the file has to be in hand before the day. */
  customEdit: boolean("custom_edit").notNull().default(false),
});

// 7b. Wedding messages: the one master conversation per wedding (AppFolio
// model, owner decision 2026-08-28). Couple and team write into the same
// thread; email/SMS only point at it.
export const weddingMessages = pgTable(
  "wedding_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
    sender: varchar("sender", { length: 20 }).notNull(),
    senderName: varchar("sender_name", { length: 100 }).notNull(),
    body: text("body").notNull(),
    readByTeam: boolean("read_by_team").notNull().default(false),
    readByCouple: boolean("read_by_couple").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_wedding_messages_thread").on(t.weddingId, t.createdAt)],
);

// 7b. The couple's own documents: their order-of-events graphic, wedding-party
// card, printed timeline. These are the official communication; our run sheet
// shadows them, so they sit beside our schedule in the hub for auditing.
export const weddingDocuments = pgTable(
  "wedding_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull().default(""),
    fileName: varchar("file_name", { length: 255 }).notNull().default(""),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    data: customType<{ data: Buffer; driverData: Buffer }>({
      dataType: () => "bytea",
    })("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_wedding_documents").on(t.weddingId, t.createdAt)],
);

// 8. VIP pronunciation & wedding-party roster
export const vipRoster = pgTable("vip_roster", {
  id: uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  role: varchar("role", { length: 100 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phoneticSpelling: varchar("phonetic_spelling", { length: 255 }).notNull(),
  entranceSongOverride: varchar("entrance_song_override", { length: 255 }),
  notes: text("notes"),
});

// 9. Playlists & blacklists
export const playlistCurations = pgTable("playlist_curations", {
  id: uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 50 }).notNull(),
  trackTitle: varchar("track_title", { length: 255 }).notNull(),
  artist: varchar("artist", { length: 255 }).notNull(),
  spotifyId: varchar("spotify_id", { length: 100 }),
  notes: text("notes"),
});

// 10. Automated talent dispatch cascade
export const talentDispatchLogs = pgTable("talent_dispatch_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "cascade" }),
  talentId: uuid("talent_id").references(() => talentProfiles.id, { onDelete: "cascade" }),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: dispatchStatus("status").default("pending"),
  responseAt: timestamp("response_at", { withTimezone: true }),
  payoutOffered: numeric("payout_offered", { precision: 10, scale: 2 }).notNull(),
});

// 11. Inbound leads. Predates the platform spec and holds production rows, so
// it keeps its serial PK and original columns; the spec's fields were added
// additively (CLAUDE.md §9.3). The live site form writes here.
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  eventDate: text("event_date"),
  venue: text("venue"),
  services: text("services"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // --- additive platform columns ---
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  phone: varchar("phone", { length: 50 }),
  source: varchar("source", { length: 100 }).default("site_form"),
  rawPayload: jsonb("raw_payload"),
  targetDate: date("target_date"),
  autoProvisionedWeddingId: uuid("auto_provisioned_wedding_id").references(() => weddings.id, {
    onDelete: "set null",
  }),
  status: varchar("status", { length: 50 }).default("new"),
});

// 12. Office hours and intro-call appointments.
//
// Deliberately NOT keyed to talent_profiles or users. The people bookable here
// are the four on the printed business cards, identified by the same slug the
// card's QR code carries (/book?with=brayton). Nobody on this side of the
// product has an account, and inventing one so a calendar could join to it
// would put a login between a couple at a bridal expo and a phone call.
export const officeHours = pgTable(
  "office_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().default(HOUSE_TENANT_ID).references(() => tenants.id, { onDelete: "restrict" }),
    personSlug: varchar("person_slug", { length: 40 }).notNull(),
    /** 0 = Sunday, matching Date#getDay. */
    weekday: integer("weekday").notNull(),
    /** Minutes from venue-local midnight. See scripts/phase1-schema.sql. */
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_office_hours_person").on(t.personSlug, t.weekday)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().default(HOUSE_TENANT_ID).references(() => tenants.id, { onDelete: "restrict" }),
    personSlug: varchar("person_slug", { length: 40 }).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    eventDate: date("event_date"),
    notes: text("notes").notNull().default(""),
    /** First-touch ?src= tag, cleaned by cleanSrcTag. See lib/lead-sources.ts. */
    srcTag: varchar("src_tag", { length: 40 }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_appointments_person").on(t.personSlug, t.startsAt)],
);

export type OfficeHourRow = typeof officeHours.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;

export type Lead = typeof leads.$inferSelect;
export type Wedding = typeof weddings.$inferSelect;
export type NewWedding = typeof weddings.$inferInsert;

// 13. Public notes board (/reviews). Moderated: a row is public only once
// approvedAt is set and hiddenAt is not. See scripts/phase1-schema.sql.
export const guestbookEntries = pgTable(
  "guestbook_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().default(HOUSE_TENANT_ID).references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 80 }).notNull(),
    relation: varchar("relation", { length: 60 }).notNull().default(""),
    message: text("message").notNull(),
    featured: boolean("featured").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    /** Signed on an event page (REVIEW_EVENTS slug). */
    eventSlug: varchar("event_slug", { length: 80 }),
    /** Written by the couple from their own hub: that hub's wedding. */
    weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_guestbook_created").on(t.createdAt)],
);

// 14. Account sign-in (multi-tenant signup, 2026-11-09). Emailed links, no
// passwords. Only SHA-256 hashes of tokens are stored. See lib/auth.ts.
export const loginTokens = pgTable(
  "login_tokens",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_login_tokens_user").on(t.userId, t.createdAt)],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_user_sessions_user").on(t.userId)],
);

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;

// 15. Integrations groundwork: bank and card feeds (2026-11-09). See
// scripts/phase1-schema.sql and lib/integrations/.
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 30 }).notNull(),
    externalId: varchar("external_id", { length: 200 }).notNull(),
    institutionId: varchar("institution_id", { length: 100 }),
    institutionName: varchar("institution_name", { length: 200 }),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    /** AES-256-GCM, lib/secrets.ts. Never sent to a browser, never logged. */
    secretCiphertext: text("secret_ciphertext"),
    syncCursor: text("sync_cursor"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_integration_tenant").on(t.tenantId)],
);

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    connectionId: uuid("connection_id").notNull().references(() => integrationConnections.id, { onDelete: "restrict" }),
    externalId: varchar("external_id", { length: 200 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    officialName: varchar("official_name", { length: 200 }),
    mask: varchar("mask", { length: 10 }),
    type: varchar("type", { length: 30 }),
    subtype: varchar("subtype", { length: 40 }),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    currentBalanceCents: bigint("current_balance_cents", { mode: "number" }),
    availableBalanceCents: bigint("available_balance_cents", { mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    ledgerAccountId: uuid("ledger_account_id").references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bank_accounts_tenant").on(t.tenantId)],
);

/** amountCents: positive = money in, negative = money out (Plaid's sign is flipped on the way in). */
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    bankAccountId: uuid("bank_account_id").notNull().references(() => bankAccounts.id, { onDelete: "restrict" }),
    externalId: varchar("external_id", { length: 200 }).notNull(),
    postedDate: date("posted_date").notNull(),
    authorizedDate: date("authorized_date"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    merchant: varchar("merchant", { length: 255 }),
    description: text("description").notNull().default(""),
    rawCategory: varchar("raw_category", { length: 120 }),
    pending: boolean("pending").notNull().default(false),
    reviewStatus: varchar("review_status", { length: 20 }).notNull().default("unreviewed"),
    categoryId: uuid("category_id").references(() => ledgerCategories.id, { onDelete: "restrict" }),
    note: text("note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    ruleId: uuid("rule_id").references(() => categorizationRules.id, { onDelete: "set null" }),
    rulesPaused: boolean("rules_paused").notNull().default(false),
    pendingExternalId: varchar("pending_external_id", { length: 200 }),
    bookingId: uuid("booking_id").references(() => weddings.id, { onDelete: "set null" }),
    paymentKind: varchar("payment_kind", { length: 20 }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bank_tx_tenant_date").on(t.tenantId, t.postedDate)],
);

/** A business's own name for a kind of money. Not a GL account; gl_code is for the ledger layer. */
export const ledgerCategories = pgTable(
  "ledger_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    taxLine: varchar("tax_line", { length: 80 }),
    glCode: varchar("gl_code", { length: 20 }),
    sortOrder: integer("sort_order").notNull().default(100),
    isArchived: boolean("is_archived").notNull().default(false),
    ledgerAccountId: uuid("ledger_account_id").references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    matchField: varchar("match_field", { length: 20 }).notNull(),
    matchType: varchar("match_type", { length: 20 }).notNull(),
    pattern: varchar("pattern", { length: 200 }).notNull(),
    direction: varchar("direction", { length: 10 }).notNull().default("any"),
    action: varchar("action", { length: 20 }).notNull(),
    categoryId: uuid("category_id").references(() => ledgerCategories.id, { onDelete: "restrict" }),
    appliedCount: integer("applied_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_categorization_rules_tenant").on(t.tenantId)],
);
export type LedgerCategory = typeof ledgerCategories.$inferSelect;
export type CategorizationRule = typeof categorizationRules.$inferSelect;

/** Chart of accounts, per tenant (docs/FINANCIALS_SPEC.md). */
export const ledgerAccounts = pgTable("ledger_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  code: varchar("code", { length: 10 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  systemKey: varchar("system_key", { length: 40 }),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  entryDate: date("entry_date").notNull(),
  memo: text("memo").notNull().default(""),
  sourceType: varchar("source_type", { length: 30 }).notNull(),
  sourceId: uuid("source_id"),
  status: varchar("status", { length: 10 }).notNull().default("posted"),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: varchar("void_reason", { length: 200 }),
  fingerprint: varchar("fingerprint", { length: 200 }),
  sourceRef: varchar("source_ref", { length: 80 }),
  adjustsPeriod: date("adjusts_period"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => journalEntries.id, { onDelete: "restrict" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  accountId: uuid("account_id").notNull().references(() => ledgerAccounts.id, { onDelete: "restrict" }),
  debitCents: bigint("debit_cents", { mode: "number" }).notNull().default(0),
  creditCents: bigint("credit_cents", { mode: "number" }).notNull().default(0),
  // Subledger key (2026-11-13): job:<booking id> on job accounts, crew:<crew member id> on 2500.
  subRef: varchar("sub_ref", { length: 80 }),
});
export type LedgerAccount = typeof ledgerAccounts.$inferSelect;

// 16. Engagement photos on the wedding website (2026-11-11). lib/site-photos.ts
export const sitePhotos = pgTable(
  "site_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
    mimeType: varchar("mime_type", { length: 40 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    caption: varchar("caption", { length: 200 }).notNull().default(""),
    orderIndex: integer("order_index").notNull().default(0),
    data: customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" })("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_site_photos_wedding").on(t.weddingId, t.orderIndex)],
);

// 17. Vendors (2026-11-11). lib/vendors.ts; pure rules in lib/books/vendor-logic.ts.
export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull().default("contractor"),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    matchText: varchar("match_text", { length: 400 }).notNull().default(""),
    is1099: boolean("is_1099").notNull().default(false),
    w9OnFile: boolean("w9_on_file").notNull().default(false),
    notes: text("notes").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_vendors_tenant").on(t.tenantId)],
);
export type Vendor = typeof vendors.$inferSelect;

// Separate agreements in a couple's hub (officiating by Compass Events). See
// scripts/phase1-schema.sql and lib/compass.ts.
export const serviceAgreements = pgTable(
  "service_agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weddingId: uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 30 }).notNull().default("officiant"),
    brand: varchar("brand", { length: 30 }).notNull().default("compass"),
    details: jsonb("details").notNull().default({}),
    feeUsd: numeric("fee_usd", { precision: 10, scale: 2 }).notNull(),
    depositUsd: numeric("deposit_usd", { precision: 10, scale: 2 }).notNull(),
    balanceDueHours: integer("balance_due_hours").notNull().default(48),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedName: varchar("accepted_name", { length: 255 }),
    snapshot: jsonb("snapshot"),
    countersignedAt: timestamp("countersigned_at", { withTimezone: true }),
    countersignedName: varchar("countersigned_name", { length: 255 }),
    countersignedTitle: varchar("countersigned_title", { length: 255 }),
    depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),
    balancePaidAt: timestamp("balance_paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_service_agreements_wedding").on(t.weddingId)],
);
export type ServiceAgreement = typeof serviceAgreements.$inferSelect;

// Project costing and resource planning (2026-11-13). See scripts/phase1-schema.sql,
// lib/costing-logic.ts (pure) and lib/costing.ts (server).
export const crewMembers = pgTable(
  "crew_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    defaultRole: varchar("default_role", { length: 80 }).notNull().default(""),
    payMethod: varchar("pay_method", { length: 10 }).notNull().default("project"),
    rateCents: integer("rate_cents"),
    percentBps: integer("percent_bps"),
    shareBps: integer("share_bps"),
    vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    email: varchar("email", { length: 255 }),
    notes: text("notes").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_crew_members_tenant").on(t.tenantId)],
);
export type CrewMember = typeof crewMembers.$inferSelect;

export const resourceItems = pgTable(
  "resource_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    category: varchar("category", { length: 60 }).notNull().default(""),
    unit: varchar("unit", { length: 30 }).notNull().default("each"),
    unitCostCents: integer("unit_cost_cents"),
    notes: text("notes").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_resource_items_tenant").on(t.tenantId)],
);
export type ResourceItem = typeof resourceItems.$inferSelect;

export const eventResources = pgTable(
  "event_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    weddingId: uuid("wedding_id").notNull().references(() => weddings.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 10 }).notNull().default("labor"),
    crewMemberId: uuid("crew_member_id").references(() => crewMembers.id, { onDelete: "set null" }),
    resourceItemId: uuid("resource_item_id").references(() => resourceItems.id, { onDelete: "set null" }),
    label: varchar("label", { length: 160 }).notNull().default(""),
    role: varchar("role", { length: 80 }).notNull().default(""),
    payMethod: varchar("pay_method", { length: 10 }),
    rateCents: integer("rate_cents"),
    percentBps: integer("percent_bps"),
    plannedMinutes: integer("planned_minutes"),
    actualMinutes: integer("actual_minutes"),
    unit: varchar("unit", { length: 30 }).notNull().default(""),
    unitCostCents: integer("unit_cost_cents"),
    plannedQty: numeric("planned_qty", { precision: 10, scale: 2 }),
    actualQty: numeric("actual_qty", { precision: 10, scale: 2 }),
    actualCostCents: integer("actual_cost_cents"),
    notes: text("notes").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_event_resources_wedding").on(t.weddingId), index("idx_event_resources_crew").on(t.crewMemberId)],
);
export type EventResource = typeof eventResources.$inferSelect;

// Accrual basis, audit log and period close (2026-11-13). scripts/phase1-schema.sql
// carries the triggers that make the close a hard cutoff and the log append-only.
export const financeRoles = pgTable("finance_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 120 }).notNull().default(""),
  role: varchar("role", { length: 12 }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ledgerPeriods = pgTable("ledger_periods", {
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  preparedBy: varchar("prepared_by", { length: 255 }),
  preparedAt: timestamp("prepared_at", { withTimezone: true }),
  preparedHash: varchar("prepared_hash", { length: 64 }),
  preparedNote: text("prepared_note").notNull().default(""),
  acknowledged: jsonb("acknowledged").notNull().default([]),
  decidedBy: varchar("decided_by", { length: 255 }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note").notNull().default(""),
  closedHash: varchar("closed_hash", { length: 64 }),
  closedSnapshot: jsonb("closed_snapshot"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  reopenRequestedBy: varchar("reopen_requested_by", { length: 255 }),
  reopenRequestedAt: timestamp("reopen_requested_at", { withTimezone: true }),
  reopenReason: text("reopen_reason").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type LedgerPeriod = typeof ledgerPeriods.$inferSelect;

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actor: varchar("actor", { length: 255 }).notNull(),
  action: varchar("action", { length: 60 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: varchar("entity_id", { length: 80 }),
  before: jsonb("before"),
  after: jsonb("after"),
  reason: text("reason"),
  cause: text("cause"),
  prevHash: varchar("prev_hash", { length: 64 }),
  hash: varchar("hash", { length: 64 }).notNull(),
});
export type AuditRow = typeof auditLog.$inferSelect;

// Expense capture (2026-11-13). See scripts/phase1-schema.sql, lib/expense-logic.ts
// (pure) and lib/expenses.ts (server).
export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    fileName: varchar("file_name", { length: 255 }).notNull().default(""),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    data: customType<{ data: Buffer; driverData: Buffer }>({
      dataType: () => "bytea",
    })("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_receipts_tenant").on(t.tenantId)],
);

export const expenseClaims = pgTable(
  "expense_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    crewMemberId: uuid("crew_member_id").references(() => crewMembers.id, { onDelete: "set null" }),
    claimantName: varchar("claimant_name", { length: 120 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull().default("reimbursement"),
    bankTransactionId: uuid("bank_transaction_id").references(() => bankTransactions.id, { onDelete: "set null" }),
    merchant: varchar("merchant", { length: 160 }).notNull().default(""),
    description: text("description").notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    spentOn: date("spent_on").notNull(),
    categoryId: uuid("category_id").references(() => ledgerCategories.id, { onDelete: "restrict" }),
    weddingId: uuid("wedding_id").references(() => weddings.id, { onDelete: "set null" }),
    receiptId: uuid("receipt_id").references(() => receipts.id, { onDelete: "set null" }),
    status: varchar("status", { length: 12 }).notNull().default("submitted"),
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note").notNull().default(""),
    reimbursedBankTransactionId: uuid("reimbursed_bank_transaction_id").references(() => bankTransactions.id, { onDelete: "set null" }),
    payoutStatus: varchar("payout_status", { length: 12 }).notNull().default("none"),
    payoutDecidedBy: varchar("payout_decided_by", { length: 255 }),
    payoutDecidedAt: timestamp("payout_decided_at", { withTimezone: true }),
    payoutNote: text("payout_note").notNull().default(""),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_expense_claims_status").on(t.tenantId, t.status), index("idx_expense_claims_wedding").on(t.weddingId)],
);
export type ExpenseClaim = typeof expenseClaims.$inferSelect;
