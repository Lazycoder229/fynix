/**
 * Escapes special HTML characters in a string to prevent XSS.
 * Handles the five characters that must be escaped in HTML content and attributes.
 */
export function escapeHTML(str: unknown): string {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
