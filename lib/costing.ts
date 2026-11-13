import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { crewMembers, eventResources, resourceItems, vendors, weddings } from "@/lib/db/schema";
import { HOUSE_TENANT_ID } from "@/lib/tenant-constants";
import { costEvent, isPayMethod, type CostLine, type EventCosting, type Owner, type PayMethod, type ScheduledLine } from "@/lib/costing-logic";

// Project costing and resource planning, server side (2026-11-13). Owner
// dashboard only, so every query is scoped to the house account, the same
// way lib/admin.ts is. The arithmetic lives in lib/costing-logic.ts.

const T = HOUSE_TENANT_ID;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type CrewInput = {
  id: string | null;
  name: string;
  defaultRole: string;
  payMethod: PayMethod;
  rateCents: number | null;
  percentBps: number | null;
  shareBps: number | null;
  vendorId: string | null;
  notes: string;
  retired: boolean;
};

export type ItemInput = {
  id: string | null;
  name: string;
  category: string;
  unit: string;
  unitCostCents: number | null;
  notes: string;
  retired: boolean;
};

export type LineInput = {
  kind: "labor" | "material";
  crewMemberId: string | null;
  resourceItemId: string | null;
  label: string;
  role: string;
  payMethod: PayMethod | null;
  rateCents: number | null;
  percentBps: number | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  unit: string;
  unitCostCents: number | null;
  plannedQty: number | null;
  actualQty: number | null;
  actualCostCents: number | null;
  notes: string;
};

export async function listCrew() {
  return db.select().from(crewMembers).where(eq(crewMembers.tenantId, T)).orderBy(asc(crewMembers.sort), asc(crewMembers.createdAt));
}

export async function listItems() {
  return db.select().from(resourceItems).where(eq(resourceItems.tenantId, T)).orderBy(asc(resourceItems.sort), asc(resourceItems.name));
}

/** Vendors the crew can be linked to (contractors first), for the picker. */
export async function listVendorChoices() {
  return db
    .select({ id: vendors.id, name: vendors.name, kind: vendors.kind })
    .from(vendors)
    .where(and(eq(vendors.tenantId, T), isNull(vendors.archivedAt)))
    .orderBy(sql`${vendors.kind} <> 'contractor'`, asc(vendors.name));
}

/**
 * Save the whole crew list. Rows are never deleted, because planned events
 * point at them: taking someone off the list retires them, and a retired
 * person keeps their name on every event they were planned for.
 */
export async function saveCrew(rows: CrewInput[]): Promise<void> {
  const vendorIds = new Set((await listVendorChoices()).map((v) => v.id));
  await db.transaction(async (tx) => {
    for (const [i, r] of rows.entries()) {
      const values = {
        name: r.name,
        defaultRole: r.defaultRole,
        payMethod: r.payMethod,
        rateCents: r.payMethod === "project" || r.payMethod === "hour" ? r.rateCents : null,
        percentBps: r.payMethod === "percent" ? r.percentBps : null,
        shareBps: r.payMethod === "owner" ? r.shareBps : null,
        vendorId: r.vendorId && vendorIds.has(r.vendorId) ? r.vendorId : null,
        notes: r.notes,
        sort: i,
        retiredAt: r.retired ? sql`coalesce(${crewMembers.retiredAt}, now())` : null,
        updatedAt: new Date(),
      };
      if (r.id && UUID_RE.test(r.id)) {
        await tx.update(crewMembers).set(values).where(and(eq(crewMembers.id, r.id), eq(crewMembers.tenantId, T)));
      } else {
        await tx.insert(crewMembers).values({ ...values, tenantId: T, retiredAt: r.retired ? new Date() : null });
      }
    }
  });
}

