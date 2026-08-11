import { NominatimAdapter } from "../adapters/nominatim.adapter";

// ---------- helpers ----------

function makeHeaders(extra: Record<string, string> = {}): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(extra)) {
    h.set(k, v);
  }
  return h;
}

function makeResponse(status: number, body: unknown, headerMap: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: makeHeaders(headerMap)
  } as unknown as Response;
}

// ---------- raw payload fixtures ----------

const rawResult = {
  place_id: 42,
  display_name: "1 George Street, Brisbane City, Queensland 4000, Australia",
  lat: "-27.4698",
  lon: "153.0251",
  address: {
    house_number: "1",
    road: "George Street",
    suburb: "Brisbane City",
    "ISO3166-2-lvl4": "AU-QLD",
    postcode: "4000",
    country_code: "au"
  }
};

const rawReverseResult = {
  place_id: 99,
  display_name: "2 Queen St, Brisbane City, Queensland 4000, Australia",
  lat: "-27.47",
  lon: "153.02",
  address: {
    house_number: "2",
    road: "Queen St",
    city: "Brisbane City",
    "ISO3166-2-lvl4": "AU-QLD",
    postcode: "4000",
    country_code: "au"
  }
};

// ---------- tests ----------

describe("NominatimAdapter", () => {
  let adapter: NominatimAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    adapter = new NominatimAdapter();
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper: resolve the adapter's promise chain so fake timers can advance
  async function flushTimers(): Promise<void> {
    // Run all pending micro-tasks then advance by 1s to release the rate gate
    await Promise.resolve();
    jest.advanceTimersByTime(1_100);
    await Promise.resolve();
  }

  describe("autocomplete", () => {
    it("maps a Nominatim /search result into GeoapifySuggestion", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, [rawResult]));

      const promise = adapter.autocomplete("1 George St", "");
      await flushTimers();
      const results = await promise;

      expect(results).toHaveLength(1);
      const s = results[0];
      expect(s.formatted).toBe("1 George Street, Brisbane City, Queensland 4000, Australia");
      expect(s.addressLine1).toBe("1 George Street");
      expect(s.suburb).toBe("Brisbane City");
      expect(s.state).toBe("QLD");
      expect(s.postcode).toBe("4000");
      expect(s.countryCode).toBe("au");
      expect(s.lat).toBe(-27.4698);
      expect(s.lon).toBe(153.0251);
      expect(s.placeId).toBe("42");
    });

    it("sends a valid User-Agent header", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, []));

      const promise = adapter.autocomplete("q", "");
      await flushTimers();
      await promise;

      const callOptions = fetchSpy.mock.calls[0][1] as RequestInit;
      const ua = (callOptions.headers as Record<string, string>)["User-Agent"];
      expect(ua).toBeTruthy();
      expect(ua.length).toBeGreaterThan(0);
    });

    it("sends countrycodes=au, format=json, addressdetails=1", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, []));

      const promise = adapter.autocomplete("q", "");
      await flushTimers();
      await promise;

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("countrycodes=au");
      expect(url).toContain("format=json");
      expect(url).toContain("addressdetails=1");
    });

    it("returns empty on empty array result", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, []));

      const promise = adapter.autocomplete("nowhere", "");
      await flushTimers();
      const results = await promise;
      expect(results).toEqual([]);
    });

    it("throws on non-2xx so the chain falls through", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, {}));

      const promise = adapter.autocomplete("q", "");
      await flushTimers();
      await expect(promise).rejects.toThrow("nominatim_http_500");
    });
  });

  describe("forward", () => {
    it("hits /search and maps result", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, [rawResult]));

      const promise = adapter.forward("1 George St Brisbane", "");
      await flushTimers();
      const results = await promise;

      expect(results).toHaveLength(1);
      expect(results[0].suburb).toBe("Brisbane City");
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(403, {}, {}));

      const promise = adapter.forward("q", "");
      await flushTimers();
      await expect(promise).rejects.toThrow("nominatim_http_403");
    });
  });

  describe("reverse", () => {
    it("hits /reverse and maps the single-object result", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, rawReverseResult));

      const promise = adapter.reverse(-27.47, 153.02, "");
      await flushTimers();
      const results = await promise;

      expect(results).toHaveLength(1);
      const s = results[0];
      expect(s.formatted).toBe("2 Queen St, Brisbane City, Queensland 4000, Australia");
      expect(s.suburb).toBe("Brisbane City");
      expect(s.state).toBe("QLD");
    });

    it("hits the /reverse endpoint with lat+lon params", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, rawReverseResult));

      const promise = adapter.reverse(-27.47, 153.03, "");
      await flushTimers();
      await promise;

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("/reverse");
      expect(url).toContain("lat=-27.47");
      expect(url).toContain("lon=153.03");
    });

    it("returns empty when reverse returns an object without display_name", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { error: "Unable to geocode" }));

      const promise = adapter.reverse(-27, 153, "");
      await flushTimers();
      const results = await promise;
      expect(results).toEqual([]);
    });

    it("throws on non-2xx", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, {}));

      const promise = adapter.reverse(-27, 153, "");
      await flushTimers();
      await expect(promise).rejects.toThrow("nominatim_http_500");
    });
  });

  describe("1 rps rate gate", () => {
    it("serialises two rapid calls so the second fires >= 1 s after the first starts", async () => {
      const callTimestamps: number[] = [];

      // Set up mockImplementation BEFORE making calls so every call goes through it.
      fetchSpy.mockImplementation(async () => {
        callTimestamps.push(Date.now());
        return makeResponse(200, []);
      });

      const p1 = adapter.autocomplete("first", "");
      const p2 = adapter.autocomplete("second", "");

      // Let the first call start (it fires immediately since the queue was empty).
      await Promise.resolve();

      // Advance past the first 1 s slot so the second call can start.
      jest.advanceTimersByTime(1_100);
      await Promise.resolve();

      // Advance past the second 1 s slot so the queue drains.
      jest.advanceTimersByTime(1_100);
      await Promise.resolve();

      await Promise.all([p1, p2]);

      expect(callTimestamps).toHaveLength(2);
      // The second fetch fired at least 1 000 ms after the first.
      expect(callTimestamps[1] - callTimestamps[0]).toBeGreaterThanOrEqual(1_000);
    });
  });

  describe("Retry-After on 429", () => {
    it("waits the Retry-After duration and then throws nominatim_http_429", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(429, {}, { "Retry-After": "2" }));

      const promise = adapter.autocomplete("q", "");
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      // Advance past the Retry-After wait (2 000 ms) + the rate-gate slot (1 000 ms)
      jest.advanceTimersByTime(3_500);
      await Promise.resolve();

      await expect(promise).rejects.toThrow("nominatim_http_429");
    });
  });
});
