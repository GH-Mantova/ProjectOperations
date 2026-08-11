// Verifies that the real CustomRestAdapter is registered on the chain and
// participates in the same timeout / 5xx / 401 / empty → next-row fall-through
// as every other provider (plan §4e).
import { CustomRestAdapter } from "../adapters/custom-rest.adapter";
import { GeocodingChainService } from "../geocoding-chain.service";
import type { GeocodingAdapter, GeoapifySuggestion } from "../geocoding-adapter";

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

function makeStub(key: string): GeocodingAdapter {
  return {
    key,
    autocomplete: async () => [],
    forward: async () => [],
    reverse: async () => []
  };
}

function makeResponse(
  status: number,
  body: unknown,
  ok?: boolean
): Response {
  return {
    ok: ok !== undefined ? ok : status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers()
  } as unknown as Response;
}

interface DbRow {
  id: string;
  adapter: string;
  order: number | null;
  config: unknown;
  systemKind: string;
  enabled: boolean;
}

function build(rows: DbRow[], apiKeys: Record<string, string>) {
  const findMany = jest.fn(async () =>
    rows
      .filter((r) => r.enabled && r.systemKind === "geocoding")
      .map((r) => ({
        id: r.id,
        adapter: r.adapter,
        order: r.order,
        config: r.config,
        type: { systemKind: r.systemKind }
      }))
  );
  const prisma = { apiCredential: { findMany } } as never;
  const apiKeyService = {
    resolve: jest.fn(async (adapter: string) => apiKeys[adapter] ?? null)
  } as never;
  const customRest = new CustomRestAdapter();
  // Make the SSRF guard pass in unit tests without touching real DNS.
  customRest.setHostResolverForTests(async () => ["1.1.1.1"]);
  const service = new GeocodingChainService(
    prisma,
    apiKeyService,
    makeStub("geoapify") as never,
    makeStub("google") as never,
    makeStub("geocodify") as never,
    makeStub("maptiler") as never,
    makeStub("nominatim") as never,
    customRest as never
  );
  return { service, customRest };
}

const customRestConfig = {
  baseUrl: "https://provider.example",
  autocompletePath: "/autocomplete",
  responseShape: { resultsPath: "features", fields: { formatted: "properties.formatted" } }
};

describe("GeocodingChainService — custom-rest participation", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns custom-rest results when it is the only enabled provider", async () => {
    const { service } = build(
      [
        {
          id: "cr",
          adapter: "custom-rest",
          order: 1,
          config: customRestConfig,
          systemKind: "geocoding",
          enabled: true
        }
      ],
      { "custom-rest": "k-cr" }
    );
    fetchSpy.mockResolvedValueOnce(
      makeResponse(200, {
        features: [{ properties: { formatted: "1 George St, Brisbane" } }]
      })
    );
    const res = await service.autocomplete("1 George");
    expect(res.configured).toBe(true);
    expect(res.results.map((r) => r.formatted)).toEqual(["1 George St, Brisbane"]);
  });

  const fallThroughs: Array<{ label: string; setup: () => void }> = [
    {
      label: "timeout / abort",
      setup: () => fetchSpy.mockRejectedValueOnce(new Error("aborted"))
    },
    {
      label: "http 500",
      setup: () => fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, false))
    },
    {
      label: "http 401",
      setup: () => fetchSpy.mockResolvedValueOnce(makeResponse(401, {}, false))
    },
    {
      label: "zero results",
      setup: () => fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }))
    }
  ];

  for (const { label, setup } of fallThroughs) {
    it(`custom-rest fall-through '${label}' hands off to the next row`, async () => {
      const nextAdapter: GeocodingAdapter = {
        key: "next-provider",
        autocomplete: async () => [suggestion("After custom-rest")],
        forward: async () => [],
        reverse: async () => []
      };
      const { service } = build(
        [
          {
            id: "cr",
            adapter: "custom-rest",
            order: 1,
            config: customRestConfig,
            systemKind: "geocoding",
            enabled: true
          },
          {
            id: "np",
            adapter: "next-provider",
            order: 2,
            config: null,
            systemKind: "geocoding",
            enabled: true
          }
        ],
        { "custom-rest": "k-cr", "next-provider": "k-np" }
      );
      service.register(nextAdapter);
      setup();

      const res = await service.autocomplete("q");
      expect(res.configured).toBe(true);
      expect(res.results.map((r) => r.formatted)).toEqual(["After custom-rest"]);
    });
  }
});
