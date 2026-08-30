import {
  ACOUSTIC_ADDON_USD,
  BARTENDER_MIN_USD,
  DEPOSIT_USD,
  DJ_DAY_RATE_USD,
  EMAIL_FROM_ADDRESS,
  HOME_BASE,
  SITE_NAME,
  TRAVEL_SURCHARGE_RANGE,
} from "@/lib/site";

// The service agreement, generated from the same constants as the public site
// so a price can never drift between what a couple reads and what they sign.
// Owner policy decisions encoded here (CLAUDE.md §9.2): balance due 24 hours
// after the start time with that window doubling as the couple's
// comments-and-concerns period, serve-only bar (we never supply or sell
// alcohol), cash/check deposits for now, acoustic set terms.
//
// NOT legal advice: this is a plain-language agreement written from the
// owners' stated policies and should be reviewed by an Indiana attorney
// before it carries real weight. Bump CONTRACT_VERSION on any wording change
// so accepted snapshots stay traceable to the text that was accepted.

export const CONTRACT_VERSION = "2026-08-30";

export type ContractInput = {
  coupleNames: string;
  eventDate: string;
  venueName: string;
  venueAddress?: string | null;
  services: string[];
  totalUsd: number;
  depositUsd: number;
  /** Replaces the standard cost section verbatim when the deal is bespoke. */
  customTerms?: string | null;
};

export type ContractSection = { heading: string; paragraphs: string[] };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Which services a wedding carries, derived from the stored addons JSON. */
export function servicesFromAddons(
  addons: unknown,
  packageType: string | null,
): string[] {
  const rows = Array.isArray(addons) ? (addons as { type?: string }[]) : [];
  const out: string[] = [];
  if (packageType !== "a_la_carte") out.push("dj");
  if (rows.some((r) => r.type === "acoustic_set")) out.push("acoustic");
  if (rows.some((r) => r.type === "bar_service")) out.push("bartender");
  return out;
}

