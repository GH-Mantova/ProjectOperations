import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOCOMPLETE_TIMEOUT_MS,
  GeoapifySuggestion,
  GeocodingAdapter
} from "../geocoding-adapter";

// Geocodify geocoding adapter.
//
// Autocomplete → https://api.geocodify.com/v2/autocomplete  (?api_key=&q=)
// Forward      → https://api.geocodify.com/v2/geocode        (?api_key=&q=)
// Reverse      → https://api.geocodify.com/v2/reverse        (?api_key=&lat=&lng=)
//
// Auth: `api_key` query param.  3 500 ms timeout.
// All three ops normalise provider responses into GeoapifySuggestion (text
// fields only — compliance §6).

const AUTOCOMPLETE_URL = "https://api.geocodify.com/v2/autocomplete";
const GEOCODE_URL = "https://api.geocodify.com/v2/geocode";
const REVERSE_URL = "https://api.geocodify.com/v2/reverse";

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

type GeocodifyMeta = {
  code?: number;
  error_type?: string;
  error_detail?: string;
};

type GeocodifyResponse = {
  meta?: GeocodifyMeta;
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

    return this.fetchFeatures(url.toString(), "autocomplete");
  }

  async forward(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set("q", text);
    url.searchParams.set("api_key", apiKey);

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
    const metaCode = body?.meta?.code;
    if (typeof metaCode === "number" && metaCode !== 200) {
      this.logger.warn(
        `Geocodify ${op} meta ${metaCode} ${body.meta?.error_type ?? ""}`.trim()
      );
      throw new Error(`geocodify_meta_${metaCode}`);
    }
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
