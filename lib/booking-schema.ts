import { z } from "zod";
import { BOOKING_STATUSES, EVENT_TYPES } from "@/lib/tenant-constants";

// Shared by the workspace booking routes. Money arrives as dollars.
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const money = z.coerce.number().min(0, "Amounts can't be negative").max(1_000_000);
const EVENT_KEYS = EVENT_TYPES.map((t) => t.key) as [string, ...string[]];
const STATUS_KEYS = BOOKING_STATUSES.map((s) => s.key) as [(typeof BOOKING_STATUSES)[number]["key"], ...(typeof BOOKING_STATUSES)[number]["key"][]];
const optText = (max: number) => z.string().trim().max(max).optional().default("");

export const createBookingSchema = z.object({
  clientNames: z.string().trim().min(1, "Add the client's name").max(255),
  eventType: z.enum(EVENT_KEYS).default("wedding"),
  eventDate: DATE,
  venueName: z.string().trim().min(1, "Add the venue").max(255),
  venueAddress: optText(500),
  contactEmail: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(255)]).optional().default(""),
  contactPhone: optText(50),
  totalUsd: money.default(0),
  depositUsd: money.default(0),
  depositReceived: z.coerce.boolean().default(false),
  notes: optText(4000),
});

export const patchBookingSchema = z
  .object({
    clientNames: z.string().trim().min(1).max(255),
    eventType: z.enum(EVENT_KEYS),
    eventDate: DATE,
    venueName: z.string().trim().min(1).max(255),
    venueAddress: z.string().trim().max(500).nullable(),
    contactEmail: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(255)]).nullable(),
    contactPhone: z.string().trim().max(50).nullable(),
    totalUsd: money,
    depositUsd: money,
    isDepositPaid: z.boolean(),
    isBalancePaid: z.boolean(),
    status: z.enum(STATUS_KEYS),
    archived: z.boolean(),
  })
  .partial();
