import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOCOMPLETE_TIMEOUT_MS,
  GeoapifySuggestion,
  GeocodingAdapter
} from "../geocoding-adapter";
import {
  HostResolver,
  assertSafeUrl,
  defaultHostResolver
} from "./ssrf-guard";

// Custom REST geocoding adapter (plan §4g).
//
// A single configurable adapter so an operator can point the failover chain at
// a bespoke geocoding endpoint via the vault's ApiCredential.config JSON,
// WITHOUT a code change. SSRF-hardened: scheme allow-list, DNS-rebind defence
// at request time, redirects disabled by default, permission gate enforced at
// save-time by the vault layer (defence in depth).
//
// Compliance §6: only text fields are extracted from the provider response.
// lat / lon / place_id are discarded at normalisation so they never reach the
// site-resolver DB writer.

interface FieldMap {
  formatted?: string;
  addressLine1?: string;
  addressLine2?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  countryCode?: string;
}

export interface ResponseShape {
  // Dot-path to the results array in the JSON body. e.g. "features" or
  // "data.rows". Empty / omitted = the body itself is the array.
  resultsPath?: string;
  // Per-field dot-path relative to a single result row.
  fields?: FieldMap;
}

export interface CustomRestConfig {
  baseUrl?: string;
  autocompletePath?: string;
  forwardPath?: string;
  reversePath?: string;
  headerName?: string;
  headerPrefix?: string;
  followRedirects?: boolean;
  queryParam?: string;
  latParam?: string;
  lonParam?: string;
  responseShape?: ResponseShape;
}

const MAX_REDIRECTS = 3;

@Injectable()
export class CustomRestAdapter implements GeocodingAdapter {
  readonly key = "custom-rest";
  private readonly logger = new Logger(CustomRestAdapter.name);

  // Overridable so unit tests can stub DNS without hitting the network.
  private resolver: HostResolver = defaultHostResolver;

  // Test-only seam. Production code never calls this.
  setHostResolverForTests(fn: HostResolver): void {
    this.resolver = fn;
  }

  async autocomplete(
    text: string,
    apiKey: string,
    rawConfig?: unknown
  ): Promise<GeoapifySuggestion[]> {
    const config = parseConfig(rawConfig);
    const url = await this.buildUrl(config, config.autocompletePath ?? "");
    url.searchParams.set(config.queryParam ?? "q", text);
    return this.dispatch(url, apiKey, config, "autocomplete");
  }

  async forward(
    text: string,
    apiKey: string,
    rawConfig?: unknown
  ): Promise<GeoapifySuggestion[]> {
    const config = parseConfig(rawConfig);
    const url = await this.buildUrl(config, config.forwardPath ?? "");
    url.searchParams.set(config.queryParam ?? "q", text);
    return this.dispatch(url, apiKey, config, "forward");
  }

  async reverse(
    lat: number,
    lon: number,
    apiKey: string,
    rawConfig?: unknown
  ): Promise<GeoapifySuggestion[]> {
    const config = parseConfig(rawConfig);
    const url = await this.buildUrl(config, config.reversePath ?? "");
    url.searchParams.set(config.latParam ?? "lat", String(lat));
    url.searchParams.set(config.lonParam ?? "lon", String(lon));
    return this.dispatch(url, apiKey, config, "reverse");
  }

  private async buildUrl(config: CustomRestConfig, path: string): Promise<URL> {
    if (!config.baseUrl) throw new Error("custom_rest_missing_base_url");
    const base = await assertSafeUrl(config.baseUrl, this.resolver);
    const trimmedPath = path.startsWith("/") ? path : `/${path}`;
    return new URL(trimmedPath, `${base.protocol}//${base.host}`);
  }

  private async dispatch(
    url: URL,
    apiKey: string,
    config: CustomRestConfig,
    op: string
  ): Promise<GeoapifySuggestion[]> {
    const headerName = config.headerName ?? "Authorization";
    const headerPrefix = config.headerPrefix ?? "Bearer ";
    const headers: Record<string, string> = {
      [headerName]: `${headerPrefix}${apiKey}`
    };

    const res = await this.timedFetchWithGuards(url, headers, config, op);
    if (!res.ok) {
      this.logger.warn(`Custom REST ${op} HTTP ${res.status}`);
      throw new Error(`custom_rest_http_${res.status}`);
    }
    const body = await res.json();
    const rows = getByPath(body, config.responseShape?.resultsPath);
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => mapRow(row, config.responseShape));
  }

  private async timedFetchWithGuards(
    initialUrl: URL,
    headers: Record<string, string>,
    config: CustomRestConfig,
    op: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AUTOCOMPLETE_TIMEOUT_MS);
    try {
      // NB: initialUrl was just checked by buildUrl(); a fresh DNS lookup runs
      // on every request, so DNS-rebind defence is already in force. Only the
      // redirect target below needs an additional guard.
      let currentUrl = initialUrl;
      const allowRedirects = config.followRedirects === true;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const res = await fetch(currentUrl.toString(), {
          signal: controller.signal,
          headers,
          redirect: "manual"
        });
        // Non-redirect status: hand back to the caller.
        if (res.status < 300 || res.status >= 400) return res;
        if (!allowRedirects) {
          this.logger.warn(`Custom REST ${op} refused redirect ${res.status}`);
          throw new Error(`custom_rest_redirect_${res.status}`);
        }
        const loc = res.headers.get("Location");
        if (!loc) return res;
        const nextUrl = new URL(loc, currentUrl);
        // Re-run the FULL guard on the redirect target: scheme + IP allow-check.
        await assertSafeUrl(nextUrl.toString(), this.resolver);
        currentUrl = nextUrl;
      }
      throw new Error("custom_rest_too_many_redirects");
    } finally {
      clearTimeout(timer);
    }
  }
}

function parseConfig(raw: unknown): CustomRestConfig {
  if (!raw || typeof raw !== "object") return {};
  return raw as CustomRestConfig;
}

function getByPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return obj;
  const parts = path.split(".").filter((p) => p.length > 0);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function mapRow(row: unknown, shape: ResponseShape | undefined): GeoapifySuggestion {
  const fields = shape?.fields ?? {};
  return {
    formatted: asString(getByPath(row, fields.formatted)) ?? "",
    addressLine1: asString(getByPath(row, fields.addressLine1)),
    addressLine2: asString(getByPath(row, fields.addressLine2)),
    suburb: asString(getByPath(row, fields.suburb)),
    state: asString(getByPath(row, fields.state)),
    postcode: asString(getByPath(row, fields.postcode)),
    countryCode: asString(getByPath(row, fields.countryCode)),
    // Compliance §6: provider lat/lon/place_id are discarded at normalisation.
    lat: null,
    lon: null,
    placeId: null
  };
}
