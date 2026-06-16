import {
  buildReferenceKey,
  cleanSubject,
  embedReference,
  extractReferenceKey,
  parseInbound
} from "../reply-matcher";

describe("reply-matcher", () => {
  describe("buildReferenceKey", () => {
    it("returns a non-empty token", () => {
      const key = buildReferenceKey();
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThanOrEqual(6);
    });
    it("returns distinct values on consecutive calls", () => {
      expect(buildReferenceKey()).not.toEqual(buildReferenceKey());
    });
  });

  describe("embedReference", () => {
    it("appends [ref:<key>] to a clean subject", () => {
      expect(embedReference("Quote follow-up", "abc123")).toBe("Quote follow-up [ref:abc123]");
    });
    it("does not double-embed when the subject already carries a ref token", () => {
      const already = "Re: Quote follow-up [ref:abc123]";
      expect(embedReference(already, "ignored")).toBe(already);
    });
  });

  describe("extractReferenceKey", () => {
    it("pulls the key out of a Re: reply subject", () => {
      expect(extractReferenceKey("Re: Quote follow-up [ref:abc123]")).toBe("abc123");
    });
    it("matches case-insensitively but normalises to lowercase", () => {
      expect(extractReferenceKey("Re: things [REF:ABC123]")).toBe("abc123");
    });
    it("returns null when no token is present", () => {
      expect(extractReferenceKey("Re: a plain reply")).toBeNull();
    });
    it("rejects too-short tokens (less than 6 chars)", () => {
      expect(extractReferenceKey("[ref:short]")).toBeNull();
    });
  });

  describe("cleanSubject", () => {
    it("strips the ref token and collapses whitespace", () => {
      expect(cleanSubject("Quote follow-up [ref:abc123]")).toBe("Quote follow-up");
    });
  });

  describe("parseInbound", () => {
    it("attaches the extracted referenceKey to the raw envelope", () => {
      const parsed = parseInbound({
        from: "client@example.com",
        subject: "Re: Quote follow-up [ref:abc123]",
        bodyText: "Sounds good."
      });
      expect(parsed.referenceKey).toBe("abc123");
      expect(parsed.from).toBe("client@example.com");
    });
    it("returns null referenceKey when the inbound subject is unrelated", () => {
      const parsed = parseInbound({
        from: "spam@example.com",
        subject: "Unrelated mail",
        bodyText: "Hi"
      });
      expect(parsed.referenceKey).toBeNull();
    });
  });
});
