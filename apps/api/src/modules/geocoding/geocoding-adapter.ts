// Shared types + the GeocodingAdapter interface that every provider adapter
// implements. Kept in a small dedicated file so both GeocodingChainService and
// the individual adapters can depend on it without pulling in the whole
// geocoding.service.ts module (avoids a cycle once geocoding.service delegates
// to the chain).
//
// Per plan §6 (compliance): every adapter MUST return the same trimmed
// GeoapifySuggestion shape. Provider lat/lon/place_id are transported through
// the shape but MUST NOT be persisted anywhere downstream.

export interface GeoapifySuggestion {
  formatted: string;
  addressLine1: string | null;
  addressLine2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
  placeId: string | null;
}

export interface GeoAutocompleteResult {
  configured: boolean;
  results: GeoapifySuggestion[];
  reason?: string;
}

export interface GeocodingAdapter {
  // Stable identifier matching ApiCredential.adapter / ApiKeyType hint (e.g.
  // "geoapify", "google", "geocodify", "maptiler", "nominatim"). Used by the
  // chain to look the adapter up when iterating enabled rows.
  readonly key: string;

  autocomplete(text: string, apiKey: string, config?: unknown): Promise<GeoapifySuggestion[]>;

  // Forward geocode: resolve a text address to one or more candidate positions.
  // Returns the same GeoapifySuggestion shape as autocomplete (compliance §6).
  forward(text: string, apiKey: string, config?: unknown): Promise<GeoapifySuggestion[]>;

  // Reverse geocode: resolve a lat/lon to one or more candidate addresses.
  // Returns the same GeoapifySuggestion shape as autocomplete (compliance §6).
  reverse(lat: number, lon: number, apiKey: string, config?: unknown): Promise<GeoapifySuggestion[]>;
}

// The end-to-end timeout every autocomplete/forward/reverse adapter is expected
// to honour. Matches the value the Geoapify service used pre-chain so behaviour
// is byte-identical for a single-provider setup.
export const AUTOCOMPLETE_TIMEOUT_MS = 3_500;

// Advisory cost tiers for built-in adapters (plan §4f). Used by the Admin UI
// to show a badge so the ordering is a deliberate financial choice. Enforcement
// stays a human decision — the chain never blocks a row on cost.
export type AdapterCostTier = "free" | "paid-metered" | "paid-fixed";

export const ADAPTER_COST_TIERS: Record<string, AdapterCostTier> = {
  geoapify: "paid-metered",
  google: "paid-metered",
  geocodify: "paid-metered",
  maptiler: "paid-metered",
  nominatim: "free",
  // Custom REST endpoints bill however the operator's provider bills. Advisory
  // "paid-metered" is the safe default for the Admin UI badge (plan §4f/§4g).
  "custom-rest": "paid-metered"
};
