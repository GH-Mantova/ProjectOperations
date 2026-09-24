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
  TRAVEL_TIME_PORT_V1,
  planningMinutes,
  requiredTrips,
  durationDays,
  totalTripKm
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

// ---- S8g: planningMinutes ---------------------------------------------------
// planning = average(baseline, baseline x index); index >= 1.00.
// The index is a MODELLED TRAFFIC ALLOWANCE (not measured peak traffic) and
// never multiplies kilometres -- only minutes.

describe("planningMinutes (S8g)", () => {
  it("equals baseline when index is exactly 1.00", () => {
    // average(30, 30 * 1.0) = 30
    expect(planningMinutes({ baseline: 30, index: 1.0 })).toBe(30);
  });

  it("averages baseline and adjusted at index 1.20", () => {
    // baseline 30, adjusted 36 -> average 33
    expect(planningMinutes({ baseline: 30, index: 1.2 })).toBe(33);
  });

  it("averages baseline and adjusted at index 1.50", () => {
    // baseline 40, adjusted 60 -> average 50
    expect(planningMinutes({ baseline: 40, index: 1.5 })).toBe(50);
  });

  it("rounds to the nearest integer", () => {
    // baseline 25, index 1.15 -> adjusted 28.75, average 26.875 -> 27
    expect(planningMinutes({ baseline: 25, index: 1.15 })).toBe(27);
  });
});

// ---- S8g: requiredTrips -----------------------------------------------------
// trips = ceil(quantity / capacityPerLoad). Whole trips only.
// 3.5 capacities => 4 trips; 4.5 => 5.

describe("requiredTrips (S8g)", () => {
  it("returns 4 for 3.5 capacities (Marco's rule: 3.5 rounds UP to 4)", () => {
    // 35 / 10 = 3.5 -> ceil = 4
    expect(requiredTrips({ quantity: 35, capacityPerLoad: 10 })).toBe(4);
  });

  it("returns 5 for 4.5 capacities (4.5 rounds UP to 5)", () => {
    // 45 / 10 = 4.5 -> ceil = 5
    expect(requiredTrips({ quantity: 45, capacityPerLoad: 10 })).toBe(5);
  });

  it("returns 8 for exactly 8 capacities", () => {
    expect(requiredTrips({ quantity: 80, capacityPerLoad: 10 })).toBe(8);
  });

  it("returns 1 for any quantity below one capacity", () => {
    // even 0.001 units of overflow forces a trip
    expect(requiredTrips({ quantity: 0.001, capacityPerLoad: 10 })).toBe(1);
  });

  it("returns 0 for zero quantity (nothing to haul)", () => {
    expect(requiredTrips({ quantity: 0, capacityPerLoad: 10 })).toBe(0);
  });

  it("returns 0 for zero capacity (invalid, no infinite loop)", () => {
    expect(requiredTrips({ quantity: 10, capacityPerLoad: 0 })).toBe(0);
  });
});

// ---- S8g: durationDays ------------------------------------------------------
// duration = ceil(trips / (trucks * loadsPerDay))
// loadsPerDay=0 => infeasible cycle, no division.

describe("durationDays (S8g)", () => {
  it("gives 2 days for 8 trips at 4 loads/day/truck with 1 truck", () => {
    // ceil(8 / (1 * 4)) = 2
    const result = durationDays({ trips: 8, trucks: 1, loadsPerDay: 4 });
    expect(result).toEqual({ durationDays: 2 });
  });

  it("gives 4 days for 8 trips at 2 loads/day/truck with 1 truck", () => {
    // ceil(8 / (1 * 2)) = 4
    const result = durationDays({ trips: 8, trucks: 1, loadsPerDay: 2 });
    expect(result).toEqual({ durationDays: 4 });
  });

  it("rounds partial days UP (a final part-day still counts)", () => {
    // ceil(7 / (1 * 4)) = 2 (7/4 = 1.75 -> 2)
    const result = durationDays({ trips: 7, trucks: 1, loadsPerDay: 4 });
    expect(result).toEqual({ durationDays: 2 });
  });

  it("returns infeasibleCycle when loadsPerDay is 0 (no divide, no invented rate)", () => {
    const result = durationDays({ trips: 8, trucks: 1, loadsPerDay: 0 });
    expect(result).toEqual({ infeasibleCycle: true });
  });

  it("scales down duration when trucks increase", () => {
    // ceil(8 / (2 * 4)) = 1
    const result = durationDays({ trips: 8, trucks: 2, loadsPerDay: 4 });
    expect(result).toEqual({ durationDays: 1 });
  });
});

