// Cost-tier map unit test (plan §4f).
// Assert every built-in adapterHint has a cost tier and the tiers are correct.
import { ADAPTER_COST_TIERS, AdapterCostTier } from "../geocoding-adapter";

const BUILTIN_ADAPTERS = ["geoapify", "google", "geocodify", "maptiler", "nominatim"] as const;

describe("ADAPTER_COST_TIERS", () => {
  it("contains every built-in geocoding adapter", () => {
    for (const adapter of BUILTIN_ADAPTERS) {
      expect(ADAPTER_COST_TIERS).toHaveProperty(adapter);
    }
  });

  it("assigns nominatim cost=free", () => {
    expect(ADAPTER_COST_TIERS["nominatim"]).toBe("free");
  });

  it("assigns paid-metered to geoapify, google, geocodify, maptiler", () => {
    const paidAdapters = ["geoapify", "google", "geocodify", "maptiler"] as const;
    for (const adapter of paidAdapters) {
      expect(ADAPTER_COST_TIERS[adapter]).toBe("paid-metered");
    }
  });

  it("every cost value is a valid AdapterCostTier", () => {
    const valid: AdapterCostTier[] = ["free", "paid-metered", "paid-fixed"];
    for (const [adapter, tier] of Object.entries(ADAPTER_COST_TIERS)) {
      expect(valid).toContain(tier as AdapterCostTier),
        `adapter '${adapter}' has unexpected tier '${String(tier)}'`;
    }
  });
});
