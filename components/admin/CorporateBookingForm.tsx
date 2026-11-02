"use client";

import { useState } from "react";
import { CORPORATE_DEPOSIT_USD, CORPORATE_DJ_SOUND_USD } from "@/lib/site";

// Corporate events are booked by phone or on an intro call, never through the
// wedding booking form, so this is how one gets a booking card and an invoice.
// Defaults are the published corporate rate and deposit; change them for a
// quoted add-on, a travel surcharge or a discount.
const field =
  "mt-1 w-full rounded-lg border border-parchment bg-white px-3 py-2 text-sm text-charcoal focus:border-terracotta focus:outline-none";
const label = "block text-sm font-medium text-ink/80";

export default function CorporateBookingForm({ basePath }: { basePath: string }) {
  const demo = basePath === "/admin/preview";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setNote("");
    if (demo) {
      setBusy(false);
      setNote("Saved (preview only)");
      return;
    }
    try {
      const res = await fetch(`/api/admin/${basePath.split("/").pop()}/corporate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: s("company"),
          contactName: s("contactName"),
          email: s("email"),
          phone: s("phone"),
          eventDate: s("eventDate"),
          venueName: s("venueName"),
          venueAddress: s("venueAddress"),
          totalUsd: Number(s("total")),
          depositUsd: Number(s("deposit")),
          depositReceived: f.get("depositReceived") === "on",
          notes: s("notes"),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.reload();
        return;
      }
      setNote(json.error || "That didn't save.");
    } catch {
      setNote("No connection. Nothing saved.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-terracotta px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-dark"
      >
        Add corporate booking
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-parchment bg-white p-5">
      <h2 className="text-lg font-semibold text-charcoal">Add a corporate booking</h2>
      <p className="mt-1 text-sm text-ink/60">
        For events booked by phone or on a call. It gets a booking card and an invoice. Nothing is
        emailed to the client.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Company or client
          <input name="company" required minLength={2} maxLength={255} className={field} />
        </label>
        <label className={label}>
          Contact person
          <input name="contactName" maxLength={200} className={field} />
        </label>
        <label className={label}>
          Email (for the invoice)
          <input name="email" type="email" maxLength={255} className={field} />
        </label>
        <label className={label}>
          Phone
          <input name="phone" type="tel" maxLength={50} className={field} />
        </label>
        <label className={label}>
          Event date
          <input name="eventDate" type="date" required className={field} />
        </label>
        <label className={label}>
          Venue
          <input name="venueName" required minLength={2} maxLength={255} className={field} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Venue address
          <input name="venueAddress" maxLength={500} className={field} />
        </label>
        <label className={label}>
          Total ($)
          <input name="total" type="number" min={0} step="0.01" required defaultValue={CORPORATE_DJ_SOUND_USD} className={field} />
        </label>
        <label className={label}>
          Deposit ($)
          <input name="deposit" type="number" min={0} step="0.01" required defaultValue={CORPORATE_DEPOSIT_USD} className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink/80 sm:col-span-2">
          <input name="depositReceived" type="checkbox" className="h-4 w-4 accent-terracotta" />
          Deposit already received
        </label>
        <label className={`${label} sm:col-span-2`}>
          Notes
          <textarea name="notes" rows={3} maxLength={4000} className={field} placeholder="Headcount, start time, what they asked for" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream hover:bg-terracotta-dark disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save booking"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-ink/60 hover:text-terracotta">
          Cancel
        </button>
        {note && <span className="text-sm text-ink/70" role="status">{note}</span>}
      </div>
    </form>
  );
}
