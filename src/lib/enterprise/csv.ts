/**
 * Enterprise CSV import/export helpers — shared across domain CRUD modules.
 */

export type CsvParseResult = {
  headers: string[];
  rows: Array<Record<string, string>>;
  errors: string[];
};

/** Parse RFC4180-ish CSV text into row objects */
export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    return { headers: [], rows: [], errors: ["Empty CSV"] };
  }

  const lines = splitCsvLines(cleaned);
  if (lines.length < 2) {
    return { headers: [], rows: [], errors: ["CSV must include a header row and at least one data row"] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  if (headers.some((h) => !h)) {
    errors.push("Empty header column detected");
  }

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length !== headers.length) {
      errors.push(`Row ${i + 1}: expected ${headers.length} columns, got ${cols.length}`);
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows, errors };
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length) lines.push(current);
  return lines;
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cols.push(current);
  return cols;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: string[]
): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, content: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportFieldMap = {
  /** CSV header → entity field key */
  columns: Record<string, string>;
  /** Required entity field keys */
  required?: string[];
  /** Coerce number fields */
  numberFields?: string[];
  /** Defaults applied to every row */
  defaults?: Record<string, unknown>;
  /** Max rows per import batch */
  maxRows?: number;
};

export type ImportValidation = {
  valid: Array<Record<string, unknown>>;
  invalid: Array<{ row: number; errors: string[]; data: Record<string, string> }>;
};

/** Map and validate CSV rows against a field map */
export function validateImportRows(
  rows: Array<Record<string, string>>,
  map: ImportFieldMap
): ImportValidation {
  const max = map.maxRows ?? 5000;
  const valid: Array<Record<string, unknown>> = [];
  const invalid: ImportValidation["invalid"] = [];

  rows.slice(0, max).forEach((raw, idx) => {
    const errors: string[] = [];
    const out: Record<string, unknown> = { ...(map.defaults || {}) };

    for (const [csvCol, field] of Object.entries(map.columns)) {
      const val = raw[csvCol] ?? raw[field] ?? "";
      if (map.numberFields?.includes(field)) {
        if (val === "" || val == null) {
          out[field] = null;
        } else {
          const n = Number(String(val).replace(/,/g, ""));
          if (Number.isNaN(n)) errors.push(`${field} is not a number`);
          else out[field] = n;
        }
      } else {
        out[field] = val === "" ? null : val;
      }
    }

    for (const req of map.required || []) {
      const v = out[req];
      if (v === null || v === undefined || String(v).trim() === "") {
        errors.push(`${req} is required`);
      }
    }

    if (errors.length) invalid.push({ row: idx + 2, errors, data: raw });
    else valid.push(out);
  });

  if (rows.length > max) {
    invalid.push({
      row: max + 2,
      errors: [`Import capped at ${max} rows; ${rows.length - max} skipped`],
      data: {},
    });
  }

  return { valid, invalid };
}
