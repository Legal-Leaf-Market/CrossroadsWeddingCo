import type { AdminWedding } from "./admin";
import { isBooked } from "./admin-insights";
import { sourceForTag } from "./lead-sources";

type Wedding = Pick<AdminWedding,
  | "id" | "coupleNames" | "eventDate" | "venueName" | "packageType" | "status"
  | "leadSource" | "leadSrcTag" | "isDepositPaid" | "isBalancePaid"
  | "contractAcceptedAt" | "contractCountersignedAt" | "contractStale" | "officiant"
>;

function marketplace(source: string | null) {
  if (source === "the_knot") return "The Knot";
  if (source === "weddingwire") return "WeddingWire";
  return null;
}

function bookingEvidence(wedding: Wedding) {
  if (wedding.isBalancePaid) return "Balance recorded";
  if (wedding.isDepositPaid) return "Deposit recorded";
  if (wedding.officiant?.depositPaidAt) return "Officiant deposit recorded";
  if (!wedding.contractStale && wedding.contractAcceptedAt && wedding.contractCountersignedAt) {
    return "Wedding agreement signed by both parties";
  }
  if (wedding.officiant?.acceptedAt && wedding.officiant.countersignedAt) {
    return "Officiant agreement signed by both parties";
  }
  if (isBooked(wedding)) return "Marked booked in Crossroads";
  return null;
}

export function weddingProReconciliation(weddings: readonly Wedding[]) {
  return weddings.flatMap((wedding) => {
    if (wedding.packageType === "corporate" || wedding.status === "cancelled") return [];
    const reported = wedding.leadSource;
    const tagged = sourceForTag(wedding.leadSrcTag);
    const channel = marketplace(reported) ?? marketplace(tagged);
    if (!channel && (reported || tagged)) return [];

    const evidence = bookingEvidence(wedding);
    if (!channel && !evidence) return [];

    const sourceConflict = Boolean(reported && tagged && reported !== tagged);
    return [{
      id: wedding.id,
      coupleNames: wedding.coupleNames,
      eventDate: wedding.eventDate,
      venueName: wedding.venueName,
      channel,
      sourceConflict,
      evidence,
      ready: Boolean(channel && evidence && !sourceConflict),
    }];
  }).sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.coupleNames.localeCompare(b.coupleNames));
}
