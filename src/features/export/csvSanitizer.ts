/**
 * Nano Route — CSV Sanitizer & Formula Injection Protection
 * File: src/features/export/csvSanitizer.ts
 *
 * Implements Step 70 CSV serialization with mandatory defense against
 * spreadsheet formula injection (CSV Injection / CWE-1236).
 */

const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Sanitizes a single cell value for CSV output.
 * If the value starts with a formula trigger (=, +, -, @, \t, \r),
 * it is prefixed with a single quote (') to prevent spreadsheet execution.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // Formula injection mitigation: prefix risky leading characters with a single quote
  if (str.length > 0 && FORMULA_TRIGGERS.some((trigger) => str.startsWith(trigger))) {
    str = `'${str}`;
  }

  // If the cell contains quotes, commas, newlines, or begins/ends with whitespace, escape and wrap in quotes
  const needsQuotes =
    str.includes('"') ||
    str.includes(",") ||
    str.includes("\n") ||
    str.includes("\r") ||
    str.startsWith(" ") ||
    str.endsWith(" ");

  if (needsQuotes) {
    // Double-up existing quotes according to RFC 4180
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Formats an array of objects into a sanitized RFC 4180 compliant CSV string.
 */
export function formatRecordsToCsv<T extends Record<string, unknown>>(
  headers: Array<{ key: keyof T; label: string }>,
  records: T[]
): string {
  if (!records || records.length === 0) {
    return headers.map((h) => sanitizeCsvCell(h.label)).join(",") + "\r\n";
  }

  const headerLine = headers.map((h) => sanitizeCsvCell(h.label)).join(",");
  const dataLines = records.map((record) => {
    return headers
      .map((h) => {
        const val = record[h.key];
        return sanitizeCsvCell(val);
      })
      .join(",");
  });

  return [headerLine, ...dataLines].join("\r\n") + "\r\n";
}

