"use client";

import { useState } from "react";

/**
 * The receipt for one money-out bank line: a link once there is one, and an
 * upload either way (a second upload replaces the first; the old one is kept).
 * Proof only: attaching a receipt posts nothing.
 */
export default function ReceiptControl({ lineId, claimId: initial }: { lineId: string; claimId: string | null }) {
  const [claimId, setClaimId] = useState(initial);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setError("Over 4 MB.");
      setStatus("error");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("bankTransactionId", lineId);
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/app/expenses/receipt", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { error?: string; claimId?: string };
      if (!res.ok || !json.claimId) {
        setError(json.error ?? "That didn't upload.");
        setStatus("error");
        return;
      }
      setClaimId(json.claimId);
      setStatus("idle");
    } catch {
      setError("That didn't upload.");
      setStatus("error");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs">
      {claimId && (
        <a href={`/api/app/expenses/${claimId}/receipt`} target="_blank" rel="noopener" className="font-semibold text-terracotta underline decoration-parchment underline-offset-2">
          Receipt
        </a>
      )}
      <label className="cursor-pointer rounded-full border border-parchment px-3 py-1 font-semibold text-ink/70 hover:border-terracotta hover:text-terracotta-dark">
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        {status === "sending" ? "Uploading..." : claimId ? "Replace receipt" : "Add receipt"}
      </label>
      {status === "error" && <span className="font-semibold text-terracotta-dark">{error}</span>}
    </span>
  );
}
