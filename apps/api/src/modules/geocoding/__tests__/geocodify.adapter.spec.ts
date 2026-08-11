import { GeocodifyAdapter } from "../adapters/geocodify.adapter";

function makeResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok !== undefined ? ok : status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers()
  } as unknown as Response;
}

describe("GeocodifyAdapter", () => {
  let adapter: GeocodifyAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new GeocodifyAdapter();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------- payload fixture ----------
  const rawFeature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [153.0251, -27.4698] },
    properties: {
      label: "1 George St, Brisbane City QLD 4000",
      housenumber: "1",
      street: "George St",
      suburb: "Brisbane City",
      state: "QLD",
      postcode: "4000",
      country_code: "AU"
    }
  };

  const responseBody = { response: { features: [rawFeature] } };

  describe("autocomplete", () => {
    it("maps a Geocodify feature into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, responseBody));

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
      expect(s.placeId).toBeNull();
    });

    it("sends api_key as query param", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { response: { features: [] } }));
      await adapter.autocomplete("q", "MY-KEY");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("api_key=MY-KEY");
    });

    it("applies countrycodes=au filter", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { response: { features: [] } }));
      await adapter.autocomplete("q", "k");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("countrycodes=au");
    });

    it("returns empty array when features is empty", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { response: { features: [] } }));
      const results = await adapter.autocomplete("nowhere", "k");
      expect(results).toEqual([]);
    });

    it("throws on non-2xx so the chain falls through", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(401, {}, false));
      await expect(adapter.autocomplete("q", "k")).rejects.toThrow("geocodify_http_401");
    });
  });

  describe("forward", () => {
    it("maps a Geocodify geocode result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, responseBody));

      const results = await adapter.forward("1 George St Brisbane", "key-xyz");

      expect(results).toHaveLength(1);
      expect(results[0].formatted).toBe("1 George St, Brisbane City QLD 4000");
      expect(results[0].lat).toBe(-27.4698);
      expect(results[0].lon).toBe(153.0251);
    });

    it("hits the /api/geocode endpoint", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { response: { features: [] } }));
      await adapter.forward("q", "k");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/api/geocode");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, false));
      await expect(adapter.forward("q", "k")).rejects.toThrow("geocodify_http_500");
    });
  });

  describe("reverse", () => {
    it("maps a Geocodify reverse result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, responseBody));

      const results = await adapter.reverse(-27.4698, 153.0251, "key-xyz");

      expect(results).toHaveLength(1);
      expect(results[0].suburb).toBe("Brisbane City");
    });

    it("hits the /api/reverse endpoint with lat+lng params", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { response: { features: [] } }));
      await adapter.reverse(-27.47, 153.03, "k");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/api/reverse");
      expect(url).toContain("lat=-27.47");
      expect(url).toContain("lng=153.03");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(403, {}, false));
      await expect(adapter.reverse(-27, 153, "k")).rejects.toThrow("geocodify_http_403");
    });
  });
});
