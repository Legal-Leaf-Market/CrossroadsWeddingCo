import { bookingPaymentCredit } from "@/lib/books/matching";
import { invoiceNumber } from "@/lib/invoice";

export async function venmoBookingPayment(booking: Parameters<typeof bookingPaymentCredit>[0] & {
  eventDate: string;
  status: string;
  cancelledAt: Date | null;
  archivedAt: Date | null;
  booksExcludedAt: Date | null;
  customTerms: string | null;
}) {
  if (booking.cancelledAt || booking.archivedAt || booking.booksExcludedAt ||
      booking.status === "cancelled" || booking.status === "inquiry" ||
      booking.customTerms?.trim() || booking.isBalancePaid) return null;

  const credit = await bookingPaymentCredit(booking).catch((error: unknown) => {
    console.error("[venmo] Could not read booking payment credit", error instanceof Error ? error.name : "unknown error");
    return null;
  });
  if (!credit) return null;
  const depositDue = Math.min(credit.depositDueCents, credit.balanceDueCents);
  const amount = (depositDue || credit.balanceDueCents) / 100;
  if (amount <= 0) return null;

  return {
    amount,
    invoice: invoiceNumber(booking),
    part: depositDue > 0 ? "deposit" as const : "balance" as const,
  };
}
