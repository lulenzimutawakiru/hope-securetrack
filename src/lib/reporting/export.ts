/**
 * Report export engine — CSV / JSON / XML serializers.
 *
 * Every export is built from already company-scoped rows produced by the
 * report engine, so the audit trail (bi_report_runs) already captured the
 * data accessed. Escaping is handled per format to keep exports safe and
 * spreadsheet-compatible.
 */

export type ExportFormat = "csv" | "json" | "xml";

export type ExportResult = {
  format: ExportFormat;
  mimeType: string;
  extension: string;
  content: string;
  dataUrl: string;
  rowCount: number;
};

function safeString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function csvCell(value: unknown): string {
  const s = safeString(value);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r") ||
    /^\s|\s$/.test(s)
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function xmlEscape(value: unknown): string {
  return safeString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Serialize rows to CSV with a header row derived from the column list. */
export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: string[]
): string {
  const cols = columns.length
    ? columns
    : rows.length
      ? Object.keys(rows[0])
      : [];
  const header = cols.map((c) => csvCell(c)).join(",");
  const body = rows
    .map((row) => cols.map((c) => csvCell(row[c])).join(","))
    .join("\r\n");
  return cols.length ? `${header}\r\n${body}` : "";
}

/** Serialize rows to a JSON envelope. */
export function toJson(
  rows: Array<Record<string, unknown>>,
  meta: { reportCode?: string | null; generatedAt?: Date }
): string {
  return JSON.stringify(
    {
      report_code: meta.reportCode || null,
      generated_at: (meta.generatedAt || new Date()).toISOString(),
      row_count: rows.length,
      rows,
    },
    null,
    2
  );
}

/** Serialize rows to a generic XML document. */
export function toXml(
  rows: Array<Record<string, unknown>>,
  meta: { reportCode?: string | null; generatedAt?: Date }
): string {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const body = rows
    .map(
      (row) =>
        `  <row>${cols
          .map(
            (c) =>
              `<col name="${xmlEscape(c)}">${xmlEscape(row[c])}</col>`
          )
          .join("")}</row>`
    )
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<report code="${xmlEscape(meta.reportCode || "")}" generated_at="${xmlEscape(
      (meta.generatedAt || new Date()).toISOString()
    )}" row_count="${rows.length}">`,
    body,
    "</report>",
  ].join("\n");
}

const FORMAT_META: Record<
  ExportFormat,
  { mimeType: string; extension: string }
> = {
  csv: { mimeType: "text/csv", extension: "csv" },
  json: { mimeType: "application/json", extension: "json" },
  xml: { mimeType: "application/xml", extension: "xml" },
};

/**
 * Build an export payload for a run result. `format` falls back to csv for
 * unknown values. The returned dataUrl can be stored or returned to clients.
 */
export function buildExport(opts: {
  format: string;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  reportCode?: string | null;
  generatedAt?: Date;
}): ExportResult {
  const format: ExportFormat =
    opts.format === "json" || opts.format === "xml" ? opts.format : "csv";
  const generatedAt = opts.generatedAt || new Date();
  const content =
    format === "json"
      ? toJson(opts.rows, { reportCode: opts.reportCode, generatedAt })
      : format === "xml"
        ? toXml(opts.rows, { reportCode: opts.reportCode, generatedAt })
        : toCsv(opts.rows, opts.columns);
  const meta = FORMAT_META[format];
  return {
    format,
    mimeType: meta.mimeType,
    extension: meta.extension,
    content,
    dataUrl: `data:${meta.mimeType};charset=utf-8,${encodeURIComponent(content)}`,
    rowCount: opts.rows.length,
  };
}