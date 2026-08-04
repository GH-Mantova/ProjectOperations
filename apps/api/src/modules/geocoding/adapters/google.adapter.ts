import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOCOMPLETE_TIMEOUT_MS,
  GeoapifySuggestion,
  GeocodingAdapter
} from "../geocoding-adapter";

// Google Maps Platform geocoding adapter.
//
// Autocomplete  → Places Autocomplete API (sessiontoken-free, legacy)
// Forward       → Geocoding API  /maps/api/geocode/json?address=&components=country:AU&region=au
// Reverse       → Geocoding API  /maps/api/geocode/json?latlng=&result_type=street_address&region=au
//
// Auth: `key` query param.  AU bias: `components=country:AU` / `region=au`.
// All three ops share the same 3 500 ms timeout and map into GeoapifySuggestion
// (text fields only — compliance §6).

const PLACES_AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// ---------- raw response shapes ----------

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: {
    location?: { lat?: number; lng?: number };
  };
  place_id?: string;
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: GoogleGeocodeResult[];
};

type GoogleAutocompletePrediction = {
  description?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  place_id?: string;
};

type GoogleAutocompleteResponse = {
  status?: string;
  predictions?: GoogleAutocompletePrediction[];
};

// ---------- helpers ----------

function componentOf(
  components: GoogleAddressComponent[],
  ...types: string[]
): string | null {
  for (const type of types) {
    const found = components.find((c) => c.types.includes(type));
    if (found) return found.long_name;
  }
  return null;
}

function componentShortOf(
  components: GoogleAddressComponent[],
  ...types: string[]
): string | null {
  for (const type of types) {
    const found = components.find((c) => c.types.includes(type));
    if (found) return found.short_name;
  }
  return null;
}

function mapGeocodeResult(raw: GoogleGeocodeResult): GeoapifySuggestion {
  const comps = raw.address_components ?? [];
  const streetNumber = componentOf(comps, "street_number") ?? "";
  const route = componentOf(comps, "route") ?? "";
  const addressLine1 = [streetNumber, route].filter(Boolean).join(" ") || null;
  const suburb = componentOf(comps, "locality", "sublocality", "postal_town") ?? null;
  const state = componentShortOf(comps, "administrative_area_level_1") ?? null;
  const postcode = componentOf(comps, "postal_code") ?? null;
  const countryCode = componentShortOf(comps, "country") ?? null;

  return {
    formatted: raw.formatted_address ?? "",
    addressLine1,
    addressLine2: null,
    suburb,
    state,
    postcode,
    countryCode: countryCode?.toLowerCase() ?? null,
    lat: raw.geometry?.location?.lat ?? null,
    lon: raw.geometry?.location?.lng ?? null,
    placeId: raw.place_id ?? null
  };
}

function mapAutocompletePrediction(raw: GoogleAutocompletePrediction): GeoapifySuggestion {
  // Autocomplete does not return coordinates — they would require a Place Details
  // call (additional billing hit). We return text-only fields.
  const description = raw.description ?? "";
  const mainText = raw.structured_formatting?.main_text ?? description;
  const secondaryText = raw.structured_formatting?.secondary_text ?? null;

  return {
    formatted: description,
    addressLine1: mainText,
    addressLine2: secondaryText,
    suburb: null,
    state: null,
    postcode: null,
    countryCode: "au",
    lat: null,
    lon: null,
    placeId: raw.place_id ?? null
  };
}

// ---------- adapter ----------

@Injectable()
export class GoogleAdapter implements GeocodingAdapter {
  readonly key = "google";
  private readonly logger = new Logger(GoogleAdapter.name);

  async autocomplete(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(PLACES_AUTOCOMPLETE_URL);
    url.searchParams.set("input", text);
    url.searchParams.set("components", "country:AU");
    url.searchParams.set("language", "en-AU");
    url.searchParams.set("key", apiKey);

    const res = await this.timedFetch(url.toString(), AUTOCOMPLETE_TIMEOUT_MS);
    if (!res.ok) {
      this.logger.warn(`Google autocomplete HTTP ${res.status}`);
      throw new Error(`google_http_${res.status}`);
    }
    const body = (await res.json()) as GoogleAutocompleteResponse;
    if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
      throw new Error(`google_status_${body.status}`);
    }
    return Array.isArray(body.predictions)
      ? body.predictions.map(mapAutocompletePrediction)
      : [];
  }

  async forward(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set("address", text);
    url.searchParams.set("components", "country:AU");
    url.searchParams.set("region", "au");
    url.searchParams.set("key", apiKey);

    const res = await this.timedFetch(url.toString(), AUTOCOMPLETE_TIMEOUT_MS);
    if (!res.ok) {
      this.logger.warn(`Google forward HTTP ${res.status}`);
      throw new Error(`google_http_${res.status}`);
    }
    const body = (await res.json()) as GoogleGeocodeResponse;
    if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
      throw new Error(`google_status_${body.status}`);
    }
    return Array.isArray(body.results) ? body.results.map(mapGeocodeResult) : [];
  }

  async reverse(lat: number, lon: number, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set("latlng", `${lat},${lon}`);
    url.searchParams.set("result_type", "street_address");
    url.searchParams.set("region", "au");
    url.searchParams.set("key", apiKey);

    const res = await this.timedFetch(url.toString(), AUTOCOMPLETE_TIMEOUT_MS);
    if (!res.ok) {
      this.logger.warn(`Google reverse HTTP ${res.status}`);
      throw new Error(`google_http_${res.status}`);
    }
    const body = (await res.json()) as GoogleGeocodeResponse;
    if (body.status && body.status !== "OK" && body.status !== "ZERO_RESULTS") {
      throw new Error(`google_status_${body.status}`);
    }
    return Array.isArray(body.results) ? body.results.map(mapGeocodeResult) : [];
  }

  private async timedFetch(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
