import { Injectable, Logger } from "@nestjs/common";
import { IntegrationKeysService } from "../../common/integrations/integration-keys.service";

// Server-side proxy over the Geoapify Address Autocomplete API. The Geoapify
// key is read from IntegrationCredential storage via IntegrationKeysService and
// is NEVER shipped to the browser — every autocomplete/geocode call has to
// originate from the API layer. When no key is configured we return a
// non-error payload so the caller can render a "not configured" hint instead
// of a 500.
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

const AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";
const AUTOCOMPLETE_TIMEOUT_MS = 3_500;

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly integrationKeys: IntegrationKeysService) {}

  async autocomplete(text: string): Promise<GeoAutocompleteResult> {
    const query = (text ?? "").trim();
    if (query.length < 3) return { configured: true, results: [] };

    const apiKey = await this.integrationKeys.resolveIntegrationKey("geoapify");
    if (!apiKey) {
      return {
        configured: false,
        results: [],
        reason: "Geoapify API key is not configured. An admin can set it in Admin → Settings → Integrations."
      };
    }

    const url = new URL(AUTOCOMPLETE_URL);
    url.searchParams.set("text", query);
    url.searchParams.set("filter", "countrycode:au");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "6");
    url.searchParams.set("apiKey", apiKey);

    try {
      const res = await this.timedFetch(url.toString(), AUTOCOMPLETE_TIMEOUT_MS);
      if (!res.ok) {
        this.logger.warn(`Geoapify autocomplete returned ${res.status}`);
        return { configured: true, results: [], reason: `Address lookup failed (${res.status}).` };
      }
      const body = (await res.json()) as { results?: RawGeoapifyResult[] };
      const results = Array.isArray(body?.results) ? body.results.map(trimSuggestion) : [];
      return { configured: true, results };
    } catch (err) {
      this.logger.warn(`Geoapify autocomplete request failed: ${(err as Error).message}`);
      return { configured: true, results: [], reason: "Address lookup service unavailable." };
    }
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
