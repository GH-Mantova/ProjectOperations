import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOCOMPLETE_TIMEOUT_MS,
  GeoapifySuggestion,
  GeocodingAdapter
} from "../geocoding-adapter";

// Geoapify autocomplete adapter. Extracted 1:1 out of the previous
// geocoding.service.ts implementation so a single-provider (Geoapify-only)
// chain returns the exact same suggestion payload the browser rendered
// pre-chain — same URL, same query params, same 3.5 s timeout, same
// RawGeoapifyResult -> GeoapifySuggestion mapping.

const AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";

type RawGeoapifyResult = {
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  suburb?: string;
  state?: string;
  state_code?: string;
  postcode?: string;
  country_code?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
};

@Injectable()
export class GeoapifyAdapter implements GeocodingAdapter {
  readonly key = "geoapify";
  private readonly logger = new Logger(GeoapifyAdapter.name);

  async autocomplete(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(AUTOCOMPLETE_URL);
    url.searchParams.set("text", text);
    url.searchParams.set("filter", "countrycode:au");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "6");
    url.searchParams.set("apiKey", apiKey);

    const res = await this.timedFetch(url.toString(), AUTOCOMPLETE_TIMEOUT_MS);
    if (!res.ok) {
      // Bubble non-2xx up as an error so the chain treats it as a fall-through
      // signal (same class as timeout / network error).
      this.logger.warn(`Geoapify autocomplete returned ${res.status}`);
      throw new Error(`geoapify_http_${res.status}`);
    }
    const body = (await res.json()) as { results?: RawGeoapifyResult[] };
    return Array.isArray(body?.results) ? body.results.map(trimSuggestion) : [];
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

function trimSuggestion(raw: RawGeoapifyResult): GeoapifySuggestion {
  // Geoapify sometimes reports the locality as `city`, `suburb`, or `county`
  // depending on the address density. Prefer suburb → city → county so an AU
  // street address always resolves to a usable locality.
  const suburb = raw.suburb ?? raw.city ?? raw.county ?? null;
  return {
    formatted: raw.formatted ?? "",
    addressLine1: raw.address_line1 ?? null,
    addressLine2: raw.address_line2 ?? null,
    suburb,
    state: raw.state_code ?? raw.state ?? null,
    postcode: raw.postcode ?? null,
    countryCode: raw.country_code ?? null,
    lat: typeof raw.lat === "number" ? raw.lat : null,
    lon: typeof raw.lon === "number" ? raw.lon : null,
    placeId: raw.place_id ?? null
  };
}
