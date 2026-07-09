import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Site weather widget backend — thin proxy over the free, no-key
 * Open-Meteo forecast API.
 *
 * Why a server-side proxy at all: the browser must never make third-party
 * calls directly (auth cookies leak, CORS friction, no shared cache). This
 * service also caches results in-process for `CACHE_TTL_MS` — the free
 * Open-Meteo tier is rate-limited and a dashboard is a page users refresh a
 * lot. If the upstream fails we return a { unavailable: true } payload
 * (never throw) so the widget can render "weather unavailable" without
 * bringing down the dashboard.
 *
 * Base URL is read from WEATHER_API_URL (default: Open-Meteo public
 * endpoint) so ops can point at a mock in tests or switch providers later.
 */
type CacheEntry = { at: number; body: WeatherResponse };

export type WeatherCurrent = {
  temperatureC: number;
  windKph: number | null;
  weatherCode: number | null;
  observedAt: string;
};

export type WeatherDay = {
  date: string;
  temperatureMaxC: number | null;
  temperatureMinC: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
};

export type WeatherResponse =
  | {
      unavailable: false;
      site: { id: string; name: string; postcode: string | null; suburb: string | null; state: string | null };
      current: WeatherCurrent | null;
      forecast: WeatherDay[];
      cachedAt: string;
      source: string;
    }
  | {
      unavailable: true;
      site: { id: string; name: string; postcode: string | null; suburb: string | null; state: string | null };
      reason: string;
    };

const CACHE_TTL_MS = 30 * 60_000; // 30 minutes — Open-Meteo is free but rate-limited
const GEOCODE_TIMEOUT_MS = 3_500;
const FORECAST_TIMEOUT_MS = 3_500;

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  /** Base URL for the Open-Meteo (or compatible) forecast API. */
  private forecastBaseUrl(): string {
    return this.config.get<string>("WEATHER_API_URL", "https://api.open-meteo.com/v1/forecast");
  }

  private geocodeBaseUrl(): string {
    return this.config.get<string>(
      "WEATHER_GEOCODE_URL",
      "https://geocoding-api.open-meteo.com/v1/search"
    );
  }

  /** Load a site by id and return an "unavailable" payload if the site cannot
   *  be resolved to a location the weather API understands. Otherwise fetches
   *  and returns the current + 5-day outlook. */
  async getSiteWeather(siteId: string): Promise<WeatherResponse> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true, suburb: true, state: true, postcode: true }
    });
    if (!site) throw new NotFoundException(`Site ${siteId} not found`);

    const siteSummary = {
      id: site.id,
      name: site.name,
      postcode: site.postcode ?? null,
      suburb: site.suburb ?? null,
      state: site.state ?? null
    };

    if (!site.postcode && !site.suburb) {
      return { unavailable: true, site: siteSummary, reason: "Site has no address details" };
    }

    const cacheKey = site.id;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.body;
    }

    try {
      const geocoded = await this.geocode(site.postcode, site.suburb, site.state);
      if (!geocoded) {
        const body: WeatherResponse = {
          unavailable: true,
          site: siteSummary,
          reason: "Could not resolve site location"
        };
        this.cache.set(cacheKey, { at: Date.now(), body });
        return body;
      }
      const forecast = await this.fetchForecast(geocoded.latitude, geocoded.longitude);
      const body: WeatherResponse = {
        unavailable: false,
        site: siteSummary,
        current: forecast.current,
        forecast: forecast.forecast,
        cachedAt: new Date().toISOString(),
        source: "open-meteo"
      };
      this.cache.set(cacheKey, { at: Date.now(), body });
      return body;
    } catch (err) {
      this.logger.warn(`Weather fetch failed for site ${site.id}: ${(err as Error).message}`);
      return { unavailable: true, site: siteSummary, reason: "Weather service unavailable" };
    }
  }

  private async geocode(
    postcode: string | null,
    suburb: string | null,
    state: string | null
  ): Promise<{ latitude: number; longitude: number } | null> {
    // Prefer the postcode (unambiguous in AU) but fall back to suburb/state
    // if the site record is missing one. Open-Meteo's free geocoding
    // endpoint returns the best match ordered by relevance.
    const query = postcode ?? [suburb, state].filter(Boolean).join(" ");
    if (!query) return null;
    const url = new URL(this.geocodeBaseUrl());
    url.searchParams.set("name", query);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const res = await this.timedFetch(url.toString(), GEOCODE_TIMEOUT_MS);
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data: unknown = await res.json();
    const results = (data as { results?: Array<{ latitude: number; longitude: number }> })?.results;
    if (!results?.length) return null;
    return { latitude: results[0].latitude, longitude: results[0].longitude };
  }

  private async fetchForecast(
    latitude: number,
    longitude: number
  ): Promise<{ current: WeatherCurrent | null; forecast: WeatherDay[] }> {
    const url = new URL(this.forecastBaseUrl());
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,wind_speed_10m,weather_code"
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code"
    );
    url.searchParams.set("forecast_days", "5");
    url.searchParams.set("timezone", "auto");
    const res = await this.timedFetch(url.toString(), FORECAST_TIMEOUT_MS);
    if (!res.ok) throw new Error(`forecast ${res.status}`);
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        wind_speed_10m?: number;
        weather_code?: number;
        time?: string;
      };
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
        weather_code?: number[];
      };
    };

    const current: WeatherCurrent | null = data.current
      ? {
          temperatureC: Number(data.current.temperature_2m ?? 0),
          windKph: numOrNull(data.current.wind_speed_10m),
          weatherCode: numOrNull(data.current.weather_code),
          observedAt: data.current.time ?? new Date().toISOString()
        }
      : null;

    const forecast: WeatherDay[] = [];
    const times = data.daily?.time ?? [];
    for (let i = 0; i < times.length; i += 1) {
      forecast.push({
        date: times[i],
        temperatureMaxC: numOrNull(data.daily?.temperature_2m_max?.[i]),
        temperatureMinC: numOrNull(data.daily?.temperature_2m_min?.[i]),
        precipitationMm: numOrNull(data.daily?.precipitation_sum?.[i]),
        weatherCode: numOrNull(data.daily?.weather_code?.[i])
      });
    }
    return { current, forecast };
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

function numOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
