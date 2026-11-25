import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventPlanEditor from "@/components/admin/EventPlanEditor";
import { adminKeyMatches } from "@/lib/admin";
import { getEventPlan } from "@/lib/costing";
import { formatEventDate } from "@/lib/hub-constants";
import { SITE_NAME, VENUE_TIME_ZONE } from "@/lib/site";

// One event's labor and material plan, and what it leaves the owners
// (2026-11-13). Same key gate as the rest of /admin/[key].
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event costing",
  robots: { index: false, follow: false },
};

export default async function CostingPage({ params }: { params: Promise<{ key: string; weddingId: string }> }) {
  const { key, weddingId } = await params;
  if (!adminKeyMatches(key)) notFound();
  const plan = await getEventPlan(weddingId);
  if (!plan) notFound();
  const { wedding: w, rows, crew, items } = plan;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: VENUE_TIME_ZONE });
  const revenueCents = Math.round(Number(w.totalAmount) * 100) || 0;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-parchment bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl text-charcoal">Costing: {w.coupleNames}</h1>
          <p className="text-sm text-ink/60">
            {formatEventDate(w.eventDate)} · {w.venueName}
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm font-medium">
            <a href={`/admin/${key}`} className="text-terracotta underline decoration-parchment underline-offset-2">
              Back to the command center
            </a>
            <a href={`/admin/${key}/crew`} className="text-terracotta underline decoration-parchment underline-offset-2">
              Crew, pay and materials
            </a>
            <a href={`/admin/${key}/invoice/${w.id}`} className="text-terracotta underline decoration-parchment underline-offset-2">
              Invoice
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <EventPlanEditor
          adminKey={key}
          weddingId={w.id}
          revenueCents={revenueCents}
          eventPast={w.eventDate < today}
          crew={crew.map((c) => ({
            id: c.id,
            name: c.name,
            defaultRole: c.defaultRole,
            payMethod: c.payMethod,
            rateCents: c.rateCents,
            percentBps: c.percentBps,
            retired: c.retiredAt !== null,
          }))}
          items={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, unitCostCents: i.unitCostCents, retired: i.retiredAt !== null }))}
          owners={crew.filter((c) => c.payMethod === "owner" && !c.retiredAt).map((c) => ({ id: c.id, name: c.name, shareBps: c.shareBps }))}
          initial={rows.map((r) => ({
            id: r.id,
            kind: r.kind === "material" ? "material" : "labor",
            crewMemberId: r.crewMemberId,
            resourceItemId: r.resourceItemId,
            label: r.label,
            role: r.role,
            payMethod: r.payMethod,
            rateCents: r.rateCents,
            percentBps: r.percentBps,
            plannedMinutes: r.plannedMinutes,
            actualMinutes: r.actualMinutes,
            unit: r.unit,
            unitCostCents: r.unitCostCents,
            plannedQty: r.plannedQty == null ? null : Number(r.plannedQty),
            actualQty: r.actualQty == null ? null : Number(r.actualQty),
            actualCostCents: r.actualCostCents,
            notes: r.notes,
          }))}
        />
      </main>
    </div>
  );
}
