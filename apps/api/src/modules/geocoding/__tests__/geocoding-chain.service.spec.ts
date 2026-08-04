import { GeocodingChainService } from "../geocoding-chain.service";
import type { GeocodingAdapter, GeoapifySuggestion } from "../geocoding-adapter";

type FindManyArgs = { where: Record<string, unknown>; select?: Record<string, unknown> };

interface DbRow {
  id: string;
  adapter: string | null;
  order: number | null;
  config: unknown;
  systemKind: string | null;
  enabled: boolean;
}

function makeAdapter(
  key: string,
  behaviour: () => Promise<GeoapifySuggestion[]>
): GeocodingAdapter {
  return {
    key,
    autocomplete: behaviour,
    forward: async () => [],
    reverse: async () => []
  };
}

function suggestion(formatted: string): GeoapifySuggestion {
  return {
    formatted,
    addressLine1: null,
    addressLine2: null,
    suburb: null,
    state: null,
    postcode: null,
    countryCode: null,
    lat: null,
    lon: null,
    placeId: null
  };
}

function build(
  rows: DbRow[],
  opts: {
    apiKeys?: Record<string, string | null>;
    geoapifyBehaviour?: () => Promise<GeoapifySuggestion[]>;
  } = {}
) {
  const findMany = jest.fn(async ({ where }: FindManyArgs) => {
    // Assert the chain query is exactly what the plan §2c prescribes.
    expect(where.enabled).toBe(true);
    expect(where.type).toEqual({ systemKind: "geocoding" });
    return rows
      .filter((r) => r.enabled && r.systemKind === "geocoding")
      .map((r) => ({
        id: r.id,
        adapter: r.adapter,
        order: r.order,
        config: r.config,
        type: { systemKind: r.systemKind }
      }));
  });
  const prisma = { apiCredential: { findMany } } as never;
  const apiKeys = {
    resolve: jest.fn(async (adapter: string) => opts.apiKeys?.[adapter] ?? null)
  } as never;
  const geoapify = {
    key: "geoapify",
    autocomplete:
      opts.geoapifyBehaviour ?? (async () => [suggestion("Geoapify Result 1"), suggestion("Geoapify Result 2")]),
    forward: async () => [],
    reverse: async () => []
  };
  // Stub out the four new SLICE-6 adapters + the SLICE-7 custom-rest adapter
  // so the constructor doesn't fail.
  const makeStub = (key: string) => ({
    key,
    autocomplete: async () => [],
    forward: async () => [],
    reverse: async () => []
  });
  const service = new GeocodingChainService(
    prisma,
    apiKeys,
    geoapify as never,
    makeStub("google") as never,
    makeStub("geocodify") as never,
    makeStub("maptiler") as never,
    makeStub("nominatim") as never,
    makeStub("custom-rest") as never
  );
  return { service, findMany, apiKeys, geoapify };
}

