import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOCOMPLETE_TIMEOUT_MS,
  GeoapifySuggestion,
  GeocodingAdapter
} from "../geocoding-adapter";

// Geocodify geocoding adapter.
//
// Autocomplete → https://app.geocodify.com/api/autocomplete  (?api_key=&q=)
// Forward      → https://app.geocodify.com/api/geocode        (?api_key=&q=)
// Reverse      → https://app.geocodify.com/api/reverse        (?api_key=&lat=&lng=)
//
// Auth: `api_key` query param.  3 500 ms timeout.
// All three ops normalise provider responses into GeoapifySuggestion (text
// fields only — compliance §6).

const AUTOCOMPLETE_URL = "https://app.geocodify.com/api/autocomplete";
const GEOCODE_URL = "https://app.geocodify.com/api/geocode";
const REVERSE_URL = "https://app.geocodify.com/api/reverse";

// ---------- raw response shapes ----------

type GeocodifyProperties = {
  label?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  suburb?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country_code?: string;
};

type GeocodifyFeature = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: [number, number]; // [lon, lat]
  };
  properties?: GeocodifyProperties;
};

type GeocodifyResponse = {
  response?: {
    features?: GeocodifyFeature[];
  };
};

// ---------- helpers ----------

function mapFeature(f: GeocodifyFeature): GeoapifySuggestion {
  const props = f.properties ?? {};
  const hn = props.housenumber ?? "";
  const street = props.street ?? "";
  const addressLine1 = [hn, street].filter(Boolean).join(" ") || null;
  const suburb = props.suburb ?? props.city ?? props.county ?? null;
  const coords = f.geometry?.coordinates;
  const lon = typeof coords?.[0] === "number" ? coords[0] : null;
  const lat = typeof coords?.[1] === "number" ? coords[1] : null;

  return {
    formatted: props.label ?? "",
    addressLine1,
    addressLine2: null,
    suburb,
    state: props.state ?? null,
    postcode: props.postcode ?? null,
    countryCode: props.country_code?.toLowerCase() ?? null,
    lat,
    lon,
    placeId: null
  };
}

// ---------- adapter ----------

@Injectable()
export class GeocodifyAdapter implements GeocodingAdapter {
  readonly key = "geocodify";
  private readonly logger = new Logger(GeocodifyAdapter.name);

  async autocomplete(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(AUTOCOMPLETE_URL);
    url.searchParams.set("q", text);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("countrycodes", "au");

    return this.fetchFeatures(url.toString(), "autocomplete");
  }

  async forward(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set("q", text);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("countrycodes", "au");

    return this.fetchFeatures(url.toString(), "forward");
  }

  async reverse(lat: number, lon: number, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(REVERSE_URL);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lng", String(lon));
    url.searchParams.set("api_key", apiKey);

    return this.fetchFeatures(url.toString(), "reverse");
  }

  private async fetchFeatures(
    urlStr: string,
    op: string
  ): Promise<GeoapifySuggestion[]> {
    const res = await this.timedFetch(urlStr, AUTOCOMPLETE_TIMEOUT_MS);
    if (!res.ok) {
      this.logger.warn(`Geocodify ${op} HTTP ${res.status}`);
      throw new Error(`geocodify_http_${res.status}`);
    }
    const body = (await res.json()) as GeocodifyResponse;
    const features = body?.response?.features;
    return Array.isArray(features) ? features.map(mapFeature) : [];
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
