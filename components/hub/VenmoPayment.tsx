import { money } from "@/lib/invoice";

export const VENMO_HANDLE = "crossroads_wedding_co";
export const VENMO_PAY_URL = "https://account.venmo.com/pay?recipients=crossroads_wedding_co";

export default function VenmoPayment({ amount, invoice, part }: {
  amount: number;
  invoice: string;
  part: "deposit" | "balance";
}) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return (
    <section className="mt-4 rounded-xl border border-parchment bg-white p-4 text-sm text-charcoal">
      <p className="font-semibold">Other payment option: Venmo</p>
      <p className="mt-2">Pay {money(amount)} for your {part} to @{VENMO_HANDLE}. Enter this amount in Venmo and use {invoice} as the private payment note.</p>
      <a href={VENMO_PAY_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-full border border-terracotta px-4 py-2 font-semibold text-terracotta hover:bg-terracotta hover:text-white">
        Open Venmo to pay
      </a>
      <p className="mt-2 text-xs text-ink/60">Opens Venmo in a new tab or your device's app if supported. Check the recipient and amount before sending. Return here afterward; our team confirms receipt before updating your invoice. Do not send again if you already paid.</p>
    </section>
  );
}
