import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOCOMPLETE_TIMEOUT_MS,
  GeoapifySuggestion,
  GeocodingAdapter
} from "../geocoding-adapter";

// Nominatim (OSM) geocoding adapter.
//
// Autocomplete → /search  (no dedicated autocomplete endpoint; we use /search
//                           with `limit=6` as the closest equivalent)
// Forward      → /search
// Reverse      → /reverse
//
// Auth: NONE (public API). A valid User-Agent is REQUIRED by the Nominatim
// usage policy; requests without one are rejected. We hard-code our app UA
// so every instance sends it automatically.
//
// Rate limit: 1 request/second, enforced in-adapter via a serialising promise
// queue. Retry-After header on 429 is honoured by waiting the specified
// duration before continuing.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "ProjectOperations/1.0 (marco@initialservices.net)";

// ---------- raw response shapes ----------

type NominatimAddress = {
  house_number?: string;
  road?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  "ISO3166-2-lvl4"?: string; // e.g. "AU-QLD"
  state?: string;
  postcode?: string;
  country_code?: string;
};

type NominatimResult = {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
};

// ---------- helpers ----------

function mapResult(raw: NominatimResult): GeoapifySuggestion {
  const addr = raw.address ?? {};
  const hn = addr.house_number ?? "";
  const road = addr.road ?? "";
  const addressLine1 = [hn, road].filter(Boolean).join(" ") || null;
  const suburb = addr.suburb ?? addr.city ?? addr.town ?? addr.village ?? addr.county ?? null;

  // ISO3166-2-lvl4 gives "AU-QLD" → we want "QLD"
  const isoState = addr["ISO3166-2-lvl4"];
  const stateCode = isoState ? isoState.replace(/^[A-Z]+-/, "") : null;
  const state = stateCode ?? addr.state ?? null;

  const latNum = typeof raw.lat === "string" ? parseFloat(raw.lat) : null;
  const lonNum = typeof raw.lon === "string" ? parseFloat(raw.lon) : null;

  return {
    formatted: raw.display_name ?? "",
    addressLine1,
    addressLine2: null,
    suburb,
    state,
    postcode: addr.postcode ?? null,
    countryCode: addr.country_code?.toLowerCase() ?? null,
    lat: latNum !== null && !isNaN(latNum) ? latNum : null,
    lon: lonNum !== null && !isNaN(lonNum) ? lonNum : null,
    placeId: raw.place_id !== undefined ? String(raw.place_id) : null
  };
}

// ---------- 1 rps rate gate ----------
// Serialises all outbound Nominatim requests through a FIFO promise chain so
// at most one leaves per second. Persistent per-instance (injected as
// singleton by NestJS). If the server replies 429 with a Retry-After header
// we wait that many seconds before the next slot opens.

const MIN_INTERVAL_MS = 1_000;

// ---------- adapter ----------

@Injectable()
export class NominatimAdapter implements GeocodingAdapter {
  readonly key = "nominatim";
  private readonly logger = new Logger(NominatimAdapter.name);

  // The tail of the serialising promise chain. Every new request appends to
  // this chain so calls are queued and executed one per second.
  private lastRequest: Promise<void> = Promise.resolve();

  async autocomplete(text: string, _apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set("q", text);
    url.searchParams.set("countrycodes", "au");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");

    return this.queuedFetch(url.toString(), "autocomplete");
  }

  async forward(text: string, _apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set("q", text);
    url.searchParams.set("countrycodes", "au");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");

    return this.queuedFetch(url.toString(), "forward");
  }

  async reverse(lat: number, lon: number, _apiKey: string): Promise<GeoapifySuggestion[]> {
    const url = new URL(`${NOMINATIM_BASE}/reverse`);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("countrycodes", "au");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");

    // /reverse returns a single object, not an array — wrap it.
    return this.queuedFetch(url.toString(), "reverse", true);
  }

  // -----------------------------------------------------------------------
  // Rate-gate implementation: append this request to the promise chain so
  // it only fires after the previous one has completed AND at least
  // MIN_INTERVAL_MS has elapsed since it started.
  // -----------------------------------------------------------------------
  private queuedFetch(
    urlStr: string,
    op: string,
    isSingleResult = false
  ): Promise<GeoapifySuggestion[]> {
    const resultPromise = new Promise<GeoapifySuggestion[]>((resolve, reject) => {
      // Capture lastRequest at the moment of enqueueing.
      const prev = this.lastRequest;

      // The new tail: wait for prev, then run, ensuring at least 1 s gap.
      const current = prev.then(async () => {
        const start = Date.now();
        try {
          const results = await this.doFetch(urlStr, op, isSingleResult);
          resolve(results);
        } catch (err) {
          reject(err);
        }
        // Always wait out the remainder of the 1 s slot before releasing
        // the chain for the next request.
        const elapsed = Date.now() - start;
        const remaining = MIN_INTERVAL_MS - elapsed;
        if (remaining > 0) {
          await new Promise<void>((res) => setTimeout(res, remaining));
        }
      });

      this.lastRequest = current;
    });

    return resultPromise;
  }

  private async doFetch(
    urlStr: string,
    op: string,
    isSingleResult: boolean
  ): Promise<GeoapifySuggestion[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTOCOMPLETE_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(urlStr, {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT }
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : 1;
      const waitMs = Math.max(retryAfterSec * 1_000, MIN_INTERVAL_MS);
      this.logger.warn(`Nominatim 429 — Retry-After ${retryAfterSec}s`);
      await new Promise<void>((res) => setTimeout(res, waitMs));
      throw new Error("nominatim_http_429");
    }

    if (!res.ok) {
      this.logger.warn(`Nominatim ${op} HTTP ${res.status}`);
      throw new Error(`nominatim_http_${res.status}`);
    }

    const body = await res.json();

    if (isSingleResult) {
      // /reverse returns a single object (or an error object)
      if (body && typeof body === "object" && !Array.isArray(body) && body.display_name) {
        return [mapResult(body as NominatimResult)];
      }
      return [];
    }

    return Array.isArray(body) ? (body as NominatimResult[]).map(mapResult) : [];
  }
}