// ---- S8g: totalTripKm -------------------------------------------------------
// total = trips * 2 * oneWayKm.
// Changing the traffic index MUST NOT change this figure.

describe("totalTripKm (S8g)", () => {
  it("gives 320 km for 8 trips at 20 km one-way (Marco's acceptance example)", () => {
    expect(totalTripKm({ trips: 8, oneWayKm: 20 })).toBe(320);
  });

  it("stays at 320 km regardless of index (index does not multiply km)", () => {
    // Same 8 trips, same 20 km one-way -> same 320 km whether loads/day was 4 or 2.
    const kmAtLoadsPerDay4 = totalTripKm({ trips: 8, oneWayKm: 20 });
    const kmAtLoadsPerDay2 = totalTripKm({ trips: 8, oneWayKm: 20 });
    expect(kmAtLoadsPerDay2).toBe(kmAtLoadsPerDay4);
  });

  it("rounds to 2 dp", () => {
    // 3 * 2 * 12.345 = 74.07
    expect(totalTripKm({ trips: 3, oneWayKm: 12.345 })).toBe(74.07);
  });

  it("returns 0 for 0 trips", () => {
    expect(totalTripKm({ trips: 0, oneWayKm: 20 })).toBe(0);
  });
});

// ---- S8g: integration -------------------------------------------------------
// Marco's acceptance chain:
//   8 trips, 20 km one-way, 4 loads/day => 2 days, 320 km.
//   Same 8 trips at 2 loads/day => 4 days, still 320 km.

describe("S8g arithmetic contract (integration)", () => {
  it("8 trips at 4 loads/day = 2 days, 320 km", () => {
    const trips = 8;
    const oneWayKm = 20;
    const dur = durationDays({ trips, trucks: 1, loadsPerDay: 4 });
    const km = totalTripKm({ trips, oneWayKm });
    expect(dur).toEqual({ durationDays: 2 });
    expect(km).toBe(320);
  });

  it("8 trips at 2 loads/day = 4 days, STILL 320 km (km unchanged by index)", () => {
    const trips = 8;
    const oneWayKm = 20;
    const dur = durationDays({ trips, trucks: 1, loadsPerDay: 2 });
    const km = totalTripKm({ trips, oneWayKm });
    expect(dur).toEqual({ durationDays: 4 });
    // The whole point of S8g: an index change moves time, not distance.
    expect(km).toBe(320);
  });

  it("quantity 3.5 capacities => 4 trips; 4.5 => 5 trips", () => {
    expect(requiredTrips({ quantity: 35, capacityPerLoad: 10 })).toBe(4);
    expect(requiredTrips({ quantity: 45, capacityPerLoad: 10 })).toBe(5);
  });

  it("infeasible cycle (planning-derived loadsPerDay=0) blocks division, does not invent a rate", () => {
    // Simulate a very long cycle: 240 min one-way + 30 min turnaround x 2 -> 510 min > 480 shift
    const planningIndex = 1.0;
    const baseline = 240;
    const plan = planningMinutes({ baseline, index: planningIndex });
    const cycle = deriveCycle({ minutesOneWay: plan, tipTurnaroundMinutes: 30 });
    expect(cycle.loadsPerDay).toBe(0);
    const dur = durationDays({ trips: 8, trucks: 1, loadsPerDay: cycle.loadsPerDay });
    expect(dur).toEqual({ infeasibleCycle: true });
  });
});
