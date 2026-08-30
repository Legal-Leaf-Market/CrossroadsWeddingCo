import {
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
    // Free-text arrangement that replaces the agreement's standard cost
    // section: legacy deals, trades, comped weddings.
    customTerms: text("custom_terms"),
    /** Slug of a folder under public/wedding-art/, or null for the plain look. */
    artTheme: varchar("art_theme", { length: 60 }),
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
  // The couple's own note for this moment, shown to the DJ on the run sheet.
  notes: text("notes"),
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

export type Lead = typeof leads.$inferSelect;
export type Wedding = typeof weddings.$inferSelect;
export type NewWedding = typeof weddings.$inferInsert;
