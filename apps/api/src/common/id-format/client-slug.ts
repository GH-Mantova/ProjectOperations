/**
 * Shared helpers for the canonical tender / job ID formats (pilot G5):
 *
 *   Tender: T{YYMMDD}-{SLUG}-Rev{N}    e.g. T260612-ACME-Rev1
 *   Job:    J{YYMMDD}-{SLUG}-{NNN}     e.g. J260612-ACME-017
 *
 * SLUG is a 4-letter uppercase slug derived from the primary client's
 * company name, snapshotted at creation (immutable afterwards).
 */

/**
 * Derives a 4-letter uppercase slug from a client company name.
 * Strips non-alphanumeric characters, takes the first 4, uppercases.
 *
 *   "Acme Infrastructure" -> "ACME"
 *   "QLD Roads Authority" -> "QLDR"
 *   "3D Construction"     -> "3DCO"
 *   "Bob"                 -> "BOB"   (shorter than 4 is OK — no padding)
 */
export function clientSlug(companyName: string): string {
  const cleaned = (companyName ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 4).toUpperCase();
}

/** Slug used when a tender has no linked client at creation time. */
export const FALLBACK_SLUG = "XXXX";

/**
 * Formats a date as YYMMDD in the Australia/Brisbane local timezone
 * (UTC+10 year-round, no DST — matches the company's operational TZ).
 */
export function brisbaneYYMMDD(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}
