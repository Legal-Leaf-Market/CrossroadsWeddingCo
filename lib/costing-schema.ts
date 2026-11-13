import { z } from "zod";
import { PAY_METHODS } from "@/lib/costing-logic";

// Request bodies for the costing editors. Money is integer cents, percents and
// shares basis points, time whole minutes; the editors convert before sending.

const cents = z.number().int().min(0).max(100_000_000).nullable();
const bps = z.number().int().min(0).max(10_000).nullable();
const minutes = z.number().int().min(0).max(7 * 24 * 60).nullable();
const qty = z.number().min(0).max(1_000_000).nullable();
const text = (max: number) => z.string().trim().max(max);
const id = z.string().uuid().nullable();

export const crewBody = z.object({
  crew: z
    .array(
      z.object({
        id,
        name: text(120).min(1, "Every person needs a name"),
        defaultRole: text(80),
        payMethod: z.enum(PAY_METHODS),
        rateCents: cents,
        percentBps: bps,
        shareBps: bps,
        vendorId: id,
        notes: text(2000),
        retired: z.boolean(),
      }),
    )
    .max(100),
});

export const itemsBody = z.object({
  items: z
    .array(
      z.object({
        id,
        name: text(120).min(1, "Every item needs a name"),
        category: text(60),
        unit: text(30),
        unitCostCents: cents,
        notes: text(2000),
        retired: z.boolean(),
      }),
    )
    .max(500),
});

export const planBody = z.object({
  lines: z
    .array(
      z.object({
        id: id.optional(),
        kind: z.enum(["labor", "material"]),
        crewMemberId: id,
        resourceItemId: id,
        label: text(160),
        role: text(80),
        payMethod: z.enum(PAY_METHODS).nullable(),
        rateCents: cents,
        percentBps: bps,
        plannedMinutes: minutes,
        actualMinutes: minutes,
        unit: text(30),
        unitCostCents: cents,
        plannedQty: qty,
        actualQty: qty,
        actualCostCents: cents,
        notes: text(2000),
      }),
    )
    .max(200),
});
