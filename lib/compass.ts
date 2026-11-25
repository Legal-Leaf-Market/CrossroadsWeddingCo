import { HOME_BASE, SITE_NAME } from "@/lib/site";
import type { ContractSection } from "@/lib/contract";

// Compass Events by Crossroads Wedding and Event Co. (2026-11-12, Jake and
// Terry): the event planning and officiating brand of Crossroads, run by
// Terry Winchester as its Chief Executive Officer. Its first service is
// officiating, first booked by an existing Crossroads couple.
//
// An officiating agreement is SEPARATE from a couple's Crossroads service
// agreement: its own link in the same planning hub, its own deposit, its own
// balance and its own signatures, with Terry signing for Compass Events the
// way Jake signs for Crossroads. Nothing here changes the Crossroads one.
//
// Pure and client-safe: no database. NOT legal advice and NOT lawyer-reviewed;
// written from Terry's own texted terms. Bump OFFICIANT_AGREEMENT_VERSION on
// any wording change so accepted snapshots stay traceable.

export const COMPASS_NAME = "Compass Events";
export const COMPASS_FULL_NAME = `${COMPASS_NAME} by ${SITE_NAME}`;
export const COMPASS_SIGNER_TITLE = `Chief Executive Officer, ${COMPASS_NAME}`;

/** Terry's terms, as texted to the first client. */
export const OFFICIANT_USD = 250;
export const OFFICIANT_DEPOSIT_USD = 125;
/** Balance is due this many hours after the ceremony is complete. */
export const OFFICIANT_BALANCE_HOURS = 48;
export const OFFICIANT_DEFAULT_NAME = "Terry Winchester";

export const OFFICIANT_AGREEMENT_VERSION = "2026-11-12b";

/** Indiana: IC 31-11-4-10 (license expires after 60 days) and IC 31-11-4-16 (file within 30 days). */
export const IN_LICENSE_VALID_DAYS = 60;
export const IN_FILING_DAYS = 30;

export type OfficiantDetails = {
  officiantName: string;
  /** How the officiant is authorized to solemnize marriages in Indiana. Printed only when filled in. */
  credential: string;
  /** Rehearsal date, time and place, when known. */
  rehearsal: string;
  /** Anything else agreed, in plain words. */
  notes: string;
};

