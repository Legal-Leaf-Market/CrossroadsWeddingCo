export const JOURNAL_COLUMNS = ["entry_id", "date", "account_code", "debit", "credit", "memo"] as const;
export const JOURNAL_MAX_BYTES = 1_000_000;
const MAX_ROWS = 5_000;
const MAX_ISSUES = 50;

type Issue = { row: number; message: string };
type Group = { row: number; date: string; lines: number; debit: bigint; credit: bigint };

function csvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let state: "field" | "quoted" | "closed" = "field";

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (state === "quoted") {
      if (char === '"' && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        state = "closed";
      } else {
        field += char;
      }
      continue;
    }

    if (char === "," || char === "\n" || char === "\r") {
      row.push(field.trim());
      field = "";
      state = "field";
      if (char !== ",") {
        if (char === "\r" && raw[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (rows.length > MAX_ROWS + 1) throw new Error("Use at most 5,000 journal lines per file.");
      }
      continue;
    }

    if (state === "closed" || (char === '"' && field)) {
      throw new Error(`Unexpected quote syntax near CSV record ${rows.length + 1}.`);
    }
    if (char === '"') state = "quoted";
    else field += char;
  }

  if (state === "quoted") throw new Error("A quoted CSV field is missing its closing quote.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > MAX_ROWS + 1) throw new Error("Use at most 5,000 journal lines per file.");
  return rows;
}

function validDate(value: string): boolean {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function cents(value: string): bigint | null {
  if (!value) return BigInt(0);
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function preflightJournal(csv: string, accountCodes: readonly string[]) {
  const issues: Issue[] = [];
  let issueCount = 0;
  let lineCount = 0;
  let debit = BigInt(0);
  let credit = BigInt(0);
  const groups = new Map<string, Group>();
  const codes = new Set(accountCodes);

  function fail(row: number, message: string) {
    issueCount++;
    if (issues.length < MAX_ISSUES) issues.push({ row, message });
  }

  try {
    if (new TextEncoder().encode(csv).length > JOURNAL_MAX_BYTES) {
      throw new Error("Use a CSV file no larger than 1 MB.");
    }
    const [header, ...data] = csvRows(csv.replace(/^\uFEFF/, ""));
    if (header?.length !== JOURNAL_COLUMNS.length || JOURNAL_COLUMNS.some((name, i) => header[i] !== name)) {
      throw new Error(`Use this header: ${JOURNAL_COLUMNS.join(",")}.`);
    }
    if (!data.length) throw new Error("Add at least one journal entry.");
    lineCount = data.length;
    for (const [index, row] of data.entries()) {
      const record = index + 2;
      if (row.length !== JOURNAL_COLUMNS.length) {
        fail(record, "Expected six columns.");
        continue;
      }
      const [entry, date, code, debitRaw, creditRaw] = row;
      const start = issueCount;
      if (!entry || entry.length > 100) fail(record, "Enter a source entry ID of 1–100 characters.");
      if (!validDate(date)) fail(record, "Enter a valid date as YYYY-MM-DD.");
      if (!codes.has(code)) fail(record, "Map this line to an existing account code.");
      const dr = cents(debitRaw);
      const cr = cents(creditRaw);
      if (dr === null || cr === null || (dr > BigInt(0)) === (cr > BigInt(0))) {
        fail(record, "Enter a positive amount on exactly one side, with at most two decimal places.");
        continue;
      }
      if (issueCount !== start) continue;

      const group = groups.get(entry) ?? { row: record, date, lines: 0, debit: BigInt(0), credit: BigInt(0) };
      if (date !== group.date) fail(record, "This source entry ID has more than one posting date.");
      group.lines++;
      group.debit += dr;
      group.credit += cr;
      debit += dr;
      credit += cr;
      groups.set(entry, group);
    }
    for (const group of groups.values()) {
      if (group.lines < 2 || group.debit !== group.credit) {
        fail(group.row, "This entry needs at least two lines with equal debits and credits.");
      }
    }
  } catch (error) {
    fail(0, error instanceof Error ? error.message : "This CSV could not be read.");
  }

  return { lineCount, entries: groups.size, debit, credit, issueCount, issues };
}
