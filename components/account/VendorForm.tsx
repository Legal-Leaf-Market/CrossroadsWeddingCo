"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { VENDOR_KINDS, VENDOR_KIND_LABEL } from "@/lib/books/vendor-logic";

const field =
  "w-full rounded-lg border border-parchment bg-cream/40 px-3 py-2 text-base font-normal text-ink focus:border-terracotta focus:outline-none";
const label = "grid gap-1 text-sm font-semibold text-charcoal";

export type VendorValues = {
  name: string;
  kind: string;
  email: string;
  phone: string;
  matchText: string;
  is1099: boolean;
  w9OnFile: boolean;
  notes: string;
};

/** Add a vendor, or edit one when `vendorId` is given. */
export default function VendorForm({ vendorId, initial }: { vendorId?: string; initial?: VendorValues }) {
  const router = useRouter();
  const editing = Boolean(vendorId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const body = {
      name: get("name"),
      kind: get("kind"),
      email: get("email"),
      phone: get("phone"),
      matchText: get("matchText"),
      is1099: f.get("is1099") === "on",
      w9OnFile: f.get("w9OnFile") === "on",
      notes: get("notes"),
    };
    const res = await fetch(editing ? `/api/app/vendors/${vendorId}` : "/api/app/vendors", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    setBusy(false);
    if (!res?.ok) {
      setError(json?.error ?? "Couldn't save. Try again.");
      return;
    }
    if (editing) {
      setSaved(true);
      router.refresh();
    } else if (json?.id) router.push(`/app/vendors/${json.id}`);
  }

  const v = initial;
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-parchment bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Name
          <input name="name" required maxLength={120} defaultValue={v?.name} placeholder="Name as you know them" className={field} />
        </label>
        <label className={label}>
          What they are
          <select name="kind" defaultValue={v?.kind ?? "contractor"} className={field}>
            {VENDOR_KINDS.map((k) => (
              <option key={k} value={k}>
                {VENDOR_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Email <span className="font-normal text-ink/55">(optional)</span>
          <input name="email" type="email" maxLength={255} defaultValue={v?.email} className={field} />
        </label>
        <label className={label}>
          Phone <span className="font-normal text-ink/55">(optional)</span>
          <input name="phone" type="tel" maxLength={50} defaultValue={v?.phone} className={field} />
        </label>
      </div>
      <label className={label}>
        How they show up on your bank statement
        <input name="matchText" maxLength={400} defaultValue={v?.matchText} placeholder="ZELLE TO MARCUS T, MARCUS TAYLOR" className={field} />
        <span className="text-xs font-normal text-ink/55">
          Words from the bank line, separated by commas. Leave blank to use the name. Payments with any of these words count
          as paid to this vendor.
        </span>
      </label>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-charcoal">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is1099" defaultChecked={v ? v.is1099 : true} /> Gets a 1099 (contractor, not a company)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="w9OnFile" defaultChecked={v?.w9OnFile} /> W-9 on file
        </label>
      </div>
      <label className={label}>
        Notes <span className="font-normal text-ink/55">(optional)</span>
        <textarea name="notes" rows={2} maxLength={4000} defaultValue={v?.notes} className={field} />
      </label>
      <p className="text-xs text-ink/55">
        Keep the W-9 itself somewhere safe. This app records only that you have it, never a Social Security or tax id number.
      </p>
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
        {busy ? "Saving..." : editing ? "Save changes" : "Add vendor"}
      </button>
    </form>
  );
}
