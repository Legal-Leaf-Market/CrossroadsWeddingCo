import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, bankTransactions, vendors, type Vendor } from "@/lib/db/schema";
import { matchWords, lineMatches, vendorYears, type VendorKind, type VendorLine, type VendorYear } from "@/lib/books/vendor-logic";

// Vendors for one account. Every query carries the session's tenant id.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Money-out bank lines for the account, posted and kept, with the paying account's type. */
async function paymentLines(tenantId: string): Promise<(VendorLine & { id: string })[]> {
  return db
    .select({
      id: bankTransactions.id,
      amountCents: bankTransactions.amountCents,
      postedDate: bankTransactions.postedDate,
      accountType: bankAccounts.type,
      merchant: bankTransactions.merchant,
      description: bankTransactions.description,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .where(
      and(
        eq(bankTransactions.tenantId, tenantId),
        isNull(bankTransactions.removedAt),
        eq(bankTransactions.pending, false),
        sql`${bankTransactions.reviewStatus} <> 'excluded'`,
        sql`${bankTransactions.amountCents} < 0`,
      ),
    )
    .orderBy(desc(bankTransactions.postedDate));
}

export type VendorRow = Vendor & { thisYear: VendorYear | null };

export async function listVendors(tenantId: string, opts: { archived?: boolean } = {}): Promise<VendorRow[]> {
  const [rows, lines] = await Promise.all([
    db
      .select()
      .from(vendors)
      .where(and(eq(vendors.tenantId, tenantId), opts.archived ? sql`${vendors.archivedAt} is not null` : isNull(vendors.archivedAt)))
      .orderBy(asc(vendors.name)),
    paymentLines(tenantId),
  ]);
  const year = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Indiana/Indianapolis" }).slice(0, 4));
  return rows.map((v) => ({ ...v, thisYear: vendorYears(matchWords(v.matchText, v.name), lines).find((y) => y.year === year) ?? null }));
}

export async function getVendor(tenantId: string, id: string) {
  if (!UUID_RE.test(id)) return null;
  const [v] = await db.select().from(vendors).where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId))).limit(1);
  if (!v) return null;
  const lines = await paymentLines(tenantId);
  const words = matchWords(v.matchText, v.name);
  return {
    vendor: v,
    years: vendorYears(words, lines),
    payments: lines.filter((l) => lineMatches(words, l.merchant, l.description)).slice(0, 100),
  };
}

export type VendorInput = {
  name: string;
  kind: VendorKind;
  email?: string;
  phone?: string;
  matchText?: string;
  is1099?: boolean;
  w9OnFile?: boolean;
  notes?: string;
};

export async function createVendor(tenantId: string, input: VendorInput): Promise<string> {
  const [row] = await db
    .insert(vendors)
    .values({
      tenantId,
      name: input.name,
      kind: input.kind,
      email: input.email || null,
      phone: input.phone || null,
      matchText: input.matchText ?? "",
      // Contractors are 1099 candidates by default; the owner can turn it off.
      is1099: input.is1099 ?? input.kind === "contractor",
      w9OnFile: input.w9OnFile ?? false,
      notes: input.notes ?? "",
    })
    .returning({ id: vendors.id });
  return row.id;
}

export async function updateVendor(
  tenantId: string,
  id: string,
  patch: Partial<VendorInput> & { archived?: boolean },
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["name", "kind", "matchText", "is1099", "w9OnFile", "notes"] as const) if (patch[k] !== undefined) set[k] = patch[k];
  if (patch.email !== undefined) set.email = patch.email || null;
  if (patch.phone !== undefined) set.phone = patch.phone || null;
  if (patch.archived !== undefined) set.archivedAt = patch.archived ? new Date() : null;
  const done = await db
    .update(vendors)
    .set(set)
    .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)))
    .returning({ id: vendors.id });
  return done.length > 0;
}

/** Contractors over this year's threshold with no W-9 on file: for "Needs you". */
export async function w9Needed(tenantId: string): Promise<{ id: string; name: string; bankPaidCents: number }[]> {
  const rows = await listVendors(tenantId);
  return rows
    .filter((v) => v.is1099 && !v.w9OnFile && v.thisYear?.status === "over")
    .map((v) => ({ id: v.id, name: v.name, bankPaidCents: v.thisYear!.bankPaidCents }));
}
