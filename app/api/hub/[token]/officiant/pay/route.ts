import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { COMPASS_NAME, officiantInvoiceNumber, officiantInvoiceParts } from "@/lib/compass";
import { getWeddingByToken } from "@/lib/hub";
import { formatEventDate } from "@/lib/hub-constants";
import {
  getOfficiantAgreement,
  officiantCardPaymentsOn,
  officiantDetails,
  officiantPayablePart,
} from "@/lib/service-agreements";
import { SITE_URL } from "@/lib/site";
import { isHouseTenant } from "@/lib/tenant-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ part: z.enum(["deposit", "balance"]) });

// The couple pays one part of the officiating invoice by card: a Stripe
// Checkout session for exactly what that part says. The webhook marks it
// received (metadata kind "officiant"); nothing here does. Fails closed (501)
// unless STRIPE_SECRET_KEY and COMPASS_CARD_PAYMENTS=1 are both set.
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const headers = { "Cache-Control": "no-store" };
  if (!officiantCardPaymentsOn()) {
    return NextResponse.json({ error: "Card payments are not switched on." }, { status: 501, headers });
  }
  const wedding = await getWeddingByToken(token);
  if (!wedding || !isHouseTenant(wedding.tenantId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  const a = await getOfficiantAgreement(wedding.id);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404, headers });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  const part = parsed.data.part;

  const payable = officiantPayablePart(a);
  if (payable !== part) {
    const error = !a.acceptedAt
      ? "Accept the agreement first, then pay the deposit."
      : payable === null
        ? "Nothing is owed on this invoice."
        : part === "deposit"
          ? "The deposit is already received."
          : "Pay the deposit first.";
    return NextResponse.json({ error }, { status: 409, headers });
  }

  const inv = officiantInvoiceParts({
    feeUsd: Number(a.feeUsd),
    depositUsd: Number(a.depositUsd),
    balanceHours: a.balanceDueHours,
    depositPaidAt: null,
    balancePaidAt: null,
  });
  const amountCents = Math.round(inv.parts[part === "deposit" ? 0 : 1].amount * 100);
  // Stripe's card minimum is 50 cents.
  if (amountCents < 50) return NextResponse.json({ error: "Nothing to pay by card." }, { status: 409, headers });

  const invoiceNo = officiantInvoiceNumber({ id: a.id, eventDate: wedding.eventDate });
  const metadata = { kind: "officiant", serviceAgreementId: a.id, part, invoice: invoiceNo };
  const label = part === "deposit" ? "deposit" : "balance";

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    // Pinned to agreement, part and amount: a second tap or a second device
    // gets the same session back instead of a parallel one, so the couple
    // cannot be charged twice for one part from here.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        // Card only (Apple Pay and Google Pay ride on it): the button says
        // "by card", and a card settles at once, so returning here means paid.
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `${COMPASS_NAME} officiant ${label}`,
                description: `Wedding officiating by ${officiantDetails(a).officiantName} for ${wedding.coupleNames}, ${formatEventDate(wedding.eventDate)}. Invoice ${invoiceNo}.`,
              },
            },
          },
        ],
        customer_email: wedding.contactEmail ?? undefined,
        metadata,
        payment_intent_data: { metadata, description: `${COMPASS_NAME} officiant ${label}, ${invoiceNo}` },
        success_url: `${SITE_URL}/hub/${token}/officiant?paid=${part}`,
        cancel_url: `${SITE_URL}/hub/${token}/officiant`,
      },
      { idempotencyKey: `officiant-${part}-${a.id}-${amountCents}` },
    );
    if (!session.url) throw new Error("Checkout session has no url");
    return NextResponse.json({ url: session.url }, { headers });
  } catch (err) {
    console.error(`[stripe] officiant ${part} checkout failed for ${a.id}:`, (err as Error).message);
    return NextResponse.json(
      { error: "Card payment could not start. Nothing was charged. Try again in a minute." },
      { status: 502, headers },
    );
  }
}
