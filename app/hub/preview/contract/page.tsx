import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContractView from "@/components/hub/ContractView";
import { buildContract } from "@/lib/contract";
import { SITE_NAME } from "@/lib/site";

// Dev-only layout twin of the agreement page (no database, local accept).
export const metadata: Metadata = {
  title: "Agreement preview",
  robots: { index: false, follow: false },
};

export default function ContractPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const sections = buildContract({
    coupleNames: "Jordan Hayes & Taylor Morgan",
    eventDate: "Saturday, June 12, 2027",
    venueName: "The Sycamore Barn",
    venueAddress: "4280 County Road 325 N, Columbus, IN 47203",
    services: ["dj", "acoustic", "bartender"],
    totalUsd: 2000,
    depositUsd: 500,
  });
  return (
    <div className="min-h-screen bg-cream p-6 text-charcoal">
      <div className="mx-auto max-w-3xl">
        <header className="border-b-2 border-charcoal pb-3">
          <p className="text-sm font-semibold text-terracotta">{SITE_NAME}</p>
          <h1 className="text-2xl font-bold">Service agreement</h1>
          <p className="mt-1 text-sm text-ink/70">
            Jordan Hayes &amp; Taylor Morgan · Saturday, June 12, 2027 · The Sycamore Barn
          </p>
        </header>
        <div className="mt-6">
          <ContractView sections={sections} endpoint="" acceptedAt={null} acceptedName={null} demo />
        </div>
      </div>
    </div>
  );
}
