import { sanitiseProviderError } from "../error-sanitiser";

describe("sanitiseProviderError", () => {
  describe("category: auth", () => {
    it("categorises Anthropic 401 as auth", () => {
      const result = sanitiseProviderError("Anthropic API 401: unauthorized");
      expect(result.category).toBe("auth");
      expect(result.userMessage).toContain("authentication failed");
    });

    it("categorises OpenAI 401 as auth", () => {
      const result = sanitiseProviderError("OpenAI API 401: invalid api key");
      expect(result.category).toBe("auth");
    });

    it("categorises invalid_api_key keyword without status as auth", () => {
      const result = sanitiseProviderError(new Error("Bad: invalid_api_key supplied"));
      expect(result.category).toBe("auth");
    });

    it("categorises 403 as auth", () => {
      const result = sanitiseProviderError("Anthropic API 403: forbidden");
      expect(result.category).toBe("auth");
    });
  });

  describe("category: quota", () => {
    it("categorises Anthropic credit-balance error as quota even with 400 status", () => {
      const result = sanitiseProviderError(
        "Anthropic API 400: Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade."
      );
      expect(result.category).toBe("quota");
      expect(result.userMessage).toContain("quota exhausted");
    });

    it("categorises OpenAI insufficient_quota as quota (overrides 429 default)", () => {
      const result = sanitiseProviderError(
        'OpenAI API 429: {"error":{"code":"insufficient_quota","message":"You exceeded your quota."}}'
      );
      expect(result.category).toBe("quota");
    });

    it("categorises billing keyword as quota", () => {
      const result = sanitiseProviderError("Account billing issue: please upgrade");
      expect(result.category).toBe("quota");
    });
  });

  describe("category: rate-limit", () => {
    it("categorises plain 429 as rate-limit", () => {
      const result = sanitiseProviderError("Anthropic API 429: too many requests");
      expect(result.category).toBe("rate-limit");
      expect(result.userMessage).toContain("rate limit");
    });

    it("categorises rate_limit_exceeded keyword without status as rate-limit", () => {
      const result = sanitiseProviderError(new Error("oh no: rate_limit_exceeded"));
      expect(result.category).toBe("rate-limit");
    });
  });

  describe("category: server", () => {
    it("categorises 500 as server", () => {
      const result = sanitiseProviderError("Anthropic API 500: internal server error");
      expect(result.category).toBe("server");
      expect(result.userMessage).toContain("temporarily unavailable");
    });

    it("categorises 503 as server", () => {
      const result = sanitiseProviderError("OpenAI API 503: service unavailable");
      expect(result.category).toBe("server");
    });

    it("categorises 502 as server", () => {
      const result = sanitiseProviderError("Anthropic API 502: bad gateway");
      expect(result.category).toBe("server");
    });
  });

  describe("category: network", () => {
    it("categorises ECONNREFUSED as network", () => {
      const result = sanitiseProviderError("Network error: ECONNREFUSED");
      expect(result.category).toBe("network");
      expect(result.userMessage).toContain("Could not reach");
    });

    it("categorises ETIMEDOUT as network", () => {
      const result = sanitiseProviderError(new Error("connect ETIMEDOUT 1.2.3.4:443"));
      expect(result.category).toBe("network");
    });

    it("categorises ENOTFOUND as network", () => {
      const result = sanitiseProviderError("getaddrinfo ENOTFOUND api.anthropic.com");
      expect(result.category).toBe("network");
    });

    it("categorises stream read errors as network", () => {
      const result = sanitiseProviderError("Stream read error: socket closed");
      expect(result.category).toBe("network");
    });
  });

  describe("category: unknown", () => {
    it("falls back to unknown for arbitrary messages", () => {
      const result = sanitiseProviderError(new Error("Something went sideways"));
      expect(result.category).toBe("unknown");
      expect(result.userMessage).toContain("error occurred");
    });

    it("handles null/undefined gracefully", () => {
      expect(sanitiseProviderError(null).category).toBe("unknown");
      expect(sanitiseProviderError(undefined).category).toBe("unknown");
    });

    it("handles non-Error objects gracefully", () => {
      const result = sanitiseProviderError({ random: "shape" });
      expect(result.category).toBe("unknown");
    });
  });

  describe("user message safety", () => {
    it("never returns a user message containing HTML metacharacters from input", () => {
      // Even if an attacker controlled a provider's error response and filled
      // it with HTML, the user message comes from a hardcoded list — never
      // from the input. This test enforces that property at the boundary.
      const malicious = '<script>alert(1)</script><img src=x onerror="alert(2)">';
      const result = sanitiseProviderError(new Error(malicious));
      expect(result.userMessage).not.toContain("<");
      expect(result.userMessage).not.toContain(">");
      expect(result.userMessage).not.toContain("script");
      expect(result.userMessage).not.toContain("onerror");
    });

    it("never returns a user message containing SSE separators", () => {
      // Defence: a malicious error containing \n\n could break SSE framing.
      const result = sanitiseProviderError(new Error("foo\n\ndata: { malicious }\n\n"));
      expect(result.userMessage).not.toContain("\n\n");
      expect(result.userMessage).not.toContain("data:");
    });

    it("user message is one of the six categorised constants", () => {
      const allCategories = ["auth", "rate-limit", "quota", "server", "network", "unknown"];
      for (const input of [
        "Anthropic API 401",
        "Anthropic API 429",
        "credit balance is too low",
        "Anthropic API 503",
        "ECONNREFUSED",
        "random nonsense"
      ]) {
        const result = sanitiseProviderError(input);
        expect(allCategories).toContain(result.category);
      }
    });
  });

  describe("log message preservation", () => {
    it("preserves the full original error text in logMessage for debugging", () => {
      const text = "Anthropic API 400: Your credit balance is too low to access the Anthropic API.";
      const result = sanitiseProviderError(text);
      expect(result.logMessage).toBe(text);
    });

    it("truncates absurdly long error text at 1000 chars", () => {
      const text = "x".repeat(5000);
      const result = sanitiseProviderError(text);
      expect(result.logMessage.length).toBeLessThanOrEqual(1000);
    });

    it("extracts message from Error instances", () => {
      const result = sanitiseProviderError(new Error("clear text"));
      expect(result.logMessage).toBe("clear text");
    });

    it("stringifies non-Error objects rather than printing [object Object]", () => {
      const result = sanitiseProviderError({ status: 500, body: "x" });
      expect(result.logMessage).not.toBe("[object Object]");
      expect(result.logMessage).toContain("500");
    });
  });
});
