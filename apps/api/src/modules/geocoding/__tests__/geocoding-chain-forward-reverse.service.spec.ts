// Chain forward + reverse fall-through table tests (SLICE-6).
// Mirrors the style of geocoding-chain.service.spec.ts (SLICE-5).
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
  behaviour: {
    autocomplete?: () => Promise<GeoapifySuggestion[]>;
    forward?: () => Promise<GeoapifySuggestion[]>;
    reverse?: () => Promise<GeoapifySuggestion[]>;
  } = {}
): GeocodingAdapter {
  return {
    key,
    autocomplete: behaviour.autocomplete ?? (async () => []),
    forward: behaviour.forward ?? (async () => []),
    reverse: behaviour.reverse ?? (async () => [])
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
    primaryBehaviour?: {
      forward?: () => Promise<GeoapifySuggestion[]>;
      reverse?: () => Promise<GeoapifySuggestion[]>;
    };
  } = {}
) {
  const findMany = jest.fn(async ({ where }: FindManyArgs) => {
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

  // Primary adapter ("geoapify") wired as SLICE-5 does in the constructor
  const primaryAdapter = makeAdapter("geoapify", {
    autocomplete: async () => [suggestion("Geoapify result")],
    forward: opts.primaryBehaviour?.forward ?? (async () => [suggestion("Geoapify forward")]),
    reverse: opts.primaryBehaviour?.reverse ?? (async () => [suggestion("Geoapify reverse")])
  });

  // Stub out the other four adapters that the constructor now injects
  const stub = (key: string) => makeAdapter(key, {});
  const google = stub("google");
  const geocodify = stub("geocodify");
  const maptiler = stub("maptiler");
  const nominatim = stub("nominatim");

  const service = new GeocodingChainService(
    prisma,
    apiKeys,
    primaryAdapter as never,
    google as never,
    geocodify as never,
    maptiler as never,
    nominatim as never
  );
  return { service, findMany, apiKeys, primaryAdapter };
}

// ---------------------------------------------------------------------------
// forward()
// ---------------------------------------------------------------------------

describe("GeocodingChainService — SLICE-6 forward()", () => {
  it("returns configured=false when no geocoding provider is enabled", async () => {
    const { service } = build([]);
    const result = await service.forward("1 George St");
    expect(result.configured).toBe(false);
    expect(result.results).toEqual([]);
    expect(result.reason).toMatch(/no geocoding provider/i);
  });

  it("single-provider returns its forward results", async () => {
    const { service } = build(
      [{ id: "c1", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true }],
      { apiKeys: { geoapify: "k-geo" } }
    );
    const result = await service.forward("1 George St");
    expect(result.configured).toBe(true);
    expect(result.results.map((r) => r.formatted)).toEqual(["Geoapify forward"]);
  });

  it("skips a row with no key and tries the next", async () => {
    const providerB = makeAdapter("provider-b", {
      forward: async () => [suggestion("B forward")]
    });
    const { service } = build(
      [
        { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
        { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
      ],
      { apiKeys: { geoapify: null, "provider-b": "k-b" } }
    );
    service.register(providerB);

    const result = await service.forward("q");
    expect(result.configured).toBe(true);
    expect(result.results.map((r) => r.formatted)).toEqual(["B forward"]);
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
      it(`falls through '${label}' on forward to the next provider`, async () => {
        const providerB = makeAdapter("provider-b", {
          forward: async () => [suggestion(`After ${label}`)]
        });
        const { service } = build(
          [
            { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
            { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
          ],
          {
            apiKeys: { geoapify: "k-a", "provider-b": "k-b" },
            primaryBehaviour: { forward: behaviour }
          }
        );
        service.register(providerB);

        const result = await service.forward("q");
        expect(result.configured).toBe(true);
        expect(result.results.map((r) => r.formatted)).toEqual([`After ${label}`]);
      });
    }

    it("returns configured=true + empty + reason when every forward provider fails", async () => {
      const providerB = makeAdapter("provider-b", {
        forward: async () => { throw new Error("also_failed"); }
      });
      const { service } = build(
        [
          { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
          { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
        ],
        {
          apiKeys: { geoapify: "k-a", "provider-b": "k-b" },
          primaryBehaviour: { forward: async () => { throw new Error("first_failed"); } }
        }
      );
      service.register(providerB);
      const result = await service.forward("q");
      expect(result.configured).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.reason).toMatch(/provider-b: also_failed/);
    });
  });
});

// ---------------------------------------------------------------------------
// reverse()
// ---------------------------------------------------------------------------

describe("GeocodingChainService — SLICE-6 reverse()", () => {
  it("returns configured=false when no geocoding provider is enabled", async () => {
    const { service } = build([]);
    const result = await service.reverse(-27.47, 153.03);
    expect(result.configured).toBe(false);
    expect(result.results).toEqual([]);
    expect(result.reason).toMatch(/no geocoding provider/i);
  });

  it("single-provider returns its reverse results", async () => {
    const { service } = build(
      [{ id: "c1", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true }],
      { apiKeys: { geoapify: "k-geo" } }
    );
    const result = await service.reverse(-27.47, 153.03);
    expect(result.configured).toBe(true);
    expect(result.results.map((r) => r.formatted)).toEqual(["Geoapify reverse"]);
  });

  it("skips a row with no key and tries the next", async () => {
    const providerB = makeAdapter("provider-b", {
      reverse: async () => [suggestion("B reverse")]
    });
    const { service } = build(
      [
        { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
        { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
      ],
      { apiKeys: { geoapify: null, "provider-b": "k-b" } }
    );
    service.register(providerB);

    const result = await service.reverse(-27, 153);
    expect(result.configured).toBe(true);
    expect(result.results.map((r) => r.formatted)).toEqual(["B reverse"]);
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
      it(`falls through '${label}' on reverse to the next provider`, async () => {
        const providerB = makeAdapter("provider-b", {
          reverse: async () => [suggestion(`After ${label}`)]
        });
        const { service } = build(
          [
            { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
            { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
          ],
          {
            apiKeys: { geoapify: "k-a", "provider-b": "k-b" },
            primaryBehaviour: { reverse: behaviour }
          }
        );
        service.register(providerB);

        const result = await service.reverse(-27, 153);
        expect(result.configured).toBe(true);
        expect(result.results.map((r) => r.formatted)).toEqual([`After ${label}`]);
      });
    }

    it("returns configured=true + empty + reason when every reverse provider fails", async () => {
      const providerB = makeAdapter("provider-b", {
        reverse: async () => { throw new Error("also_failed"); }
      });
      const { service } = build(
        [
          { id: "a", adapter: "geoapify", order: 1, config: null, systemKind: "geocoding", enabled: true },
          { id: "b", adapter: "provider-b", order: 2, config: null, systemKind: "geocoding", enabled: true }
        ],
        {
          apiKeys: { geoapify: "k-a", "provider-b": "k-b" },
          primaryBehaviour: { reverse: async () => { throw new Error("first_failed"); } }
        }
      );
      service.register(providerB);
      const result = await service.reverse(-27, 153);
      expect(result.configured).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.reason).toMatch(/provider-b: also_failed/);
    });
  });
});
