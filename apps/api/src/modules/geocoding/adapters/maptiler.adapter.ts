import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOCOMPLETE_TIMEOUT_MS,
  GeoapifySuggestion,
  GeocodingAdapter
} from "../geocoding-adapter";

// MapTiler geocoding adapter.
//
// Autocomplete → https://api.maptiler.com/geocoding/{query}.json?key=&country=au
// Forward      → same endpoint (MapTiler uses one endpoint for both autocomplete +
//                forward geocode; we reuse it with the same params)
// Reverse      → https://api.maptiler.com/geocoding/{lon},{lat}.json?key=&country=au
//
// Auth: `key` query param.  AU bias: `country=au`.  3 500 ms timeout.
// Normalises into GeoapifySuggestion (text fields only — compliance §6).

const GEOCODING_BASE = "https://api.maptiler.com/geocoding";

// ---------- raw response shapes ----------

type MapTilerContext = {
  id?: string;
  text?: string;
};

type MapTilerFeature = {
  id?: string;
  type?: string;
  place_name?: string;
  text?: string;
  place_type?: string[];
  geometry?: {
    type?: string;
    coordinates?: [number, number]; // [lon, lat]
  };
  // context holds parent locality, region, postcode, country items
  context?: MapTilerContext[];
  properties?: {
    ref?: string;
    short_code?: string;
  };
};

type MapTilerResponse = {
  type?: string;
  features?: MapTilerFeature[];
};

// ---------- helpers ----------

function contextValue(context: MapTilerContext[], prefix: string): string | null {
  const item = context.find((c) => c.id?.startsWith(prefix));
  return item?.text ?? null;
}

function mapFeature(f: MapTilerFeature): GeoapifySuggestion {
  const context = f.context ?? [];
  const coords = f.geometry?.coordinates;
  const lon = typeof coords?.[0] === "number" ? coords[0] : null;
  const lat = typeof coords?.[1] === "number" ? coords[1] : null;

  // MapTiler context IDs: "place.", "region.", "postcode.", "country."
  const suburb = contextValue(context, "place.") ?? contextValue(context, "locality.");
  const state = contextValue(context, "region.");
  const postcode = contextValue(context, "postcode.");
  const countryCode = contextValue(context, "country.");

  // For the address line, `text` is the house+street part; for higher-order
  // place types it is the place name itself. We use `text` as addressLine1.
  const addressLine1 = f.text ?? null;

  return {
    formatted: f.place_name ?? "",
    addressLine1,
    addressLine2: null,
    suburb,
    state,
    postcode,
    countryCode: countryCode?.toLowerCase() ?? null,
    lat,
    lon,
    placeId: f.id ?? null
  };
}

// ---------- adapter ----------

@Injectable()
export class MapTilerAdapter implements GeocodingAdapter {
  readonly key = "maptiler";
  private readonly logger = new Logger(MapTilerAdapter.name);

  async autocomplete(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    return this.geocode(encodeURIComponent(text), apiKey, "autocomplete");
  }

  async forward(text: string, apiKey: string): Promise<GeoapifySuggestion[]> {
    return this.geocode(encodeURIComponent(text), apiKey, "forward");
  }

  async reverse(lat: number, lon: number, apiKey: string): Promise<GeoapifySuggestion[]> {
    // MapTiler reverse: /geocoding/{lon},{lat}.json
    return this.geocode(`${lon},${lat}`, apiKey, "reverse");
  }

  private async geocode(
    query: string,
    apiKey: string,
    op: string
  ): Promise<GeoapifySuggestion[]> {
    const url = new URL(`${GEOCODING_BASE}/${query}.json`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("country", "au");
    url.searchParams.set("limit", "6");
    url.searchParams.set("language", "en");

    const res = await this.timedFetch(url.toString(), AUTOCOMPLETE_TIMEOUT_MS);
    if (!res.ok) {
      this.logger.warn(`MapTiler ${op} HTTP ${res.status}`);
      throw new Error(`maptiler_http_${res.status}`);
    }
    const body = (await res.json()) as MapTilerResponse;
    return Array.isArray(body?.features) ? body.features.map(mapFeature) : [];
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
