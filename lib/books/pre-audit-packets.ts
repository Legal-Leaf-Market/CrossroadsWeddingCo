import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { accountTotals, generalLedgerCsv, naturalBalance } from "@/lib/books/ledger";
import { externalEvidence, preAuditEvidence, preAuditReports, type preAuditRange } from "@/lib/books/pre-audit";
import { csvOf, dollars } from "@/lib/books/subledger-logic";
import { SITE_URL } from "@/lib/site";

const MAX_BYTES = 3_800_000;
const MAX_CLAIMS = 5_000;
const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "image/gif": "gif" };

type Range = ReturnType<typeof preAuditRange>;
type Packet = { id: string; createdAt: string; through: string; sha256: string; sizeBytes: number };
export class PacketTooLarge extends Error {}

export async function listPreAuditPackets(tenantId: string, year: number, before?: string) {
  const result = await db.execute(sql`
    select id::text, created_at::text as "createdAt", through_date::text as through, sha256, size_bytes as "sizeBytes"
    from pre_audit_packets where tenant_id = ${tenantId} and review_year = ${year}
    ${before ? sql`and (created_at, id) < (
      select created_at, id from pre_audit_packets where tenant_id = ${tenantId} and review_year = ${year} and id = ${before}::uuid
    )` : sql``}
    order by created_at desc, id desc limit 26`);
  return result.rows as Packet[];
}

export async function loadPreAuditPacket(tenantId: string, id: string) {
  const result = await db.execute(sql`
    select review_year as year, sha256, archive from pre_audit_packets
    where tenant_id = ${tenantId} and id = ${id}::uuid`);
  return (result.rows[0] as { year: number; sha256: string; archive: Buffer } | undefined) ?? null;
}

export const checksum = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

export async function savePreAuditPacket(
  tenantId: string, userId: string, actor: string, range: Range, includeReceipts: boolean,
) {
  const id = randomUUID();
  const snapshot = await db.transaction(async (tx) => {
    const seen = await tx.execute(sql`select transaction_timestamp()::text as "capturedAt"`);
    const capturedAt = String(seen.rows[0].capturedAt);
    const items = await preAuditEvidence(tenantId, range, MAX_CLAIMS + 1, tx);
    if (items.length > MAX_CLAIMS) throw new PacketTooLarge("This year has too many expense claims for one packet. Use the report and index downloads.");
    const receiptItems = items.filter((item) => item.receiptId);
    const receiptSizes = new Map(receiptItems.map((item) => [item.receiptId!, item.receiptBytes ?? 0]));
    if (includeReceipts && [...receiptSizes.values()].reduce((sum, size) => sum + size, 0) > MAX_BYTES) {
      throw new PacketTooLarge("These receipts are too large for one ZIP. Create a reports-only packet and download the receipts separately.");
    }
    const attachments = includeReceipts && receiptSizes.size
      ? await tx.select({ id: receipts.id, data: receipts.data, mime: receipts.mimeType }).from(receipts)
        .where(and(eq(receipts.tenantId, tenantId), inArray(receipts.id, [...receiptSizes.keys()])))
      : [];
    const journal = await generalLedgerCsv(tenantId, { from: range.from, to: range.through }, tx, true);
    const accounts = (await accountTotals(tenantId, { to: range.through }, tx)).filter((account) => account.debit || account.credit);
    return { capturedAt, items, attachments, journal, accounts };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });

  const files: Record<string, Uint8Array> = {};
  const names = new Map<string, string>();
  for (const item of snapshot.attachments) {
    const ext = extensions[item.mime] ?? "bin";
    const path = `receipts/${item.id}.${ext}`;
    files[path] = item.data;
    names.set(item.id, path);
  }
  const headers = ["As of", "Account code", "Account", "Type", "Debits", "Credits", "Balance"];
  const trial = snapshot.accounts.map((a) => [range.through, a.code, a.name, a.type, dollars(a.debit), dollars(a.credit), dollars(naturalBalance(a))]);
  files["trial-balance.csv"] = strToU8(csvOf(headers, trial));
  files["general-ledger.csv"] = strToU8(snapshot.journal);
  files["cpa-comparison.csv"] = strToU8(csvOf(
    ["As of", "Account code", "Account", "ERP debits", "ERP credits", "CPA debits", "CPA credits", "Difference", "Proposed adjustment", "Evidence reference", "Reviewer note"],
    trial.map(([asOf, code, name, , debit, credit]) => [asOf, code, name, debit, credit, "", "", "", "", "", ""]),
  ));
  files["evidence-index.csv"] = strToU8(csvOf(
    ["Date", "Expense", "Amount", "Status", "Notes", "Receipt", "Archive file", "Live receipt", "Live audit history"],
    snapshot.items.map((item) => [
      item.day, item.merchant || "Expense", dollars(item.amountCents), item.status, item.description,
      item.receiptId ? item.fileName || "Receipt on file" : "Missing",
      item.receiptId ? names.get(item.receiptId) ?? "" : "",
      item.receiptId ? `${SITE_URL}/api/app/expenses/${item.id}/receipt` : "",
      `${SITE_URL}/app/books/audit?type=expense_claim&id=${item.id}`,
    ]),
  ));
  files["README.txt"] = strToU8([
    "Crossroads Books pre-audit packet", `Packet ID: ${id}`, `Captured at: ${snapshot.capturedAt}`,
    `Activity period: ${range.from} through ${range.through}`,
    "Trial balance includes posted activity through the cutoff, including prior periods. The general ledger contains posted activity in the selected range.",
    "These reports describe the ledger as captured. Generating this archive does not sync, post or close the books.",
    includeReceipts ? "The included receipt files are indexed in evidence-index.csv." : "Receipt files were omitted. Live receipt links require Books access.",
    "", "Additional evidence to collect if applicable", ...externalEvidence,
    "", "Live reports can change and require Books access", ...preAuditReports(range).map(([name, path]) => `${name}: ${SITE_URL}${path}`),
  ].join("\n") + "\n");
  files["manifest-sha256.txt"] = strToU8(Object.entries(files).map(([name, data]) => `${checksum(data)}  ${name}`).join("\n") + "\n");
  if (Object.values(files).reduce((sum, bytes) => sum + bytes.byteLength, 0) > 20_000_000) {
    throw new PacketTooLarge("This packet exceeds the processing limit. Download the reports individually.");
  }
  const zip = zipSync(files, { level: 3 });
  if (zip.byteLength > MAX_BYTES) {
    throw new PacketTooLarge("This ZIP exceeds the download limit. Try a reports-only packet or download the files individually.");
  }
  const sha256 = checksum(zip);
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into pre_audit_packets (id, tenant_id, review_year, through_date, created_by, sha256, size_bytes, archive, created_at)
      values (${id}, ${tenantId}, ${range.year}, ${range.through}, ${userId}, ${sha256}, ${zip.byteLength}, ${Buffer.from(zip)}, ${snapshot.capturedAt}::timestamptz)`);
    await audit(tx, {
      tenantId, actor, action: "report.snapshot_created", entityType: "pre_audit_packet", entityId: id,
      after: { from: range.from, through: range.through, sha256, sizeBytes: zip.byteLength, receiptsIncluded: names.size },
    });
  });
  return id;
}
