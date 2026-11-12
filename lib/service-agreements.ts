import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceAgreements, type ServiceAgreement, type Wedding } from "@/lib/db/schema";
import {
  buildOfficiantAgreement,
  OFFICIANT_AGREEMENT_VERSION,
  OFFICIANT_DEFAULT_NAME,
  type OfficiantDetails,
} from "@/lib/compass";
import type { ContractSection } from "@/lib/contract";
import { formatEventDate } from "@/lib/hub-constants";

// Server side of the separate officiating agreement (lib/compass.ts holds the
// words). Every write is one conditional UPDATE, so a second tap from another
// device learns it lost instead of overwriting: accept once, countersign once,
// and the details can only change before the couple accepts.

export function officiantDetails(a: ServiceAgreement): OfficiantDetails {
  const d = (a.details ?? {}) as Partial<OfficiantDetails>;
  return {
    officiantName: typeof d.officiantName === "string" && d.officiantName.trim() ? d.officiantName : OFFICIANT_DEFAULT_NAME,
    credential: typeof d.credential === "string" ? d.credential : "",
    rehearsal: typeof d.rehearsal === "string" ? d.rehearsal : "",
    notes: typeof d.notes === "string" ? d.notes : "",
  };
}

export async function getOfficiantAgreement(weddingId: string): Promise<ServiceAgreement | null> {
  const [a] = await db
    .select()
    .from(serviceAgreements)
    .where(and(eq(serviceAgreements.weddingId, weddingId), eq(serviceAgreements.kind, "officiant"), isNull(serviceAgreements.cancelledAt)))
    .limit(1);
  return a ?? null;
}

function liveSections(a: ServiceAgreement, w: Wedding): ContractSection[] {
  return buildOfficiantAgreement({
    ...officiantDetails(a),
    coupleNames: w.coupleNames,
    eventDate: formatEventDate(w.eventDate),
    venueName: w.venueName,
    venueAddress: w.venueAddress,
    feeUsd: Number(a.feeUsd),
    depositUsd: Number(a.depositUsd),
    balanceHours: a.balanceDueHours,
  });
}

/** What anyone sees: the frozen text once accepted, the live text before. */
export function officiantSections(a: ServiceAgreement, w: Wedding): ContractSection[] {
  const snap = a.snapshot as { sections?: ContractSection[] } | null;
  if (a.acceptedAt && Array.isArray(snap?.sections)) return snap.sections;
  return liveSections(a, w);
}

export function officiantVersion(a: ServiceAgreement): string {
  const v = (a.snapshot as { version?: unknown } | null)?.version;
  return a.acceptedAt && typeof v === "string" ? v : OFFICIANT_AGREEMENT_VERSION;
}

export type OfficiantSetup = OfficiantDetails & { feeUsd: number; depositUsd: number; balanceDueHours: number };

/** Create, or edit while it is still unaccepted. */
export async function saveOfficiantAgreement(
  weddingId: string,
  s: OfficiantSetup,
): Promise<"created" | "updated" | "locked"> {
  const details: OfficiantDetails = {
    officiantName: s.officiantName,
    credential: s.credential,
    rehearsal: s.rehearsal,
    notes: s.notes,
  };
  const values = {
    details,
    feeUsd: s.feeUsd.toFixed(2),
    depositUsd: s.depositUsd.toFixed(2),
    balanceDueHours: s.balanceDueHours,
    updatedAt: new Date(),
  };
  const existing = await getOfficiantAgreement(weddingId);
  if (!existing) {
    const inserted = await db
      .insert(serviceAgreements)
      .values({ weddingId, kind: "officiant", brand: "compass", ...values })
      .onConflictDoNothing()
      .returning({ id: serviceAgreements.id });
    return inserted.length ? "created" : "locked";
  }
  const updated = await db
    .update(serviceAgreements)
    .set(values)
    .where(and(eq(serviceAgreements.id, existing.id), isNull(serviceAgreements.acceptedAt)))
    .returning({ id: serviceAgreements.id });
  return updated.length ? "updated" : "locked";
}

export async function acceptOfficiantAgreement(
  a: ServiceAgreement,
  w: Wedding,
  name: string,
): Promise<{ at: Date } | null> {
  const at = new Date();
  const snapshot = {
    version: OFFICIANT_AGREEMENT_VERSION,
    acceptedName: name,
    acceptedAt: at.toISOString(),
    coupleNames: w.coupleNames,
    eventDate: w.eventDate,
    venueName: w.venueName,
    venueAddress: w.venueAddress,
    feeUsd: Number(a.feeUsd),
    depositUsd: Number(a.depositUsd),
    balanceDueHours: a.balanceDueHours,
    details: officiantDetails(a),
    sections: liveSections(a, w),
  };
  const updated = await db
    .update(serviceAgreements)
    .set({ acceptedAt: at, acceptedName: name, snapshot, updatedAt: at })
    .where(and(eq(serviceAgreements.id, a.id), isNull(serviceAgreements.acceptedAt), isNull(serviceAgreements.cancelledAt)))
    .returning({ id: serviceAgreements.id });
  return updated.length ? { at } : null;
}

export async function countersignOfficiantAgreement(
  weddingId: string,
  name: string,
  title: string,
): Promise<"ok" | "not_found" | "not_accepted" | "already_signed"> {
  const a = await getOfficiantAgreement(weddingId);
  if (!a) return "not_found";
  const at = new Date();
  const updated = await db
    .update(serviceAgreements)
    .set({ countersignedAt: at, countersignedName: name, countersignedTitle: title, updatedAt: at })
    .where(and(eq(serviceAgreements.id, a.id), isNotNull(serviceAgreements.acceptedAt), isNull(serviceAgreements.countersignedAt)))
    .returning({ id: serviceAgreements.id });
  if (updated.length) return "ok";
  return a.acceptedAt ? "already_signed" : "not_accepted";
}

/** Mark a payment received (or undo a mistaken tap). Owner only. */
export async function setOfficiantPayment(
  weddingId: string,
  part: "deposit" | "balance",
  paid: boolean,
): Promise<boolean> {
  const a = await getOfficiantAgreement(weddingId);
  if (!a) return false;
  const when = paid ? new Date() : null;
  await db
    .update(serviceAgreements)
    .set(part === "deposit" ? { depositPaidAt: when, updatedAt: new Date() } : { balancePaidAt: when, updatedAt: new Date() })
    .where(eq(serviceAgreements.id, a.id));
  return true;
}
