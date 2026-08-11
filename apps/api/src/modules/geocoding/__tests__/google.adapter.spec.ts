import { GoogleAdapter } from "../adapters/google.adapter";

function makeResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok !== undefined ? ok : status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers()
  } as unknown as Response;
}

describe("GoogleAdapter", () => {
  let adapter: GoogleAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new GoogleAdapter();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------- geocode payload ----------
  const rawGeocodeResult = {
    formatted_address: "1 George St, Brisbane City QLD 4000, Australia",
    address_components: [
      { long_name: "1", short_name: "1", types: ["street_number"] },
      { long_name: "George Street", short_name: "George St", types: ["route"] },
      { long_name: "Brisbane City", short_name: "Brisbane City", types: ["locality", "political"] },
      { long_name: "Queensland", short_name: "QLD", types: ["administrative_area_level_1", "political"] },
      { long_name: "4000", short_name: "4000", types: ["postal_code"] },
      { long_name: "Australia", short_name: "AU", types: ["country", "political"] }
    ],
    geometry: { location: { lat: -27.4698, lng: 153.0251 } },
    place_id: "ChIJ_place"
  };

  // ---------- autocomplete payload ----------
  const rawPrediction = {
    description: "1 George St, Brisbane QLD, Australia",
    structured_formatting: {
      main_text: "1 George St",
      secondary_text: "Brisbane QLD, Australia"
    },
    place_id: "ChIJ_auto"
  };

  describe("autocomplete", () => {
    it("maps a Google Places prediction into GeoapifySuggestion (text only — no lat/lon)", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, { status: "OK", predictions: [rawPrediction] })
      );

      const results = await adapter.autocomplete("1 George St", "key-xyz");

      expect(results).toHaveLength(1);
      const s = results[0];
      expect(s.formatted).toBe("1 George St, Brisbane QLD, Australia");
      expect(s.addressLine1).toBe("1 George St");
      expect(s.addressLine2).toBe("Brisbane QLD, Australia");
      expect(s.placeId).toBe("ChIJ_auto");
      // autocomplete returns no coordinates
      expect(s.lat).toBeNull();
      expect(s.lon).toBeNull();
    });

    it("sends key as query param and country:AU component", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { status: "OK", predictions: [] }));
      await adapter.autocomplete("q", "MY-KEY");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("key=MY-KEY");
      expect(url).toContain("components=country%3AAU");
    });

    it("throws on non-2xx HTTP", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(403, {}, false));
      await expect(adapter.autocomplete("q", "k")).rejects.toThrow("google_http_403");
    });

    it("throws on non-OK Google status (e.g. INVALID_REQUEST)", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, { status: "INVALID_REQUEST", predictions: [] })
      );
      await expect(adapter.autocomplete("q", "k")).rejects.toThrow("google_status_INVALID_REQUEST");
    });

    it("returns empty on ZERO_RESULTS without throwing", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { status: "ZERO_RESULTS", predictions: [] }));
      const results = await adapter.autocomplete("nowhere", "k");
      expect(results).toEqual([]);
    });
  });

  describe("forward", () => {
    it("maps a Google Geocoding result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, { status: "OK", results: [rawGeocodeResult] })
      );

      const results = await adapter.forward("1 George St Brisbane", "key-xyz");

      expect(results).toHaveLength(1);
      const s = results[0];
      expect(s.formatted).toBe("1 George St, Brisbane City QLD 4000, Australia");
      expect(s.addressLine1).toBe("1 George Street");
      expect(s.suburb).toBe("Brisbane City");
      expect(s.state).toBe("QLD");
      expect(s.postcode).toBe("4000");
      expect(s.countryCode).toBe("au");
      expect(s.lat).toBe(-27.4698);
      expect(s.lon).toBe(153.0251);
      expect(s.placeId).toBe("ChIJ_place");
    });

    it("hits the Geocoding API endpoint with components=country:AU and region=au", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { status: "OK", results: [] }));
      await adapter.forward("q", "k");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("maps/api/geocode/json");
      expect(url).toContain("components=country%3AAU");
      expect(url).toContain("region=au");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, false));
      await expect(adapter.forward("q", "k")).rejects.toThrow("google_http_500");
    });
  });

  describe("reverse", () => {
    it("maps a Google reverse geocode result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(200, { status: "OK", results: [rawGeocodeResult] })
      );

      const results = await adapter.reverse(-27.4698, 153.0251, "key-xyz");

      expect(results).toHaveLength(1);
      expect(results[0].suburb).toBe("Brisbane City");
      expect(results[0].state).toBe("QLD");
    });

    it("hits the Geocoding API with latlng param", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { status: "OK", results: [] }));
      await adapter.reverse(-27.47, 153.03, "k");
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("latlng=-27.47%2C153.03");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(401, {}, false));
      await expect(adapter.reverse(-27, 153, "k")).rejects.toThrow("google_http_401");
    });
  });
});
