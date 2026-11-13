import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { financeRoles } from "@/lib/db/schema";
import type { Role } from "@/lib/books/accrual";

// Who holds which seat in the finance chain (2026-11-13): Jake (CEO) triggers,
// Terry Winchester II (CBO, acting CFO) approves or vetoes, Nic (COO) breaks
// ties. Everyone signed in can see, enter and edit; these seats only decide
// who can trigger and who can approve. Read from finance_roles every time, so
// revoking a seat takes effect at once.

export async function rolesFor(tenantId: string, email: string): Promise<Set<Role>> {
  const rows = await db
    .select({ role: financeRoles.role })
    .from(financeRoles)
    .where(and(eq(financeRoles.tenantId, tenantId), sql`lower(${financeRoles.email}) = lower(${email})`, isNull(financeRoles.revokedAt)));
  return new Set(rows.map((r) => r.role as Role));
}

export async function listRoles(tenantId: string) {
  return db
    .select()
    .from(financeRoles)
    .where(and(eq(financeRoles.tenantId, tenantId), isNull(financeRoles.revokedAt)))
    .orderBy(financeRoles.role, financeRoles.email);
}