describe("GeocodingChainService — SLICE-5 autocomplete chain", () => {
  it("returns configured=false when no geocoding provider is enabled", async () => {
    const { service, findMany } = build([]);
    const result = await service.autocomplete("100 george st");
    expect(result.configured).toBe(false);
    expect(result.results).toEqual([]);
    expect(result.reason).toMatch(/no geocoding provider/i);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("single-provider (Geoapify only) returns its suggestions unchanged", async () => {
    const { service } = build(
      [{ id: "c1", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true }],
      { apiKeys: { geoapify: "k-geo" } }
    );
    const result = await service.autocomplete("100 george st");
    expect(result.configured).toBe(true);
    expect(result.results.map((r) => r.formatted)).toEqual(["Geoapify Result 1", "Geoapify Result 2"]);
    expect(result.reason).toBeUndefined();
  });

  it("skips a row whose ApiKeysService.resolve returns null and tries the next", async () => {
    const behaviour: Array<() => Promise<GeoapifySuggestion[]>> = [
      async () => [suggestion("From Provider B")]
    ];
    // "provider-a" resolves to no key -> skipped. "provider-b" has a key and returns 1 result.
    const providerA = makeAdapter("provider-a", async () => {
      throw new Error("provider-a should never be invoked without a key");
    });
    const providerB = makeAdapter("provider-b", async () => behaviour[0]());

    const { service } = build(
      [
        { id: "a", adapter: "provider-a", order: 1, config: null, systemKind: "geocoding", enabled: true },
        { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
      ],
      { apiKeys: { "provider-a": null, "provider-b": "k-b" } }
    );
    service.register(providerA);
    service.register(providerB);

    const result = await service.autocomplete("100 george st");
    expect(result.configured).toBe(true);
    expect(result.results.map((r) => r.formatted)).toEqual(["From Provider B"]);
  });

  describe("fall-through table", () => {
    const cases: Array<{ label: string; behaviour: () => Promise<GeoapifySuggestion[]> }> = [
      { label: "timeout", behaviour: async () => { throw new Error("aborted"); } },
      { label: "network error", behaviour: async () => { throw new Error("ECONNRESET"); } },
      { label: "http 401", behaviour: async () => { throw new Error("geoapify_http_401"); } },
      { label: "http 500", behaviour: async () => { throw new Error("geoapify_http_500"); } },
      { label: "zero results", behaviour: async () => [] }
    ];

    for (const { label, behaviour } of cases) {
      it(`falls through '${label}' to the next provider and returns its results`, async () => {
        const providerB = makeAdapter("provider-b", async () => [suggestion(`After ${label}`)]);
        const { service } = build(
          [
            { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
            { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
          ],
          { apiKeys: { geoapify: "k-a", "provider-b": "k-b" }, geoapifyBehaviour: behaviour }
        );
        service.register(providerB);

        const result = await service.autocomplete("100 george st");
        expect(result.configured).toBe(true);
        expect(result.results.map((r) => r.formatted)).toEqual([`After ${label}`]);
      });
    }

    it("returns configured=true + empty results + reason when every provider fails", async () => {
      const providerB = makeAdapter("provider-b", async () => {
        throw new Error("also_failed");
      });
      const { service } = build(
        [
          { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
          { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
        ],
        {
          apiKeys: { geoapify: "k-a", "provider-b": "k-b" },
          geoapifyBehaviour: async () => {
            throw new Error("first_failed");
          }
        }
      );
      service.register(providerB);
      const result = await service.autocomplete("100 george st");
      expect(result.configured).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.reason).toMatch(/provider-b: also_failed/);
    });
  });

  it("orders the chain by `order` ASC with NULLS LAST", async () => {
    const seen: string[] = [];
    const wrap = (key: string) =>
      makeAdapter(key, async () => {
        seen.push(key);
        return [];
      });
    const { service } = build(
      [
        { id: "n", adapter: "prov-null", order: null, config: null, systemKind: "geocoding", enabled: true },
        { id: "b", adapter: "prov-2", order: 2, config: null, systemKind: "geocoding", enabled: true },
        { id: "a", adapter: "prov-1", order: 1, config: null, systemKind: "geocoding", enabled: true }
      ],
      { apiKeys: { "prov-null": "kN", "prov-1": "k1", "prov-2": "k2" } }
    );
    service.register(wrap("prov-1"));
    service.register(wrap("prov-2"));
    service.register(wrap("prov-null"));

    await service.autocomplete("100 george st");
    expect(seen).toEqual(["prov-1", "prov-2", "prov-null"]);
  });

  it("memoises the chain for 30s and re-loads after invalidate()", async () => {
    const { service, findMany } = build(
      [{ id: "c1", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true }],
      { apiKeys: { geoapify: "k-geo" } }
    );
    await service.autocomplete("100 george st");
    await service.autocomplete("101 george st");
    await service.autocomplete("102 george st");
    expect(findMany).toHaveBeenCalledTimes(1);

    service.invalidate();
    await service.autocomplete("103 george st");
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("skips rows referencing an adapter that isn't registered", async () => {
    const { service } = build(
      [
        { id: "u", adapter: "future-provider", order: 1, config: null, systemKind: "geocoding", enabled: true },
        { id: "g", adapter: "geoapify", order: 2, config: null, systemKind: "geocoding", enabled: true }
      ],
      { apiKeys: { "future-provider": "kX", geoapify: "kG" } }
    );
    const result = await service.autocomplete("100 george st");
    expect(result.results.map((r) => r.formatted)).toEqual(["Geoapify Result 1", "Geoapify Result 2"]);
  });
});
