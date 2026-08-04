import { CustomRestAdapter } from "../adapters/custom-rest.adapter";
import type { HostResolver } from "../adapters/ssrf-guard";

// ---------- helpers ----------

function makeResponse(
  status: number,
  body: unknown,
  extras: { headers?: Record<string, string>; ok?: boolean } = {}
): Response {
  const headers = new Headers();
  for (const [k, v] of Object.entries(extras.headers ?? {})) headers.set(k, v);
  return {
    ok: extras.ok !== undefined ? extras.ok : status >= 200 && status < 300,
    status,
    json: async () => body,
    headers
  } as unknown as Response;
}

function stubResolver(map: Record<string, string[]>): HostResolver {
  return async (host: string) => map[host] ?? [];
}

// A resolver that always returns a routable public IP (Cloudflare 1.1.1.1) so
// the SSRF guard passes and tests can exercise mapping / redirect / fall-through
// behaviour without needing to think about DNS.
const publicResolver: HostResolver = async () => ["1.1.1.1"];

// ---------- fixtures ----------

const baseConfig = {
  baseUrl: "https://provider.example",
  autocompletePath: "/api/autocomplete",
  forwardPath: "/api/forward",
  reversePath: "/api/reverse",
  headerName: "Authorization",
  headerPrefix: "Bearer ",
  responseShape: {
    resultsPath: "features",
    fields: {
      formatted: "properties.formatted",
      addressLine1: "properties.line1",
      suburb: "properties.city",
      state: "properties.region",
      postcode: "properties.zip"
    }
  }
};

const rawFeature = {
  properties: {
    formatted: "1 George St, Brisbane City QLD 4000",
    line1: "1 George St",
    city: "Brisbane City",
    region: "QLD",
    zip: "4000"
  },
  // These MUST NOT flow through to the persisted shape (compliance §6).
  geometry: { type: "Point", coordinates: [153.0251, -27.4698] },
  place_id: "custom_place_id_123"
};

// ---------- suite ----------

