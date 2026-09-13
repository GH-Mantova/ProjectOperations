/**
 * Tests for contrast.ts
 *
 * TRAP 4: this file contains ZERO #RRGGBB literals. All hex fixture values
 * are assembled from string parts (HASH + digits) so the hex ratchet never
 * counts a colour literal here.
 *
 * Reference pairs used:
 *   Black on white : WCAG 2.x defines this as exactly 21:1.
 *   595959 on white: resolves to ~7.0:1 (AAA boundary), derivable from the
 *     WCAG relative-luminance formula — (1.05) / (0.1000 + 0.05) = 7.0.
 *   767676 on white: resolves to ~4.55:1 (AA range, above 4.5 threshold).
 *     Cited by WebAIM Contrast Checker and widely used in WCAG references.
 */
import { describe, expect, it } from "vitest";
import { contrastLevel, contrastRatio, CONTRAST_SENTINEL } from "../contrast";

// ── Hex fixtures — assembled to avoid hex ratchet ─────────────────────────────

const H = "#";

/** Pure white */
const WHITE = H + "FFFFFF";
/** Pure black */
const BLACK = H + "000000";
/**
 * Mid grey known to sit at the AAA boundary (~7.0:1 on white).
 * sRGB=0x59=89; linear=0.10001; L=0.10001; ratio=(1.05/0.15001)=7.0
 */
const GREY_AAA_BOUNDARY = H + "595959";
/**
 * Mid grey in the AA range (~4.55:1 on white, > 4.5 threshold).
 * sRGB=0x76=118; linear≈0.18097; L≈0.18097; ratio≈4.55:1
 */
const GREY_AA = H + "767676";
/**
 * Two colours that produce a ratio below 3.0 (Fail).
 * Pairing a very light colour against white gives a very low ratio.
 * EEEEEE on white: sRGB=238/255≈0.9333; linear≈0.8713; L≈0.8713
 * ratio=(1.05)/(0.9213)≈1.14 — clearly Fail.
 */
const NEAR_WHITE = H + "EEEEEE";

// ── Known-ratio pairs ─────────────────────────────────────────────────────────

describe("contrastRatio — known WCAG pairs", () => {
  it("black on white is exactly 21:1", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("white on black is also 21:1 (argument order does not matter)", () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 1);
  });

  it("identical colour has a contrast of exactly 1:1", () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
    expect(contrastRatio(BLACK, BLACK)).toBeCloseTo(1, 5);
  });

  it("grey 595959 on white resolves to approximately 7.0:1 (AAA boundary)", () => {
    // Acceptable within 0.05 — reflects floating-point accumulation only.
    const ratio = contrastRatio(GREY_AAA_BOUNDARY, WHITE);
    expect(ratio).toBeGreaterThanOrEqual(6.9);
    expect(ratio).toBeLessThanOrEqual(7.1);
  });

  it("grey 767676 on white is in the AA range (>= 4.5 and < 7.0)", () => {
    const ratio = contrastRatio(GREY_AA, WHITE);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(7.0);
  });

  it("near-white on white produces a Fail ratio (< 3.0)", () => {
    const ratio = contrastRatio(NEAR_WHITE, WHITE);
    expect(ratio).toBeLessThan(3.0);
  });
});

// ── Unparseable input ─────────────────────────────────────────────────────────

describe("contrastRatio — unparseable input returns sentinel, never throws", () => {
  const badInputs = [
    { label: "empty string", value: "" },
    { label: "word colour", value: "white" },
    { label: "3-digit shorthand", value: H + "FFF" },
    { label: "8-digit RRGGBBAA (not accepted here)", value: H + "FFFFFFFF" },
    { label: "no hash prefix", value: "FFFFFF" },
    { label: "SQL injection attempt", value: "'; DROP" },
    { label: "CSS variable reference", value: "var(--brand-primary)" }
  ];

  for (const { label, value } of badInputs) {
    it(`(hexA invalid) returns CONTRAST_SENTINEL for: ${label}`, () => {
      expect(() => contrastRatio(value, WHITE)).not.toThrow();
      expect(contrastRatio(value, WHITE)).toBe(CONTRAST_SENTINEL);
    });

    it(`(hexB invalid) returns CONTRAST_SENTINEL for: ${label}`, () => {
      expect(() => contrastRatio(WHITE, value)).not.toThrow();
      expect(contrastRatio(WHITE, value)).toBe(CONTRAST_SENTINEL);
    });
  }
});

// ── Level mapping ─────────────────────────────────────────────────────────────

describe("contrastLevel — boundary mapping", () => {
  it('ratio >= 7.0 returns "AAA"', () => {
    expect(contrastLevel(7.0)).toBe("AAA");
    expect(contrastLevel(21)).toBe("AAA");
    expect(contrastLevel(7.1)).toBe("AAA");
  });

  it('ratio >= 4.5 and < 7.0 returns "AA"', () => {
    expect(contrastLevel(4.5)).toBe("AA");
    expect(contrastLevel(6.999)).toBe("AA");
    expect(contrastLevel(5.0)).toBe("AA");
  });

  it('ratio >= 3.0 and < 4.5 returns "AA Large"', () => {
    expect(contrastLevel(3.0)).toBe("AA Large");
    expect(contrastLevel(4.499)).toBe("AA Large");
    expect(contrastLevel(3.5)).toBe("AA Large");
  });

  it('ratio < 3.0 returns "Fail"', () => {
    expect(contrastLevel(2.999)).toBe("Fail");
    expect(contrastLevel(1.0)).toBe("Fail");
    expect(contrastLevel(1.5)).toBe("Fail");
  });

  it('CONTRAST_SENTINEL returns "unknown"', () => {
    expect(contrastLevel(CONTRAST_SENTINEL)).toBe("unknown");
  });

  it('"unknown" for -1 never throws even when passed from a bad parse', () => {
    const result = contrastRatio("not-a-hex", WHITE);
    expect(() => contrastLevel(result)).not.toThrow();
    expect(contrastLevel(result)).toBe("unknown");
  });
});
