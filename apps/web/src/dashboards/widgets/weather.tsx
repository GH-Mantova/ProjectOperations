import { Skeleton } from "@project-ops/ui";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/AuthContext";
import type { WidgetProps } from "../types";
import { EmptyNote, PanelCard } from "./shared";
import {
  forecastDayLabel,
  resolveWeatherSiteId,
  tempC,
  weatherGlyph,
  weatherLabel,
  type WeatherResponse
} from "./weather.helpers";

function useSiteWeather(siteId: string | null) {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "site-weather", siteId],
    enabled: siteId !== null,
    queryFn: async () => {
      const res = await authFetch(`/dashboards/weather/site/${encodeURIComponent(siteId!)}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as WeatherResponse;
    },
    // Backend already caches for 30 min; keep the client cache in step so
    // switching dashboards doesn't refetch immediately.
    staleTime: 30 * 60_000,
    retry: false
  });
}

export function SiteWeatherWidget({ config }: WidgetProps) {
  const siteId = resolveWeatherSiteId(config.filters);
  const { data, isLoading, error } = useSiteWeather(siteId);

  if (!siteId) {
    return (
      <PanelCard title="Site weather">
        <EmptyNote>
          Pick a site from the widget settings to see current conditions and the 5-day outlook.
        </EmptyNote>
      </PanelCard>
    );
  }
  if (isLoading) {
    return (
      <PanelCard title="Site weather">
        <Skeleton width="100%" height={140} />
      </PanelCard>
    );
  }
  if (error) {
    return (
      <PanelCard title="Site weather">
        <EmptyNote>Weather unavailable right now — retry in a few minutes.</EmptyNote>
      </PanelCard>
    );
  }
  if (!data) return null;
  if (data.unavailable) {
    return (
      <PanelCard title={`Site weather — ${data.site.name}`}>
        <EmptyNote>Weather unavailable: {data.reason}.</EmptyNote>
      </PanelCard>
    );
  }

  const { current, forecast, site } = data;
  const currentLabel = current ? weatherLabel(current.weatherCode) : "—";
  const currentGlyph = current ? weatherGlyph(current.weatherCode) : "•";

  return (
    <PanelCard title={`Site weather — ${site.name}`}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 160 }}>
          <span aria-hidden style={{ fontSize: 42, lineHeight: 1 }}>
            {currentGlyph}
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ fontSize: 24, lineHeight: 1.1 }}>
              {current ? tempC(current.temperatureC) : "—"}
            </strong>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{currentLabel}</span>
            {current?.windKph !== null && current?.windKph !== undefined ? (
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Wind {Math.round(current.windKph)} km/h
              </span>
            ) : null}
          </div>
        </div>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            gap: 10,
            flex: 1,
            minWidth: 240,
            overflowX: "auto"
          }}
        >
          {forecast.map((day) => (
            <li
              key={day.date}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "6px 8px",
                border: "1px solid var(--border-default, #E5E7EB)",
                borderRadius: 6,
                minWidth: 56
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{forecastDayLabel(day.date)}</span>
              <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
                {weatherGlyph(day.weatherCode)}
              </span>
              <span style={{ fontSize: 12 }}>
                <strong>{tempC(day.temperatureMaxC)}</strong>
                <span style={{ color: "var(--text-muted)" }}> / {tempC(day.temperatureMinC)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
        Source: Open-Meteo. Cached 30 min. Localised to site postcode.
      </p>
    </PanelCard>
  );
}