export async function saveItems(rows: ItemInput[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, r] of rows.entries()) {
      const values = {
        name: r.name,
        category: r.category,
        unit: r.unit || "each",
        unitCostCents: r.unitCostCents,
        notes: r.notes,
        sort: i,
        retiredAt: r.retired ? sql`coalesce(${resourceItems.retiredAt}, now())` : null,
        updatedAt: new Date(),
      };
      if (r.id && UUID_RE.test(r.id)) {
        await tx.update(resourceItems).set(values).where(and(eq(resourceItems.id, r.id), eq(resourceItems.tenantId, T)));
      } else {
        await tx.insert(resourceItems).values({ ...values, tenantId: T, retiredAt: r.retired ? new Date() : null });
      }
    }
  });
}

function dollarsToCents(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toCostLine(r: typeof eventResources.$inferSelect): CostLine {
  return {
    kind: r.kind === "material" ? "material" : "labor",
    crewMemberId: r.crewMemberId,
    label: r.label,
    role: r.role,
    payMethod: isPayMethod(r.payMethod) ? r.payMethod : null,
    rateCents: r.rateCents,
    percentBps: r.percentBps,
    plannedMinutes: r.plannedMinutes,
    actualMinutes: r.actualMinutes,
    unitCostCents: r.unitCostCents,
    plannedQty: r.plannedQty == null ? null : Number(r.plannedQty),
    actualQty: r.actualQty == null ? null : Number(r.actualQty),
    actualCostCents: r.actualCostCents,
  };
}

function ownersFrom(crew: (typeof crewMembers.$inferSelect)[]): Owner[] {
  return crew.filter((c) => c.payMethod === "owner" && !c.retiredAt).map((c) => ({ id: c.id, name: c.name, shareBps: c.shareBps }));
}

/** One event's plan: the booking, its lines in order, and the costing. */
export async function getEventPlan(weddingId: string) {
  if (!UUID_RE.test(weddingId)) return null;
  const [w] = await db.select().from(weddings).where(and(eq(weddings.id, weddingId), eq(weddings.tenantId, T))).limit(1);
  if (!w) return null;
  const [rows, crew, items] = await Promise.all([
    db.select().from(eventResources).where(and(eq(eventResources.weddingId, weddingId), eq(eventResources.tenantId, T))).orderBy(asc(eventResources.sort)),
    listCrew(),
    listItems(),
  ]);
  const names = Object.fromEntries(crew.map((c) => [c.id, c.name]));
  const costing = costEvent({ revenueCents: dollarsToCents(w.totalAmount), lines: rows.map(toCostLine), owners: ownersFrom(crew), names });
  return { wedding: w, rows, crew, items, costing };
}

/**
 * Replace one event's plan in a transaction. Ids the client sends for crew
 * and items are checked against this account; anything else is dropped to
 * null rather than trusted.
 */
export async function saveEventPlan(weddingId: string, lines: LineInput[]): Promise<boolean> {
  if (!UUID_RE.test(weddingId)) return false;
  const [w] = await db.select({ id: weddings.id }).from(weddings).where(and(eq(weddings.id, weddingId), eq(weddings.tenantId, T))).limit(1);
  if (!w) return false;
  const [crew, items] = await Promise.all([listCrew(), listItems()]);
  const crewIds = new Set(crew.map((c) => c.id));
  const itemIds = new Set(items.map((i) => i.id));
  await db.transaction(async (tx) => {
    await tx.delete(eventResources).where(and(eq(eventResources.weddingId, weddingId), eq(eventResources.tenantId, T)));
    if (lines.length === 0) return;
    await tx.insert(eventResources).values(
      lines.map((l, i) => ({
        tenantId: T,
        weddingId,
        kind: l.kind,
        crewMemberId: l.kind === "labor" && l.crewMemberId && crewIds.has(l.crewMemberId) ? l.crewMemberId : null,
        resourceItemId: l.kind === "material" && l.resourceItemId && itemIds.has(l.resourceItemId) ? l.resourceItemId : null,
        label: l.label,
        role: l.role,
        payMethod: l.kind === "labor" ? l.payMethod : null,
        rateCents: l.rateCents,
        percentBps: l.percentBps,
        plannedMinutes: l.plannedMinutes,
        actualMinutes: l.actualMinutes,
        unit: l.unit,
        unitCostCents: l.unitCostCents,
        plannedQty: l.plannedQty == null ? null : l.plannedQty.toFixed(2),
        actualQty: l.actualQty == null ? null : l.actualQty.toFixed(2),
        actualCostCents: l.actualCostCents,
        notes: l.notes,
        sort: i,
      })),
    );
  });
  return true;
}

/** Cost lines for many jobs, by wedding id (job costing). */
export async function linesByWedding(ids: string[]): Promise<Map<string, CostLine[]>> {
  const out = new Map<string, CostLine[]>();
  if (ids.length === 0) return out;
  const lines = await db
    .select()
    .from(eventResources)
    .where(and(eq(eventResources.tenantId, T), inArray(eventResources.weddingId, ids)))
    .orderBy(asc(eventResources.sort));
  for (const l of lines) {
    const list = out.get(l.weddingId) ?? [];
    list.push(toCostLine(l));
    out.set(l.weddingId, list);
  }
  return out;
}

/** Costing for many events at once, for the dashboard cards. Only events that have a plan. */
export async function costingByWedding(rowsFor: { id: string; totalAmount: string }[]): Promise<Map<string, EventCosting>> {
  const out = new Map<string, EventCosting>();
  if (rowsFor.length === 0) return out;
  const ids = rowsFor.map((r) => r.id);
  const [lines, crew] = await Promise.all([
    db.select().from(eventResources).where(and(eq(eventResources.tenantId, T), inArray(eventResources.weddingId, ids))).orderBy(asc(eventResources.sort)),
    listCrew(),
  ]);
  const owners = ownersFrom(crew);
  const names = Object.fromEntries(crew.map((c) => [c.id, c.name]));
  const byWedding = new Map<string, CostLine[]>();
  for (const l of lines) {
    const list = byWedding.get(l.weddingId) ?? [];
    list.push(toCostLine(l));
    byWedding.set(l.weddingId, list);
  }
  for (const r of rowsFor) {
    const ls = byWedding.get(r.id);
    if (ls) out.set(r.id, costEvent({ revenueCents: dollarsToCents(r.totalAmount), lines: ls, owners, names }));
  }
  return out;
}

/** Every planned labor line on live house events from `fromDate` on, for the crew calendar. */
export async function scheduledLabor(fromDate: string): Promise<ScheduledLine[]> {
  const rows = await db
    .select({
      weddingId: eventResources.weddingId,
      eventName: weddings.coupleNames,
      eventDate: weddings.eventDate,
      crewMemberId: eventResources.crewMemberId,
      plannedMinutes: eventResources.plannedMinutes,
    })
    .from(eventResources)
    .innerJoin(weddings, eq(eventResources.weddingId, weddings.id))
    .where(
      and(
        eq(eventResources.tenantId, T),
        eq(eventResources.kind, "labor"),
        isNull(weddings.archivedAt),
        sql`${weddings.status} <> 'cancelled'`,
        sql`${weddings.eventDate} >= ${fromDate}`,
      ),
    )
    .orderBy(asc(weddings.eventDate));
  return rows;
}

/** Live house events from `fromDate` on with no plan yet, so the crew page can say what is unstaffed. */
export async function unplannedEvents(fromDate: string) {
  return db
    .select({ id: weddings.id, coupleNames: weddings.coupleNames, eventDate: weddings.eventDate })
    .from(weddings)
    .where(
      and(
        eq(weddings.tenantId, T),
        isNull(weddings.archivedAt),
        sql`${weddings.status} <> 'cancelled'`,
        sql`${weddings.eventDate} >= ${fromDate}`,
        sql`not exists (select 1 from event_resources r where r.wedding_id = ${weddings.id} and r.kind = 'labor')`,
      ),
    )
    .orderBy(asc(weddings.eventDate));
}
