import { and, eq, isNull } from "drizzle-orm";
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
    cardPayments: officiantCardPaymentsOn(),
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

/** Create, or edit while nobody has signed it yet (couple or officiant). */
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
    .where(and(eq(serviceAgreements.id, existing.id), isNull(serviceAgreements.acceptedAt), isNull(serviceAgreements.countersignedAt)))
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
): Promise<"ok" | "not_found" | "already_signed"> {
  const a = await getOfficiantAgreement(weddingId);
  if (!a) return "not_found";
  const at = new Date();
  const updated = await db
    .update(serviceAgreements)
    .set({ countersignedAt: at, countersignedName: name, countersignedTitle: title, updatedAt: at })
    .where(and(eq(serviceAgreements.id, a.id), isNull(serviceAgreements.cancelledAt), isNull(serviceAgreements.countersignedAt)))
    .returning({ id: serviceAgreements.id });
  // The officiant may sign before or after the couple (2026-11-12, Jake): once
  // he signs, the terms are locked (saveOfficiantAgreement refuses), so the
  // couple accepts exactly what he signed.
  if (updated.length) return "ok";
  return "already_signed";
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

/**
 * Card payments for the officiating invoice (Jake, 2026-11-12: "I want Liv to
 * be able to pay the $125 deposit to our stripe"). Their own switch, like
 * STRIPE_DEPOSITS_ENABLED for the DJ deposit, so a Stripe key on its own never
 * turns them on. Off means the invoice shows cash or check only, no button.
 */
export function officiantCardPaymentsOn(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && process.env.COMPASS_CARD_PAYMENTS === "1";
}

/**
 * Which part the couple can pay by card right now, if any: the deposit once
 * they have accepted, then the balance once the deposit is in. One at a time,
 * in order, so a card can never pay the balance ahead of an unpaid deposit.
 */
export function officiantPayablePart(a: ServiceAgreement): "deposit" | "balance" | null {
  if (!a.acceptedAt || a.cancelledAt) return null;
  if (!a.depositPaidAt) return "deposit";
  if (!a.balancePaidAt) return "balance";
  return null;
}

/**
 * The Stripe webhook's half: mark a part received after a paid Checkout
 * session. Keyed by the agreement id Stripe carried in metadata, and only
 * fills an empty paid-at, so a replayed event never moves a date already set.
 * "already" on a fresh payment means it was also marked paid by hand: the
 * webhook logs it so a double payment gets noticed and refunded.
 */
export async function markOfficiantPaidByCard(
  agreementId: string,
  part: "deposit" | "balance",
): Promise<"marked" | "already" | "not_found"> {
  const at = new Date();
  const col = part === "deposit" ? serviceAgreements.depositPaidAt : serviceAgreements.balancePaidAt;
  const updated = await db
    .update(serviceAgreements)
    .set(part === "deposit" ? { depositPaidAt: at, updatedAt: at } : { balancePaidAt: at, updatedAt: at })
    .where(and(eq(serviceAgreements.id, agreementId), isNull(col)))
    .returning({ id: serviceAgreements.id });
  if (updated.length) return "marked";
  const [exists] = await db
    .select({ id: serviceAgreements.id })
    .from(serviceAgreements)
    .where(eq(serviceAgreements.id, agreementId))
    .limit(1);
  return exists ? "already" : "not_found";
}
