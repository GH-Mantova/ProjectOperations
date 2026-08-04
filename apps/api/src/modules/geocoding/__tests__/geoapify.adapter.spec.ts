import { GeoapifyAdapter } from "../adapters/geoapify.adapter";

// Helper that creates a minimal Response-like object
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

describe("GeoapifyAdapter", () => {
  let adapter: GeoapifyAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new GeoapifyAdapter();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------- raw payload fixture ----------
  const rawResult = {
    formatted: "1 George St, Brisbane City QLD 4000",
    address_line1: "1 George St",
    address_line2: "Brisbane City QLD 4000",
    suburb: "Brisbane City",
    state: "Queensland",
    state_code: "QLD",
    postcode: "4000",
    country_code: "au",
    lat: -27.4698,
    lon: 153.0251,
    place_id: "pl-123"
  };

  function assertSuggestionShape(suggestion: ReturnType<typeof Object.create>): void {
    expect(typeof suggestion.formatted).toBe("string");
    // text-only check: lat / lon / placeId are transported but must not
    // mutate into something that leaks into a text-only persistence path
    expect("lat" in suggestion).toBe(true); // present in shape
    expect("lon" in suggestion).toBe(true);
    expect("placeId" in suggestion).toBe(true);
  }

  describe("autocomplete", () => {
    it("maps a Geoapify result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [rawResult] }));

      const results = await adapter.autocomplete("1 George St", "key-xyz");

      expect(results).toHaveLength(1);
      const s = results[0];
      expect(s.formatted).toBe("1 George St, Brisbane City QLD 4000");
      expect(s.addressLine1).toBe("1 George St");
      expect(s.suburb).toBe("Brisbane City");
      expect(s.state).toBe("QLD");
      expect(s.postcode).toBe("4000");
      expect(s.countryCode).toBe("au");
      expect(s.lat).toBe(-27.4698);
      expect(s.lon).toBe(153.0251);
      expect(s.placeId).toBe("pl-123");
      assertSuggestionShape(s);
    });

    it("returns empty array on ZERO results", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [] }));
      const results = await adapter.autocomplete("nowhere", "k");
      expect(results).toEqual([]);
    });

    it("throws on non-2xx so the chain falls through", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(401, {}, false));
      await expect(adapter.autocomplete("q", "k")).rejects.toThrow("geoapify_http_401");
    });

    it("sends the apiKey as a query param", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [] }));
      await adapter.autocomplete("q", "MY-KEY");
      const calledUrl = (fetchSpy.mock.calls[0][0] as string);
      expect(calledUrl).toContain("apiKey=MY-KEY");
    });

    it("sends filter=countrycode:au and format=json", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [] }));
      await adapter.autocomplete("q", "k");
      const calledUrl = (fetchSpy.mock.calls[0][0] as string);
      expect(calledUrl).toContain("filter=countrycode%3Aau");
      expect(calledUrl).toContain("format=json");
    });
  });

  describe("forward", () => {
    it("maps a Geoapify forward result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [rawResult] }));

      const results = await adapter.forward("1 George St Brisbane", "key-xyz");

      expect(results).toHaveLength(1);
      expect(results[0].formatted).toBe("1 George St, Brisbane City QLD 4000");
      expect(results[0].suburb).toBe("Brisbane City");
    });

    it("hits the /v1/geocode/search endpoint", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [] }));
      await adapter.forward("q", "k");
      expect(fetchSpy.mock.calls[0][0]).toContain("/v1/geocode/search");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, false));
      await expect(adapter.forward("q", "k")).rejects.toThrow("geoapify_http_500");
    });
  });

  describe("reverse", () => {
    it("maps a Geoapify reverse result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [rawResult] }));

      const results = await adapter.reverse(-27.4698, 153.0251, "key-xyz");

      expect(results).toHaveLength(1);
      expect(results[0].formatted).toBe("1 George St, Brisbane City QLD 4000");
    });

    it("hits the /v1/geocode/reverse endpoint with lat+lon params", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { results: [] }));
      await adapter.reverse(-27.47, 153.03, "k");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/v1/geocode/reverse");
      expect(url).toContain("lat=-27.47");
      expect(url).toContain("lon=153.03");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(403, {}, false));
      await expect(adapter.reverse(-27, 153, "k")).rejects.toThrow("geoapify_http_403");
    });
  });
});
