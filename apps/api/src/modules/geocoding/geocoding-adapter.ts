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
}

// The end-to-end timeout every autocomplete adapter is expected to honour.
// Matches the value the Geoapify service used pre-chain so behaviour is
// byte-identical for a single-provider setup.
export const AUTOCOMPLETE_TIMEOUT_MS = 3_500;
