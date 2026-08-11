import { MapTilerAdapter } from "../adapters/maptiler.adapter";

function makeResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok !== undefined ? ok : status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers()
  } as unknown as Response;
}

describe("MapTilerAdapter", () => {
  let adapter: MapTilerAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new MapTilerAdapter();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------- payload fixture ----------
  const rawFeature = {
    id: "address.12345",
    type: "Feature",
    place_name: "1 George Street, Brisbane City QLD 4000, Australia",
    text: "1 George Street",
    place_type: ["address"],
    geometry: { type: "Point", coordinates: [153.0251, -27.4698] },
    context: [
      { id: "place.1", text: "Brisbane City" },
      { id: "region.1", text: "Queensland" },
      { id: "postcode.1", text: "4000" },
      { id: "country.1", text: "Australia" }
    ]
  };

  const responseBody = { type: "FeatureCollection", features: [rawFeature] };

  describe("autocomplete", () => {
    it("maps a MapTiler feature into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, responseBody));

      const results = await adapter.autocomplete("1 George St", "key-xyz");

      expect(results).toHaveLength(1);
      const s = results[0];
      expect(s.formatted).toBe("1 George Street, Brisbane City QLD 4000, Australia");
      expect(s.addressLine1).toBe("1 George Street");
      expect(s.suburb).toBe("Brisbane City");
      expect(s.state).toBe("Queensland");
      expect(s.postcode).toBe("4000");
      expect(s.lat).toBe(-27.4698);
      expect(s.lon).toBe(153.0251);
      expect(s.placeId).toBe("address.12345");
    });

    it("sends key as query param and country=au", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }));
      await adapter.autocomplete("q", "MY-KEY");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("key=MY-KEY");
      expect(url).toContain("country=au");
    });

    it("returns empty on empty features", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }));
      const results = await adapter.autocomplete("nowhere", "k");
      expect(results).toEqual([]);
    });

    it("throws on non-2xx so the chain falls through", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(401, {}, false));
      await expect(adapter.autocomplete("q", "k")).rejects.toThrow("maptiler_http_401");
    });
  });

  describe("forward", () => {
    it("maps a MapTiler feature into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, responseBody));

      const results = await adapter.forward("1 George St Brisbane", "key-xyz");

      expect(results).toHaveLength(1);
      expect(results[0].suburb).toBe("Brisbane City");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, false));
      await expect(adapter.forward("q", "k")).rejects.toThrow("maptiler_http_500");
    });
  });

  describe("reverse", () => {
    it("maps a MapTiler reverse result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, responseBody));

      const results = await adapter.reverse(-27.4698, 153.0251, "key-xyz");

      expect(results).toHaveLength(1);
      expect(results[0].suburb).toBe("Brisbane City");
    });

    it("hits the reverse endpoint with lon,lat path segment", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }));
      await adapter.reverse(-27.47, 153.03, "k");
      const url = fetchSpy.mock.calls[0][0] as string;
      // MapTiler reverse: /geocoding/{lon},{lat}.json
      // The comma in a URL path segment is valid and may not be percent-encoded.
      expect(url).toMatch(/153\.03[,]+-27\.47/);
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(403, {}, false));
      await expect(adapter.reverse(-27, 153, "k")).rejects.toThrow("maptiler_http_403");
    });
  });
});
