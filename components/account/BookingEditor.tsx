"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BOOKING_STATUSES, EVENT_TYPES } from "@/lib/tenant-constants";

const field =
  "w-full rounded-lg border border-parchment bg-cream/40 px-3 py-2 text-base font-normal text-ink focus:border-terracotta focus:outline-none";
const label = "grid gap-1 text-sm font-semibold text-charcoal";

export type BookingFormValues = {
  clientNames: string;
  eventType: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  contactEmail: string;
  contactPhone: string;
  totalUsd: string;
  depositUsd: string;
  isDepositPaid: boolean;
  isBalancePaid: boolean;
  status: string;
  notes: string;
};

/**
 * One form for both creating and editing a booking. Create posts to
 * /api/app/bookings and opens the new booking; edit PATCHes it in place.
 */
export default function BookingEditor({ bookingId, initial }: { bookingId?: string; initial?: BookingFormValues }) {
  const router = useRouter();
  const editing = Boolean(bookingId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const payload: Record<string, unknown> = {
      clientNames: get("clientNames"),
      eventType: get("eventType"),
      eventDate: get("eventDate"),
      venueName: get("venueName"),
      venueAddress: get("venueAddress"),
      contactEmail: get("contactEmail"),
      contactPhone: get("contactPhone"),
      totalUsd: Number(get("totalUsd") || 0),
      depositUsd: Number(get("depositUsd") || 0),
    };
    if (editing) {
      payload.isDepositPaid = f.get("isDepositPaid") === "on";
      payload.isBalancePaid = f.get("isBalancePaid") === "on";
      payload.status = get("status");
    } else {
      payload.depositReceived = f.get("isDepositPaid") === "on";
      payload.notes = get("notes");
    }
    try {
      const res = await fetch(editing ? `/api/app/bookings/${bookingId}` : "/api/app/bookings", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Couldn't save. Try again in a minute.");
        return;
      }
      if (editing) {
        setSaved(true);
        router.refresh();
      } else if (json.id) {
        router.push(`/app/bookings/${json.id}`);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const v = initial;
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-parchment bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Client
          <input name="clientNames" required maxLength={255} defaultValue={v?.clientNames} placeholder="Jordan & Taylor" className={field} />
        </label>
        <label className={label}>
          Event type
          <select name="eventType" defaultValue={v?.eventType ?? "wedding"} className={field}>
            {EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Date
          <input name="eventDate" type="date" required defaultValue={v?.eventDate} className={field} />
        </label>
        <label className={label}>
          Venue
          <input name="venueName" required maxLength={255} defaultValue={v?.venueName} className={field} />
        </label>
      </div>
      <label className={label}>
        Venue address <span className="font-normal text-ink/55">(optional)</span>
        <input name="venueAddress" maxLength={500} defaultValue={v?.venueAddress} className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Client email <span className="font-normal text-ink/55">(optional)</span>
          <input name="contactEmail" type="email" maxLength={255} defaultValue={v?.contactEmail} className={field} />
        </label>
        <label className={label}>
          Client phone <span className="font-normal text-ink/55">(optional)</span>
          <input name="contactPhone" type="tel" maxLength={50} defaultValue={v?.contactPhone} className={field} />
        </label>
        <label className={label}>
          Total ($)
          <input name="totalUsd" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={v?.totalUsd ?? ""} className={field} />
        </label>
        <label className={label}>
          Deposit ($)
          <input name="depositUsd" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={v?.depositUsd ?? ""} className={field} />
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-charcoal">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isDepositPaid" defaultChecked={v?.isDepositPaid} /> Deposit received
        </label>
        {editing && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isBalancePaid" defaultChecked={v?.isBalancePaid} /> Balance paid
          </label>
        )}
      </div>
      {editing ? (
        <label className={label}>
          Status
          <select name="status" defaultValue={v?.status} className={field}>
            {BOOKING_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className={label}>
          Notes <span className="font-normal text-ink/55">(optional, your client sees these in their hub)</span>
          <textarea name="notes" rows={3} maxLength={4000} className={field} />
        </label>
      )}
      {error && (
        <p className="text-sm font-semibold text-terracotta-dark" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm font-semibold text-charcoal" role="status">
          Saved.
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : editing ? "Save changes" : "Add booking"}
      </button>
    </form>
  );
}
