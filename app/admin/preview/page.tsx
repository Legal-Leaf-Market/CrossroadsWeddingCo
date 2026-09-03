import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Dashboard from "@/components/admin/Dashboard";
import type { AdminData } from "@/lib/admin";

// Dev-only sample-data twin of /admin/[key] for layout QA without a database
// (same pattern as /hub/preview). 404s in production builds.
export const metadata: Metadata = {
  title: "Admin preview",
  robots: { index: false, follow: false },
};

const SAMPLE: AdminData = {
  upcoming: [
    {
      id: "1",
      archivedAt: null,
      coupleNames: "Jordan Hayes & Taylor Morgan",
      eventDate: "2027-06-12",
      venueName: "The Sycamore Barn",
      status: "deposit_paid",
      addons: [
        { type: "acoustic_set", fee: 500 },
        { type: "bar_service", fee: null, minFee: 500 },
      ],
      totalAmount: "2000.00",
      isDepositPaid: true,
      isBalancePaid: false,
      contactEmail: "jordan@example.com",
      contactPhone: "(812) 555-0142",
      accessToken: "000000000000000000000000000000000000000000000000",
      shareToken: "111111111111111111111111111111111111111111111111",
      checkinsSent: [90],
      unreadMessages: 2,
      contractAcceptedAt: "2026-08-05T15:00:00.000Z",
      customTerms: null,
      artTheme: null,
      notes: "Golden hour garden party. Motown for cocktails.",
      createdAt: "2026-08-01T12:00:00.000Z",
    },
    {
      id: "2",
      archivedAt: null,
      coupleNames: "Sam Ellis & Riley Cooper",
      eventDate: "2026-10-03",
      venueName: "Backyard in Seymour",
      status: "inquiry",
      addons: [],
      totalAmount: "1000.00",
      isDepositPaid: false,
      isBalancePaid: false,
      contactEmail: "sam.ellis@example.com",
      contactPhone: null,
      accessToken: "000000000000000000000000000000000000000000000002",
      shareToken: null,
      checkinsSent: [],
      unreadMessages: 0,
      contractAcceptedAt: null,
      customTerms: null,
      artTheme: null,
      notes: null,
      createdAt: "2026-08-20T12:00:00.000Z",
    },
  ],
  past: [
    {
      id: "3",
      archivedAt: null,
      coupleNames: "Alex Reed & Casey Brooks",
      eventDate: "2026-05-30",
      venueName: "Mill Race Park",
      status: "completed",
      addons: [{ type: "acoustic_set", fee: 400 }],
      totalAmount: "1400.00",
      isDepositPaid: true,
      isBalancePaid: true,
      contactEmail: null,
      contactPhone: null,
      accessToken: "000000000000000000000000000000000000000000000003",
      shareToken: null,
      checkinsSent: [90, 30, 14],
      unreadMessages: 0,
      contractAcceptedAt: "2026-02-01T15:00:00.000Z",
      customTerms: null,
      artTheme: null,
      notes: null,
      createdAt: "2026-01-15T12:00:00.000Z",
    },
  ],
  leads: [
    {
      id: 41,
      name: "Morgan Avery",
      email: "morgan@example.com",
      eventDate: "2027-09-18",
      venue: "TBD, Bloomington",
      source: "site_form",
      createdAt: "2026-08-25T12:00:00.000Z",
    },
  ],
};

export default function AdminPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Dashboard data={SAMPLE} basePath="/admin/preview" />;
}