describe("CustomRestAdapter", () => {
  let adapter: CustomRestAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new CustomRestAdapter();
    adapter.setHostResolverForTests(publicResolver);
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------- SSRF guard ------------------------------------

  describe("SSRF guard", () => {
    it("rejects http scheme at request time", async () => {
      await expect(
        adapter.autocomplete("q", "k", { ...baseConfig, baseUrl: "http://provider.example" })
      ).rejects.toThrow("ssrf_scheme_not_https");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["file:///etc/passwd", "ssrf_scheme_not_https"],
      ["data:text/plain,hello", "ssrf_scheme_not_https"],
      ["gopher://provider.example/x", "ssrf_scheme_not_https"],
      ["ftp://provider.example/x", "ssrf_scheme_not_https"]
    ])("rejects '%s'", async (url, msg) => {
      await expect(
        adapter.autocomplete("q", "k", { ...baseConfig, baseUrl: url })
      ).rejects.toThrow(msg);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["127.0.0.1", "loopback"],
      ["10.5.6.7", "RFC1918 10/8"],
      ["172.20.1.1", "RFC1918 172.16/12"],
      ["192.168.1.1", "RFC1918 192.168/16"],
      ["169.254.169.254", "link-local (AWS IMDS)"],
      ["100.64.1.1", "CGNAT 100.64/10"],
      ["224.0.0.1", "multicast"],
      ["240.0.0.1", "reserved"],
      ["0.0.0.0", "0.0.0.0/8"]
    ])("rejects at request time when host resolves to %s (%s)", async (ip) => {
      adapter.setHostResolverForTests(stubResolver({ "provider.example": [ip] }));
      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "ssrf_blocked_ip"
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["::1", "IPv6 loopback"],
      ["fe80::1", "IPv6 link-local"],
      ["fc00::1", "IPv6 unique-local"],
      ["fd00::1", "IPv6 unique-local (fd..)"],
      ["ff02::1", "IPv6 multicast"]
    ])("rejects at request time when host resolves to %s (%s)", async (ip) => {
      adapter.setHostResolverForTests(stubResolver({ "provider.example": [ip] }));
      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "ssrf_blocked_ip"
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects IPv4-mapped-in-IPv6 loopback (::ffff:127.0.0.1)", async () => {
      adapter.setHostResolverForTests(
        stubResolver({ "provider.example": ["::ffff:127.0.0.1"] })
      );
      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "ssrf_blocked_ip"
      );
    });

    it("passes when host resolves to a public IPv4", async () => {
      adapter.setHostResolverForTests(stubResolver({ "provider.example": ["8.8.8.8"] }));
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }));
      await adapter.autocomplete("q", "k", baseConfig);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("re-runs the guard on EVERY request (DNS-rebind defence)", async () => {
      // First invocation resolves to a public IP so the request goes out.
      // Second invocation — same baseUrl — resolves to a private IP and MUST
      // be blocked BEFORE fetch is called again. If the guard only ran once
      // at save-time, this test would pass fetch through and leak.
      let invocations = 0;
      adapter.setHostResolverForTests(async () => {
        invocations += 1;
        return invocations === 1 ? ["8.8.8.8"] : ["10.0.0.1"];
      });
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }));
      await adapter.autocomplete("q", "k", baseConfig);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "ssrf_blocked_ip"
      );
      // Fetch count MUST NOT have grown — the second call was blocked before
      // any network I/O.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("rejects a direct-IP baseUrl that is private", async () => {
      // Direct IPs bypass DNS but still get IP-checked.
      await expect(
        adapter.autocomplete("q", "k", { ...baseConfig, baseUrl: "https://10.0.0.1" })
      ).rejects.toThrow("ssrf_blocked_ip");
    });

    it("throws ssrf_dns_failure when DNS resolution errors", async () => {
      adapter.setHostResolverForTests(async () => {
        throw new Error("ENOTFOUND");
      });
      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "ssrf_dns_failure"
      );
    });
  });

  // ---------------------- redirects -------------------------------------

  describe("redirects", () => {
    it("does NOT follow redirects by default (3xx → thrown)", async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse(302, null, {
          headers: { Location: "https://other.example/x" },
          ok: false
        })
      );
      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "custom_rest_redirect_302"
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("follows a redirect to a public IP when followRedirects=true", async () => {
      adapter.setHostResolverForTests(
        stubResolver({
          "provider.example": ["8.8.8.8"],
          "other.example": ["8.8.4.4"]
        })
      );
      fetchSpy
        .mockResolvedValueOnce(
          makeResponse(302, null, {
            headers: { Location: "https://other.example/x" },
            ok: false
          })
        )
        .mockResolvedValueOnce(makeResponse(200, { features: [] }));
      const results = await adapter.autocomplete("q", "k", {
        ...baseConfig,
        followRedirects: true
      });
      expect(results).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("re-runs the IP allow-check on the redirect target and rejects private", async () => {
      adapter.setHostResolverForTests(
        stubResolver({
          "provider.example": ["8.8.8.8"],
          "internal.example": ["10.0.0.5"]
        })
      );
      fetchSpy.mockResolvedValueOnce(
        makeResponse(302, null, {
          headers: { Location: "https://internal.example/admin" },
          ok: false
        })
      );
      await expect(
        adapter.autocomplete("q", "k", { ...baseConfig, followRedirects: true })
      ).rejects.toThrow("ssrf_blocked_ip");
      // First fetch happened; second (redirect target) must NOT happen.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------- response mapping ------------------------------

  describe("response mapping", () => {
    it("maps a custom payload into GeoapifySuggestion (text only) for autocomplete", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [rawFeature] }));
      const results = await adapter.autocomplete("1 George", "k", baseConfig);
      expect(results).toHaveLength(1);
      const s = results[0];
      expect(s.formatted).toBe("1 George St, Brisbane City QLD 4000");
      expect(s.addressLine1).toBe("1 George St");
      expect(s.suburb).toBe("Brisbane City");
      expect(s.state).toBe("QLD");
      expect(s.postcode).toBe("4000");
      // Compliance §6: coords + place_id MUST be discarded.
      expect(s.lat).toBeNull();
      expect(s.lon).toBeNull();
      expect(s.placeId).toBeNull();
    });

    it("maps a custom payload for forward", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [rawFeature] }));
      const results = await adapter.forward("1 George", "k", baseConfig);
      expect(results).toHaveLength(1);
      expect(results[0].suburb).toBe("Brisbane City");
      expect(results[0].lat).toBeNull();
      expect(results[0].placeId).toBeNull();
    });

    it("maps a custom payload for reverse", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [rawFeature] }));
      const results = await adapter.reverse(-27.47, 153.03, "k", baseConfig);
      expect(results).toHaveLength(1);
      expect(results[0].formatted).toBe("1 George St, Brisbane City QLD 4000");
      expect(results[0].lon).toBeNull();
      expect(results[0].placeId).toBeNull();
    });

    it("returns [] when the responseShape.resultsPath resolves to a non-array", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: null }));
      const results = await adapter.autocomplete("q", "k", baseConfig);
      expect(results).toEqual([]);
    });

    it("sends the resolved API key using headerName + headerPrefix", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }));
      await adapter.autocomplete("q", "MY-KEY", {
        ...baseConfig,
        headerName: "X-Api-Key",
        headerPrefix: ""
      });
      const req = fetchSpy.mock.calls[0][1] as RequestInit;
      const headers = req.headers as Record<string, string>;
      expect(headers["X-Api-Key"]).toBe("MY-KEY");
    });
  });

  // ---------------------- fall-through table (chain-compatible) --------

  describe("fall-through error signals", () => {
    it("throws on non-2xx (chain treats as fall-through)", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(500, {}, { ok: false }));
      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "custom_rest_http_500"
      );
    });

    it("throws on 401 (chain treats as fall-through)", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(401, {}, { ok: false }));
      await expect(adapter.autocomplete("q", "k", baseConfig)).rejects.toThrow(
        "custom_rest_http_401"
      );
    });

    it("returns [] on empty results (chain treats as fall-through)", async () => {
      fetchSpy.mockResolvedValueOnce(makeResponse(200, { features: [] }));
      const results = await adapter.autocomplete("q", "k", baseConfig);
      expect(results).toEqual([]);
    });

    it("throws when baseUrl is missing", async () => {
      await expect(
        adapter.autocomplete("q", "k", { ...baseConfig, baseUrl: undefined })
      ).rejects.toThrow("custom_rest_missing_base_url");
    });
  });
});
