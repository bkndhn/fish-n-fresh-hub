/**
 * Spreadsheet-safe CSV cell encoding.
 *
 * Neutralises formula injection: a cell beginning with = + - @ or a control
 * character is executed as a formula by Excel / Google Sheets / LibreOffice
 * when the exported file is opened. Prefixing with an apostrophe forces the
 * spreadsheet to treat the value as literal text.
 */
export function csvCell(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Same protection, but only quotes when the value needs it. */
export function csvCellCompact(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);
  if (!str) return "";
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
