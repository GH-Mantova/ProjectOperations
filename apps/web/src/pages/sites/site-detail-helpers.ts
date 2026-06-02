export type SiteAddressParts = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
};

/**
 * Joins the populated address parts with comma separators. Returns the
 * em-dash placeholder when every part is empty so callers can render a
 * single consistent token instead of branching on null/empty everywhere.
 */
export function formatSiteAddress(parts: SiteAddressParts | null | undefined): string {
  if (!parts) return "—";
  const tokens = [parts.addressLine1, parts.addressLine2, parts.suburb, parts.state, parts.postcode]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);
  return tokens.length === 0 ? "—" : tokens.join(", ");
}

/**
 * Maps the freeform tender status string the API returns to one of the
 * five `s7-badge--*` modifiers. Unknown statuses fall back to neutral.
 */
export function tenderStatusBadgeClass(status: string | null | undefined): string {
  const normalised = (status ?? "").toUpperCase();
  switch (normalised) {
    case "AWARDED":
    case "CONTRACT_ISSUED":
      return "s7-badge s7-badge--active";
    case "IN_PROGRESS":
      return "s7-badge s7-badge--info";
    case "SUBMITTED":
      return "s7-badge s7-badge--warning";
    case "LOST":
      return "s7-badge s7-badge--danger";
    case "DRAFT":
    case "WITHDRAWN":
      return "s7-badge s7-badge--neutral";
    default:
      return "s7-badge s7-badge--neutral";
  }
}

/**
 * Maps the Prisma `ProjectStatus` enum values to one of the five
 * `s7-badge--*` modifiers. Unknown statuses fall back to neutral.
 */
export function projectStatusBadgeClass(status: string | null | undefined): string {
  const normalised = (status ?? "").toUpperCase();
  switch (normalised) {
    case "ACTIVE":
    case "PRACTICAL_COMPLETION":
      return "s7-badge s7-badge--active";
    case "MOBILISING":
      return "s7-badge s7-badge--info";
    case "DEFECTS":
      return "s7-badge s7-badge--warning";
    case "CLOSED":
      return "s7-badge s7-badge--neutral";
    default:
      return "s7-badge s7-badge--neutral";
  }
}

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

/**
 * Format an ISO date as `dd Mon yyyy`. Built from parts manually so the
 * output is identical across Chrome and Node ICU builds — `toLocaleDateString`
 * with `month: "short"` ships "Jun" in browsers but "June" on some Node
 * runtimes. Returns the em-dash placeholder for null/empty input and the
 * original string when parsing fails so list cells always render a single
 * token. Time is stripped before parsing to keep date-only inputs timezone-
 * agnostic.
 */
export function formatSiteDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const trimmed = iso.trim();
  if (!trimmed) return "—";
  const dateOnly = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = MONTH_ABBREVIATIONS[parsed.getMonth()];
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}
