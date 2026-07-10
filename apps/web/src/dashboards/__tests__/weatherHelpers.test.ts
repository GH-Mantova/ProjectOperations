import { describe, expect, it } from "vitest";
import {
  forecastDayLabel,
  resolveWeatherSiteId,
  tempC,
  weatherGlyph,
  weatherLabel
} from "../widgets/weather.helpers";

describe("weatherLabel", () => {
  it("maps clear-sky and cloudy WMO codes", () => {
    expect(weatherLabel(0)).toBe("Clear");
    expect(weatherLabel(1)).toBe("Partly cloudy");
    expect(weatherLabel(2)).toBe("Partly cloudy");
    expect(weatherLabel(3)).toBe("Overcast");
  });

  it("maps precipitation code ranges", () => {
    expect(weatherLabel(53)).toBe("Drizzle");
    expect(weatherLabel(63)).toBe("Rain");
    expect(weatherLabel(75)).toBe("Snow");
    expect(weatherLabel(82)).toBe("Showers");
    expect(weatherLabel(95)).toBe("Thunderstorm");
  });

  it("falls back to \"Weather\" for null/unknown codes", () => {
    expect(weatherLabel(null)).toBe("Weather");
    expect(weatherLabel(999)).toBe("Weather");
  });
});

describe("weatherGlyph", () => {
  it("returns a glyph for each label bucket", () => {
    // Just spot-check that different codes yield different glyphs.
    expect(weatherGlyph(0)).not.toBe(weatherGlyph(3));
    expect(weatherGlyph(63)).not.toBe(weatherGlyph(75));
  });

  it("returns a fallback glyph for null", () => {
    expect(weatherGlyph(null)).toBe("•");
  });
});

describe("tempC", () => {
  it("rounds and appends °", () => {
    expect(tempC(21.3)).toBe("21°");
    expect(tempC(-2.5)).toBe("-2°");
  });

  it("handles null and NaN", () => {
    expect(tempC(null)).toBe("—");
    expect(tempC(Number.NaN)).toBe("—");
  });
});

describe("forecastDayLabel", () => {
  it("returns a short weekday for a valid iso date", () => {
    const value = forecastDayLabel("2026-07-10");
    // Locale format on any modern engine produces a 3-letter weekday
    expect(value.length).toBeGreaterThan(0);
    expect(value).not.toContain("-");
  });

  it("returns the raw string on invalid input", () => {
    expect(forecastDayLabel("nonsense")).toBe("nonsense");
    expect(forecastDayLabel("")).toBe("");
  });
});

describe("resolveWeatherSiteId", () => {
  it("returns the trimmed id when present", () => {
    expect(resolveWeatherSiteId({ siteId: "abc123" })).toBe("abc123");
  });

  it("returns null when the value is missing, blank, or the wrong type", () => {
    expect(resolveWeatherSiteId(undefined)).toBeNull();
    expect(resolveWeatherSiteId({})).toBeNull();
    expect(resolveWeatherSiteId({ siteId: "" })).toBeNull();
    expect(resolveWeatherSiteId({ siteId: "   " })).toBeNull();
    expect(resolveWeatherSiteId({ siteId: 42 })).toBeNull();
  });
});
