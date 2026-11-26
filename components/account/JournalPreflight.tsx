"use client";

import { useRef, useState } from "react";
import { JOURNAL_COLUMNS, JOURNAL_MAX_BYTES, preflightJournal } from "@/lib/books/journal-preflight";

function amount(cents: bigint) {
  return `$${(cents / BigInt(100)).toLocaleString("en-US")}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}

export default function JournalPreflight({ accountCodes }: { accountCodes: string[] }) {
  const [result, setResult] = useState<ReturnType<typeof preflightJournal> | null>(null);
  const [error, setError] = useState("");
  const request = useRef(0);
  const template = `${JOURNAL_COLUMNS.join(",")}\r\n`;

  async function check(file: File | undefined) {
    const current = ++request.current;
    setError("");
    setResult(null);
    if (!file) return;
    if (file.size > JOURNAL_MAX_BYTES) {
      setError("Use a CSV file no larger than 1 MB.");
      return;
    }

    try {
      const raw = await file.text();
      if (current === request.current) setResult(preflightJournal(raw, accountCodes));
    } catch {
      if (current === request.current) setError("The browser could not read this file.");
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-parchment bg-white p-4">
      <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="journal-import-template.csv" className="font-semibold text-terracotta-dark underline">
        Download CSV template
      </a>
      <p className="mt-2 text-sm text-ink/70">
        Use the same source entry ID and date for every line in an entry. Enter debits and credits as positive dollars in separate columns.
      </p>
      <label className="mt-3 block text-sm font-semibold text-charcoal">
        Choose a mapped CSV
        <input type="file" accept=".csv,text/csv" onChange={(event) => void check(event.target.files?.[0])} className="mt-1 block max-w-full text-sm font-normal" />
      </label>
      <div className="mt-3 text-sm" aria-live="polite">
        {error && <p className="text-terracotta-dark">{error}</p>}
        {result && (
          <>
            <p className="font-semibold">
              {result.issueCount ? `${result.issueCount} issue(s) to fix` : "File passed format and balance checks"}
            </p>
            {!result.issueCount && (
              <p>{result.entries} entries · {result.lineCount} lines · {amount(result.debit)} debits · {amount(result.credit)} credits</p>
            )}
            {result.issues.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.issues.map((issue, index) => (
                  <li key={index}>{issue.row ? `Record ${issue.row}: ` : ""}{issue.message}</li>
                ))}
              </ul>
            )}
            {result.issueCount > result.issues.length && <p className="mt-2">Showing the first {result.issues.length} issues.</p>}
          </>
        )}
      </div>
    </section>
  );
}
