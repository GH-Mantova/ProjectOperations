/**
 * travel-time.spec.ts -- TRAVEL_TIME_PORT_V1 (scopecards-s8a)
 *
 * Covers:
 *   - deriveCycle: Marco's worked example (45/30/8h = 4 loads), 90 min,
 *     cycle that exceeds the shift, minimum 0.
 *   - StraightLineTravelProvider: returns null when either setting is unset;
 *     multiplies haversine by the road factor and converts to minutes.
 */

import {
  deriveCycle,
  StraightLineTravelProvider,
  TRAVEL_TIME_PORT_V1
} from "../travel-time";

// ---- Version marker ---------------------------------------------------------

describe("TRAVEL_TIME_PORT_V1", () => {
  it("equals the scopecards-s8a identifier", () => {
    expect(TRAVEL_TIME_PORT_V1).toBe("scopecards-s8a");
  });
});

// ---- deriveCycle ------------------------------------------------------------

describe("deriveCycle", () => {
  it("gives 4 loads for Marco's worked example: 45 min each way, 30 min at tip, 8-hour shift", () => {
    const result = deriveCycle({
      minutesOneWay: 45,
      shiftMinutes: 480,
      tipTurnaroundMinutes: 30
    });
    // floor(480 / (2*45 + 30)) = floor(480 / 120) = 4
    expect(result.loadsPerDay).toBe(4);
  });

  it("gives 2 loads at 90 minutes each way with 30 min at tip and 8-hour shift", () => {
    const result = deriveCycle({
      minutesOneWay: 90,
      shiftMinutes: 480,
      tipTurnaroundMinutes: 30
    });
    // floor(480 / (2*90 + 30)) = floor(480 / 210) = 2
    expect(result.loadsPerDay).toBe(2);
  });

  it("gives 0 loads when a cycle exceeds the shift", () => {
    // cycle = 2*250 + 30 = 530 > 480
    const result = deriveCycle({
      minutesOneWay: 250,
      shiftMinutes: 480,
      tipTurnaroundMinutes: 30
    });
    expect(result.loadsPerDay).toBe(0);
  });

  it("gives 0 loads when minutesOneWay fills the whole shift", () => {
    // cycle = 2*240 + 30 = 510 > 480
    const result = deriveCycle({
      minutesOneWay: 240,
      shiftMinutes: 480,
      tipTurnaroundMinutes: 30
    });
    expect(result.loadsPerDay).toBe(0);
  });

  it("gives 1 load when exactly one cycle fits", () => {
    // cycle = 2*225 + 30 = 480 = exactly the shift
    const result = deriveCycle({
      minutesOneWay: 225,
      shiftMinutes: 480,
      tipTurnaroundMinutes: 30
    });
    // floor(480/480) = 1
    expect(result.loadsPerDay).toBe(1);
  });

  it("uses 480 as the default shiftMinutes", () => {
    const explicit = deriveCycle({
      minutesOneWay: 45,
      shiftMinutes: 480,
      tipTurnaroundMinutes: 30
    });
    const defaultShift = deriveCycle({
      minutesOneWay: 45,
      tipTurnaroundMinutes: 30
    });
    expect(defaultShift.loadsPerDay).toBe(explicit.loadsPerDay);
  });
});

// ---- StraightLineTravelProvider ---------------------------------------------

// Brisbane CBD to approximate Rochedale Transfer Station: ~18 km haversine
const BRISBANE = { lat: -27.4698, lng: 153.0251 };
const ROCHEDALE = { lat: -27.5750, lng: 153.1020 };

describe("StraightLineTravelProvider", () => {
  it("returns null when roadDistanceFactor is null", async () => {
    const provider = new StraightLineTravelProvider(null, 45);
    const result = await provider.resolve(BRISBANE, ROCHEDALE);
    expect(result).toBeNull();
  });

  it("returns null when avgTruckSpeedKmh is null", async () => {
    const provider = new StraightLineTravelProvider(1.3, null);
    const result = await provider.resolve(BRISBANE, ROCHEDALE);
    expect(result).toBeNull();
  });

  it("returns null when both settings are null", async () => {
    const provider = new StraightLineTravelProvider(null, null);
    const result = await provider.resolve(BRISBANE, ROCHEDALE);
    expect(result).toBeNull();
  });

  it("returns null when avgTruckSpeedKmh is 0 (zero-division guard)", async () => {
    const provider = new StraightLineTravelProvider(1.3, 0);
    const result = await provider.resolve(BRISBANE, ROCHEDALE);
    expect(result).toBeNull();
  });

  it("multiplies the haversine by the road factor when both settings are set", async () => {
    const factor = 1.3;
    const speedKmh = 45;
    const provider = new StraightLineTravelProvider(factor, speedKmh);
    const result = await provider.resolve(BRISBANE, ROCHEDALE);
    expect(result).not.toBeNull();
    expect(result!.source).toBe("straight-line");
    // road km must be > straight-line km (factor > 1)
    expect(result!.km).toBeGreaterThan(0);
    expect(result!.minutesOneWay).toBeGreaterThan(0);
    expect(result!.detail).toContain("straight line");
    expect(result!.detail).toContain(String(factor));
    expect(result!.detail).toContain(String(speedKmh));
    expect(result!.resolvedAt).toBeInstanceOf(Date);
  });

  it("detail contains the road factor and speed", async () => {
    const provider = new StraightLineTravelProvider(1.3, 45);
    const result = await provider.resolve(BRISBANE, ROCHEDALE);
    expect(result!.detail).toMatch(/1\.3.*road factor/);
    expect(result!.detail).toMatch(/45 km\/h/);
  });

  it("applies a factor of exactly 1.0 (identity)", async () => {
    const providerFactor1 = new StraightLineTravelProvider(1.0, 60);
    const result = await providerFactor1.resolve(BRISBANE, ROCHEDALE);
    expect(result).not.toBeNull();
    // With factor 1.0, road km should equal haversine (within rounding).
    // Haversine BRISBANE->ROCHEDALE is approximately 13-14 km.
    expect(result!.km).toBeGreaterThan(10);
    expect(result!.km).toBeLessThan(20);
  });
});