export type OfficiantInput = OfficiantDetails & {
  coupleNames: string;
  /** Already formatted for reading, e.g. "Saturday, June 12, 2027". */
  eventDate: string;
  venueName: string;
  venueAddress?: string | null;
  feeUsd: number;
  depositUsd: number;
  balanceHours: number;
  /** Card payments are switched on (COMPASS_CARD_PAYMENTS=1): the payment clause offers card too. */
  cardPayments?: boolean;
};

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function buildOfficiantAgreement(i: OfficiantInput): ContractSection[] {
  const officiant = i.officiantName.trim() || OFFICIANT_DEFAULT_NAME;
  const balance = Math.max(0, Math.round((i.feeUsd - i.depositUsd) * 100) / 100);
  const where = `${i.venueName}${i.venueAddress ? `, ${i.venueAddress}` : ""}`;

  const who = [
    `This agreement is between ${COMPASS_FULL_NAME} ("${COMPASS_NAME}", "we" or "us"), the event planning and officiating side of ${SITE_NAME}, based in ${HOME_BASE}, and ${i.coupleNames} ("you"), for your wedding ceremony on ${i.eventDate} at ${where}.`,
    `Your officiant is ${officiant}, Chief Executive Officer of ${COMPASS_NAME}.${i.credential.trim() ? ` Authorization to solemnize marriages in Indiana: ${i.credential.trim()}.` : ""}`,
    `This is a separate agreement from any service agreement you have with ${SITE_NAME} for DJ, music or bar service. It has its own deposit, its own balance and its own signatures, and nothing in it changes that agreement. If either one ends, the other stays as it is.`,
  ];

  const included = [
    `One flat fee of ${money(i.feeUsd)} covers all of the following:`,
    `A planning call over Zoom (or by phone, if you prefer) to go through your ceremony from start to finish and answer your questions, and any follow-up coordination you need before the day.`,
    `Writing and shaping the ceremony with you: the order, the words, readings, vows, and anything personal you want included.`,
    `Walking you through applying for your Indiana marriage license ahead of time, so you know exactly what to bring and when.`,
    `Attending your wedding rehearsal${i.rehearsal.trim() ? ` (${i.rehearsal.trim()})` : ", on a date and time we set together"}, and walking the ceremony through with the people in it.`,
    `Arriving early on the wedding day to set up, greet guests as they arrive, and coordinate the formal parts of the ceremony.`,
    `Performing the ceremony.`,
    `Completing and signing your marriage certificate after the ceremony and filing it with the county clerk who issued your license, within the ${IN_FILING_DAYS} days Indiana law allows.`,
    `Travel to your rehearsal and your ceremony at the venue named above is included. If the venue changes to one more than about an hour from ${HOME_BASE}, we will tell you before anything changes whether travel costs anything, and nothing is added without your agreement.`,
  ];
  if (i.notes.trim()) included.push(`Also agreed: ${i.notes.trim()}`);

  return [
    { heading: "Who this is between", paragraphs: who },
    { heading: "What is included", paragraphs: included },
    {
      heading: "What it costs, and when it is due",
      paragraphs: [
        `The fee is ${money(i.feeUsd)}, paid in two parts.`,
        `A deposit of ${money(i.depositUsd)} is due when you accept this agreement. It holds your date and time, pays for the planning time we set aside before the wedding, and comes off the fee. It is non-refundable, except in the one case described under "If your officiant cannot be there".`,
        `The balance of ${money(balance)} is due within ${i.balanceHours} hours after your ceremony is complete.`,
        i.cardPayments
          ? `You can pay each part by card from the invoice below this agreement, or by cash or check. Checks are made out to ${SITE_NAME.replace(/\.$/, "")}, the company behind ${COMPASS_NAME}. The invoice shows each payment as it is received.`
          : `Payments are by cash or check for now. Checks are made out to ${SITE_NAME.replace(/\.$/, "")}, the company behind ${COMPASS_NAME}. Your invoice is below this agreement, and it shows each payment as it is received.`,
      ],
    },
    {
      heading: "Your marriage license",
      paragraphs: [
        `Getting a valid Indiana marriage license is your responsibility. You apply for it with a county clerk, and it expires ${IN_LICENSE_VALID_DAYS} days after it is issued unless the ceremony happens within that time, so apply within the ${IN_LICENSE_VALID_DAYS} days before your wedding. We will walk you through it.`,
        `Please give the license to your officiant at the rehearsal, or before the ceremony begins at the latest. Without a valid license in hand, your officiant can still lead your ceremony, but it would not be a legal marriage until a ceremony takes place under a valid license, and the fee stays the same.`,
        `The information on the license comes from you and the clerk. Please check the names and details on it before the day.`,
      ],
    },
    {
      heading: "Filing, and what we are not responsible for",
      paragraphs: [
        `After the ceremony your officiant completes and signs the certificate and files it in good faith with the clerk who issued your license, within ${IN_FILING_DAYS} days of the ceremony. Before it leaves our hands we keep a photo of the completed certificate. If the clerk sends it back for a correction that is ours to make, we fix it and file it again at no charge.`,
        `We are not responsible for delays or losses caused by the postal service or the clerk's office, for errors in information you or the clerk put on the license, or for a license that was invalid or had expired when it reached us.`,
      ],
    },
    {
      heading: "If your officiant cannot be there",
      paragraphs: [
        `Officiating is a personal service, and you are booking ${officiant}. If sudden illness, an emergency, or something else outside our control makes that impossible, we will make every reasonable effort to provide a qualified substitute who is legally able to solemnize marriages in Indiana, at the same price.`,
        `If we cannot provide a substitute, you get back every dollar you paid under this agreement, including the deposit.`,
      ],
    },
    {
      heading: "If plans change",
      paragraphs: [
        `If you cancel, the deposit stays with us and nothing further is owed.`,
        `If you move your date, we will move with you at no extra charge if your officiant is available on the new date. If not, we will try to provide a substitute as described above; if that does not work for you, it is treated as a cancellation.`,
        `Neither of us is responsible for things genuinely outside anyone's control: severe weather, venue closure, or a public emergency. If that happens we will work out something fair together.`,
      ],
    },
    {
      heading: "The fine print",
      paragraphs: [
        `Our total responsibility under this agreement is limited to what you paid under it.`,
        `This agreement is governed by Indiana law. If anything in it turns out to be unenforceable, the rest still stands.`,
        `This is the whole agreement for officiating. Any change to it is made in writing, through your planning hub, and agreed by both of us.`,
      ],
    },
    {
      heading: "Agreeing to this",
      paragraphs: [
        `Typing your name below and accepting means you have read this and agree to it. It has the same effect as a signature. Your copy lives in your planning hub, next to your invoice, and you can print or save it any time.`,
        `Questions before you accept? Message us in your hub or ask ${officiant.split(/\s+/)[0]} directly. We would much rather answer now than have you agree to something you were unsure about.`,
      ],
    },
  ];
}

/** Readable and stable, like the Crossroads invoice: CE-<ceremony date>-<first 4 of the id>. */
export function officiantInvoiceNumber(a: { id: string; eventDate: string }): string {
  return `CE-${a.eventDate.replace(/-/g, "")}-${a.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

export type OfficiantPart = { label: string; due: string; amount: number; paidAt: string | null };

/** The two-part invoice: the deposit, then the balance after the ceremony. */
export function officiantInvoiceParts(a: {
  feeUsd: number;
  depositUsd: number;
  balanceHours: number;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
}): { parts: OfficiantPart[]; total: number; paid: number; due: number } {
  const total = Math.round(a.feeUsd * 100) / 100;
  const deposit = Math.min(total, Math.round(a.depositUsd * 100) / 100);
  const balance = Math.round((total - deposit) * 100) / 100;
  const parts: OfficiantPart[] = [
    { label: "Deposit: holds your date and time", due: "Due when you accept the agreement", amount: deposit, paidAt: a.depositPaidAt },
    { label: "Balance", due: `Due within ${a.balanceHours} hours after the ceremony`, amount: balance, paidAt: a.balancePaidAt },
  ];
  const paid = parts.reduce((s, p) => s + (p.paidAt ? p.amount : 0), 0);
  return { parts, total, paid, due: Math.round((total - paid) * 100) / 100 };
}
