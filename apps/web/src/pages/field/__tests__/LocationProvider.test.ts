// GPS-A3 — contract tests for the LocationProvider seam.
//
// These tests verify that:
//  1. setLocationProvider() / getLocationProvider() form a working swap seam.
//  2. captureGpsReading() delegates to whatever provider is active.
//  3. BrowserLocationProvider.supportsBackground is false.
//
// No real geolocation calls are made — a mock provider is injected.

import { afterEach, describe, expect, it } from "vitest";
import {
  BrowserLocationProvider,
  getLocationProvider,
  setLocationProvider
} from "../location/LocationProvider";
import type { LocationProvider } from "../location/LocationProvider";
import { captureGpsReading } from "../useAutoGps";

// Reset to the default browser provider after every test so the singleton
// does not leak between test cases.
afterEach(() => {
  setLocationProvider(BrowserLocationProvider);
});

describe("LocationProvider — seam wiring", () => {
  it("getLocationProvider() returns BrowserLocationProvider by default", () => {
    expect(getLocationProvider()).toBe(BrowserLocationProvider);
  });

  it("setLocationProvider() replaces the active provider", () => {
    const mock: LocationProvider = {
      supportsBackground: false,
      getCurrentReading: async () => ({ ok: false, reason: "unsupported" })
    };
    setLocationProvider(mock);
    expect(getLocationProvider()).toBe(mock);
  });

  it("captureGpsReading() returns the mock provider's reading", async () => {
    const mockReading = { lat: -27.47, lng: 153.02, accuracy: 5 };
    const mock: LocationProvider = {
      supportsBackground: false,
      getCurrentReading: async () => ({ ok: true, reading: mockReading })
    };
    setLocationProvider(mock);

    const result = await captureGpsReading();
    expect(result).toEqual({ ok: true, reading: mockReading });
  });

  it("captureGpsReading() surfaces a typed failure from the mock provider", async () => {
    const mock: LocationProvider = {
      supportsBackground: false,
      getCurrentReading: async () => ({ ok: false, reason: "denied" })
    };
    setLocationProvider(mock);

    const result = await captureGpsReading();
    expect(result).toEqual({ ok: false, reason: "denied" });
  });
});

describe("BrowserLocationProvider — capabilities", () => {
  it("supportsBackground is false", () => {
    expect(BrowserLocationProvider.supportsBackground).toBe(false);
  });
});
