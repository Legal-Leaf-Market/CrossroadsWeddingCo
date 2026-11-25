import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// The platform scoreboard for Crossroads' own dashboard: how many business
// accounts have signed up, where they came from, and where they stand. Counts
// only; no other account's bookings, money or names beyond the business name
// show here. Read from tenants (kind = 'customer') and the owner's sign-ins.

export type PlatformStats = {
  total: number;
  last7: number;
  last30: number;
  onTrial: number;
  trialEnded: number;
  paying: number;
  bySource: { src: string; n: number }[];
  byType: { type: string; n: number }[];
  recent: { name: string; type: string | null; src: string | null; createdAt: string; trialEndsAt: string | null; plan: string; billingStatus: string | null }[];
};

export async function platformStats(): Promise<PlatformStats> {
  const [tot] = (
    await db.execute(sql`
      select count(*)::int as total,
             count(*) filter (where created_at > now() - interval '7 days')::int as last7,
             count(*) filter (where created_at > now() - interval '30 days')::int as last30,
             count(*) filter (where (plan = 'trial' and (trial_ends_at is null or trial_ends_at > now())) or billing_status = 'trialing')::int as on_trial,
             count(*) filter (where plan = 'trial' and trial_ends_at <= now())::int as trial_ended,
             count(*) filter (where billing_status in ('active', 'past_due'))::int as paying
      from tenants where kind = 'customer'`)
  ).rows as { total: number; last7: number; last30: number; on_trial: number; trial_ended: number; paying: number }[];
  const bySource = (
    await db.execute(sql`select coalesce(signup_src, 'none') as src, count(*)::int as n from tenants where kind = 'customer' group by 1 order by 2 desc, 1`)
  ).rows as { src: string; n: number }[];
  const byType = (
    await db.execute(sql`select coalesce(business_type, 'unknown') as type, count(*)::int as n from tenants where kind = 'customer' group by 1 order by 2 desc, 1`)
  ).rows as { type: string; n: number }[];
  const recent = (
    await db.execute(sql`select name, business_type as type, signup_src as src, created_at, trial_ends_at, plan, billing_status from tenants where kind = 'customer' order by created_at desc limit 15`)
  ).rows as { name: string; type: string | null; src: string | null; created_at: Date | string; trial_ends_at: Date | string | null; plan: string; billing_status: string | null }[];
  const iso = (d: Date | string | null) => (d === null ? null : new Date(d).toISOString());
  return {
    total: tot?.total ?? 0,
    last7: tot?.last7 ?? 0,
    last30: tot?.last30 ?? 0,
    onTrial: tot?.on_trial ?? 0,
    trialEnded: tot?.trial_ended ?? 0,
    paying: tot?.paying ?? 0,
    bySource,
    byType,
    recent: recent.map((r) => ({ name: r.name, type: r.type, src: r.src, createdAt: iso(r.created_at)!, trialEndsAt: iso(r.trial_ends_at), plan: r.plan, billingStatus: r.billing_status })),
  };
}
