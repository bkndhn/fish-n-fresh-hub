/** Escape a value for safe interpolation into HTML text or attribute context. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns a copy where every string (at any depth) is HTML-escaped. Numbers/booleans are untouched. */
export function escapeDeep<T>(input: T): T {
  if (typeof input === "string") return escapeHtml(input) as unknown as T;
  if (Array.isArray(input)) return input.map((v) => escapeDeep(v)) as unknown as T;
  if (input && typeof input === "object" && !(input instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) out[k] = escapeDeep(v);
    return out as T;
  }
  return input;
}
