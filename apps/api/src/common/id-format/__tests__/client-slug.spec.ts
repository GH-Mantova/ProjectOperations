import { brisbaneYYMMDD, clientSlug, FALLBACK_SLUG } from "../client-slug";

describe("clientSlug", () => {
  it("takes the first 4 alphanumeric characters, uppercased", () => {
    expect(clientSlug("Acme Infrastructure")).toBe("ACME");
    expect(clientSlug("QLD Roads Authority")).toBe("QLDR");
    expect(clientSlug("Brisbane City Council")).toBe("BRIS");
    expect(clientSlug("Queensland Transport Infrastructure")).toBe("QUEE");
  });

  it("keeps digits", () => {
    expect(clientSlug("3D Construction")).toBe("3DCO");
  });

  it("returns shorter slugs for short names without padding", () => {
    expect(clientSlug("Bob")).toBe("BOB");
    expect(clientSlug("A B")).toBe("AB");
  });

  it("strips punctuation and symbols", () => {
    expect(clientSlug("O'Brien & Sons Pty Ltd")).toBe("OBRI");
    expect(clientSlug("J.J. Civil")).toBe("JJCI");
  });

  it("returns an empty slug for empty or all-symbol input", () => {
    expect(clientSlug("")).toBe("");
    expect(clientSlug("!!! ---")).toBe("");
  });

  it("exports the XXXX fallback for clientless tenders", () => {
    expect(FALLBACK_SLUG).toBe("XXXX");
  });
});

describe("brisbaneYYMMDD", () => {
  it("formats a UTC date in Brisbane local time (UTC+10)", () => {
    // 2026-06-05T20:00:00Z is 2026-06-06 06:00 in Brisbane.
    expect(brisbaneYYMMDD(new Date("2026-06-05T20:00:00.000Z"))).toBe("260606");
  });

  it("formats midday UTC on the same Brisbane day", () => {
    expect(brisbaneYYMMDD(new Date("2026-06-05T02:00:00.000Z"))).toBe("260605");
  });

  it("zero-pads single-digit months and days", () => {
    expect(brisbaneYYMMDD(new Date("2026-01-02T00:00:00.000Z"))).toBe("260102");
  });
});
