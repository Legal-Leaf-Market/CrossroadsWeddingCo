import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";
import { signatureFont } from "@/components/contract/signatureFont";

// The signature page of the agreement: both parties, each with the signed
// name, the printed name, and the date, set large enough to read across a
// table. Shared by the couple's copy and the owner's copy so the paper a
// couple is handed and the page they see in their hub can never disagree.
//
// A side that has not signed electronically yet prints blank ink lines
// instead, so a hard copy can still be finished with a pen.

export type Signer = {
  /** What was typed as the signature. */
  name: string;
  /** ISO timestamp of signing. */
  at: string;
};

function parts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: new Intl.DateTimeFormat("en-US", { timeZone: VENUE_TIME_ZONE, dateStyle: "long" }).format(d),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: VENUE_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d),
  };
}

function Party({
  label,
  party,
  signer,
  role,
}: {
  label: string;
  party: string;
  signer: Signer | null;
  role?: string | null;
}) {
  const when = signer ? parts(signer.at) : null;
  return (
    <div className="break-inside-avoid rounded-xl border border-charcoal/30 p-5 print:rounded-none">
      <p className="text-xs font-bold uppercase tracking-widest text-terracotta">{label}</p>
      <p className="mt-1 text-sm font-semibold text-charcoal">{party}</p>

      <div className="mt-5 flex min-h-14 items-end border-b-2 border-charcoal pb-1">
        {signer ? (
          <span className={`${signatureFont.className} text-4xl leading-none text-charcoal`}>
            {signer.name}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ink/60">Signature</p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-ink/60">Name</dt>
        <dd className="border-b border-charcoal/30 font-semibold text-charcoal">
          {signer?.name ?? " "}
        </dd>
        {role !== undefined && (
          <>
            <dt className="text-ink/60">Title</dt>
            <dd className="border-b border-charcoal/30 font-semibold text-charcoal">
              {role || " "}
            </dd>
          </>
        )}
        <dt className="text-ink/60">Date</dt>
        <dd className="border-b border-charcoal/30 text-base font-bold text-charcoal">
          {when?.date || " "}
        </dd>
      </dl>

      <p className="mt-3 text-xs text-ink/60">
        {signer
          ? `Signed electronically at ${when?.time}.`
          : "Not yet signed. Sign and date by hand above."}
      </p>
    </div>
  );
}

export default function SignatureBlock({
  coupleNames,
  client,
  company,
  companyTitle,
  version,
}: {
  coupleNames: string;
  client: Signer | null;
  company: Signer | null;
  companyTitle: string | null;
  version: string;
}) {
  const both = client && company;
  return (
    <section className="mt-10 break-inside-avoid border-t-2 border-charcoal pt-6">
      <h2 className="text-lg font-semibold text-charcoal">Signatures</h2>
      <p className="mt-1 text-sm text-ink/70">
        {both
          ? "Both parties have signed. This agreement is in effect as of the later date below."
          : client
            ? `Signed by the client. Awaiting signature from ${SITE_NAME}.`
            : "Not yet signed."}
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 print:grid-cols-2">
        <Party label="Client" party={coupleNames} signer={client} />
        <Party label="For the company" party={SITE_NAME} signer={company} role={companyTitle ?? ""} />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/60">
        Electronic signatures: each name above that was typed and accepted online carries the same
        effect as a handwritten signature under Indiana&apos;s Uniform Electronic Transactions Act
        (IC 26-2-8) and the federal E-SIGN Act. The time and the exact terms accepted are kept on
        record. Agreement version {version}.
      </p>
    </section>
  );
}