export function buildContract(input: ContractInput): ContractSection[] {
  const hasDj = input.services.includes("dj");
  const hasAcoustic = input.services.includes("acoustic");
  const hasBar = input.services.includes("bartender");

  const whatWeDo: string[] = [];
  if (hasDj) {
    whatWeDo.push(
      `DJ and MC for the day, ${money(DJ_DAY_RATE_USD)} flat. That covers ceremony sound, cocktail hour, and reception, all of our own equipment set up before guests arrive and struck after they leave, MC duties dialed to whatever you want them to be, and running your day-of timeline: calling cues, lining up the wedding party, and keeping the schedule moving.`,
    );
  }
  if (hasAcoustic) {
    whatWeDo.push(
      `A live solo acoustic set, ${money(ACOUSTIC_ADDON_USD)} flat. One performer, singer-songwriter style, for your ceremony or your cocktail hour. One hour is the sweet spot and two hours is the maximum. With enough notice, which means at least 30 days before the wedding, we will learn up to three songs of your choosing; everything else comes from our standing repertoire.`,
    );
  }
  if (hasBar) {
    whatWeDo.push(
      `Bar service, starting at ${money(BARTENDER_MIN_USD)}. That minimum is not the final price: your guest count and what you are serving set the real number, and we quote it to you in writing before the wedding. We provide licensed, experienced bartenders who set up, serve all night, and break down the bar.`,
    );
  }

  const sections: ContractSection[] = [
    {
      heading: "Who this is between",
      paragraphs: [
        `This agreement is between ${SITE_NAME}, based in ${HOME_BASE} ("we" or "us"), and ${input.coupleNames} ("you"), for the wedding on ${input.eventDate} at ${input.venueName}${input.venueAddress ? `, ${input.venueAddress}` : ""}.`,
        `We have written this in plain English on purpose. If any part of it is unclear, message us in your planning hub and we will explain it or change it before you accept.`,
      ],
    },
    { heading: "What we are providing", paragraphs: whatWeDo },
    {
      heading: "What it costs, and when it is due",
      paragraphs: input.customTerms?.trim()
        ? input.customTerms.trim().split(/\n+/).map((line) => line.trim()).filter(Boolean)
        : [
        hasBar && input.services.length === 1
          ? `Your bar service starts at ${money(BARTENDER_MIN_USD)} and gets quoted in writing once we know your guest count and what you are pouring.`
          : `Your total is ${money(input.totalUsd)}${hasBar ? `, plus whatever your bar quote comes to above the ${money(BARTENDER_MIN_USD)} minimum included here` : ""}.`,
        `A deposit of ${money(input.depositUsd)} is due when you accept this agreement. It locks your date, comes off your total, and is non-refundable, because once we hold your date we stop offering it to anyone else.`,
        `The balance is due 24 hours after your wedding start time. A 3 PM wedding means the balance is due by 3 PM the next day. We ask for the balance after the wedding, not before, because you should not pay in full for something that has not happened yet.`,
        `That same 24 hours is your window to tell us anything you were unhappy about. If we fell short, say so in that window and we will adjust the invoice. We would rather fix a number than have you tell your friends we were not worth it.`,
        `Payments are by cash or check right now. We will send you the details with your confirmation.`,
      ],
    },
  ];

  if (hasBar) {
    sections.push({
      heading: "How our bar service works, and what Indiana requires",
      paragraphs: [
        `You provide all of the alcohol. We do not supply it, we do not sell it, and we do not mark it up. You buy what you want at retail prices and we staff and run the bar on your behalf. This is how a private event bar works legally in Indiana, and it is also cheaper for you.`,
        `Our bartenders hold current Indiana Alcohol and Tobacco Commission employee permits. If your venue holds its own alcohol permit, we work under that permit and follow the venue's rules.`,
        `Our bartenders will check identification and will refuse service to anyone who is underage or visibly intoxicated. That is not negotiable, and it protects you as much as it protects us. If a guest becomes a safety problem, we will come find you or your point person.`,
        `You are responsible for having the alcohol, ice, and any specialty glassware on site before service starts. Tell us your final headcount at least 14 days out so we can staff correctly and give you a shopping list if you want one.`,
      ],
    });
  }

  sections.push({
    heading: "What we need from you",
    paragraphs: [
      `Access to the space for load-in at least 90 minutes before guests arrive, and a working power outlet within reasonable reach of where we set up.`,
      `If any part of our setup is outdoors, cover from sun and rain. Electronics and weather do not mix, and if there is no cover we may have to move or stop, which is bad for everyone.`,
      `Your timeline, music picks, and the names you want announced, in your planning hub at least 14 days before the wedding. After that we lock the run sheet so your crew and your venue can all work from the same page. You can still change things after the lock, just talk to us.`,
      `One person we can text on the day who is not the couple. You should be getting married, not answering logistics questions.`,
    ],
  });

  sections.push({
    heading: "Travel",
    paragraphs: [
      `Venues within about an hour of ${HOME_BASE} carry no travel fee. Past that, travel runs ${TRAVEL_SURCHARGE_RANGE}, quoted to you up front and never as a surprise afterward.`,
    ],
  });

  sections.push({
    heading: "If plans change",
    paragraphs: [
      `If you cancel, the deposit stays with us and nothing further is owed. If you cancel within 30 days of the wedding, half of the remaining balance is owed, because at that point the date cannot realistically be rebooked.`,
      `If you move your date, we will move with you at no extra charge if we are available on the new date. If we are not available, it is treated as a cancellation.`,
      `If something on our side makes it impossible for us to be there, illness, an accident, an act of God, we will do everything we can to send a qualified replacement at the same price. If we cannot, you get every dollar back, including the deposit. That is the only situation where the deposit comes back, and we will not fight you on it.`,
      `Neither of us is responsible for things genuinely outside anyone's control: severe weather, power failure, venue closure, or a public emergency. If that happens we will work out something fair, and we will start that conversation instead of hiding from it.`,
    ],
  });

  sections.push({
    heading: "Our gear, and the fine print nobody enjoys",
    paragraphs: [
      `Our equipment stays ours. If a guest damages it, we will come to you about the repair or replacement cost, so please keep drinks off the DJ table.`,
      `We carry our own liability insurance and will send a certificate directly to your venue if they ask for one. Just give us the venue contact in your hub.`,
      `Our total responsibility under this agreement is limited to what you paid us. We are a small crew doing our best for you, not an insurance company.`,
      `We may take photos or short video of our setup and the celebration, and use them to show other couples what we do. If you would rather we did not, message us in your hub and we will not, no explanation needed.`,
    ],
  });

  sections.push({
    heading: "Agreeing to this",
    paragraphs: [
      `Typing your name below and accepting means you have read this and agree to it. It has the same effect as a signature. We will both have a copy: yours lives in your planning hub, and you can print or save it any time.`,
      `Questions before you accept? Message us in your hub, or email ${EMAIL_FROM_ADDRESS}. We would much rather answer now than have you agree to something you were unsure about.`,
    ],
  });

  return sections;
}
