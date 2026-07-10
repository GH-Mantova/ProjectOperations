/**
 * Weather widget — pure helpers.
 *
 * All non-React logic (WMO code -> label/icon mapping, response shape, config
 * derivation) lives here so it can be unit-tested cheaply and the JSX file
 * stays render-only.
 */

export type WeatherSiteSummary = {
  id: string;
  name: string;
  postcode: string | null;
  suburb: string | null;
  state: string | null;
};

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
      site: WeatherSiteSummary;
      current: WeatherCurrent | null;
      forecast: WeatherDay[];
      cachedAt: string;
      source: string;
    }
  | { unavailable: true; site: WeatherSiteSummary; reason: string };

/** WMO weather code -> short human label. Grouped per Open-Meteo's public
 *  code table. Everything unknown resolves to "Weather". */
export function weatherLabel(code: number | null): string {
  if (code === null || code === undefined) return "Weather";
  if (code === 0) return "Clear";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Weather";
}

/** Short glyph for the label — icons kept ASCII so no icon font is required. */
export function weatherGlyph(code: number | null): string {
  const label = weatherLabel(code);
  switch (label) {
    case "Clear":
      return "☀";
    case "Partly cloudy":
      return "⛅";
    case "Overcast":
      return "☁";
    case "Fog":
      return "🌫";
    case "Drizzle":
    case "Rain":
    case "Showers":
      return "🌧";
    case "Snow":
    case "Snow showers":
      return "❄";
    case "Thunderstorm":
      return "⛈";
    default:
      return "•";
  }
}

/** Format a YYYY-MM-DD forecast date as the localized short weekday. */
export function forecastDayLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { weekday: "short" });
}

/** Resolve the widget's selected site id from its filters. Empty / missing
 *  values return null so the widget can prompt the user to pick one. */
export function resolveWeatherSiteId(filters: Record<string, unknown> | undefined): string | null {
  if (!filters) return null;
  const value = filters.siteId;
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

/** Format a temperature as a whole °C — the widget only shows integer
 *  precision to avoid noisy display in tight tiles. */
export function tempC(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}°`;
}
