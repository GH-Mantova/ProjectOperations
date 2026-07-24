/**
 * Canonical Tendering display-label keys, defaults, and the API-backed cache.
 *
 * The keys and defaults are the source of truth for both the settings page
 * and any consumer that renders a Tendering label. The API mirrors this
 * record in apps/api/src/modules/tendering/tender-labels.defaults.ts — keep
 * them in sync.
 *
 * Labels are display text ONLY: renaming a label never changes a DB key,
 * enum value, route, or permission code. Overrides are org-wide and stored
 * on the server (table `tendering_labels`); the browser only holds a
 * process-lifetime cache seeded from GET /tenders/labels.
 */
export const defaultTenderingLabels = {
  // Tender register / detail — field labels
  "field.tenderNumber": "Tender number",
  "field.title": "Title",
  "field.description": "Description",
  "field.status": "Status",
  "field.probability": "Probability",
  "field.estimatedValue": "Estimated value",
  "field.dueDate": "Due date",
  "field.proposedStart": "Proposed start",
  "field.leadTimeDays": "Lead time (days)",
  "field.estimator": "Estimator",
  "field.linkedClients": "Linked clients",
  "field.contact": "Contact",
  "field.site": "Site",

  // Tender detail — tab labels
  "tab.scope": "Scope",
  "tab.quote": "Quote",
  "tab.rates": "Rates",
  "tab.history": "History",

  // Tender status display names — DB values stay unchanged.
  "status.DRAFT": "Draft",
  "status.SUBMITTED": "Submitted",
  "status.AWARDED": "Awarded",
  "status.CONTRACT_ISSUED": "Contract issued",
  "status.CONVERTED": "Converted",
  "status.LOST": "Lost"
} as const;

export type TenderingLabelKey = keyof typeof defaultTenderingLabels;
export type TenderingLabelMap = Record<TenderingLabelKey, string>;

let cache: TenderingLabelMap = { ...defaultTenderingLabels };

/** Return the current in-memory merged label map. Callers that need fresh
 *  data from the server should await {@link fetchTenderingLabels} first. */
export function readTenderingLabels(): TenderingLabelMap {
  return cache;
}

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

function mergeIntoCache(remote: Partial<TenderingLabelMap>): TenderingLabelMap {
  cache = { ...defaultTenderingLabels, ...remote };
  return cache;
}

/** Fetch the org-wide label map from the API and refresh the local cache. */
export async function fetchTenderingLabels(authFetch: AuthFetch): Promise<TenderingLabelMap> {
  const res = await authFetch("/tenders/labels");
  if (!res.ok) throw new Error(`Failed to load tendering labels (${res.status})`);
  const body = (await res.json()) as Partial<TenderingLabelMap>;
  return mergeIntoCache(body);
}

/** Send one or more overrides (null / blank label = revert to default) and
 *  refresh the local cache with the server's merged response. */
export async function saveTenderingLabels(
  authFetch: AuthFetch,
  overrides: Array<{ key: TenderingLabelKey; label: string | null }>
): Promise<TenderingLabelMap> {
  const res = await authFetch("/tenders/labels", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides })
  });
  if (!res.ok) throw new Error(`Failed to save tendering labels (${res.status})`);
  const body = (await res.json()) as Partial<TenderingLabelMap>;
  return mergeIntoCache(body);
}
