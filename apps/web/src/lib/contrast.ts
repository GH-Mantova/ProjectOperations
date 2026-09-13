/**
 * WCAG 2.x contrast utilities.
 *
 * Exports:
 *   contrastRatio(hexA, hexB) — returns the WCAG contrast ratio between two
 *     hex colours, or CONTRAST_SENTINEL on unparseable input.
 *   contrastLevel(ratio)      — maps a ratio to AAA / AA / AA Large / Fail,
 *     or "unknown" for CONTRAST_SENTINEL.
 *
 * TRAP 3: every hex path re-validates before use; sentinel on failure, never
 * throw, never NaN. A badge that lies is worse than no badge.
 *
 * TRAP 4 (hex ratchet): this file contains ZERO #RRGGBB literals. All colour
 * values produced at runtime are received from callers, not defined here.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Sentinel value returned (and accepted) when a hex string cannot be parsed. */
export const CONTRAST_SENTINEL = -1 as const;

/** Hex guard: exactly 6 hex digits after the `#`. Eight-digit RRGGBBAA is NOT
 *  accepted here — the contrast pair reads colours as they appear on screen,
 *  and alpha compositing is outside scope. The caller must supply the resolved
 *  opaque colour. */
const HEX6_RE = /^#[0-9a-fA-F]{6}$/;

// ── WCAG relative luminance ───────────────────────────────────────────────────

/**
 * Parses a 6-digit hex string into [r, g, b] in the [0, 1] linear-light range.
 * Returns null if the input is not a valid 6-digit hex string.
 */
function hexToLinearChannels(hex: string): [number, number, number] | null {
  if (!HEX6_RE.test(hex)) return null;

  const r8 = parseInt(hex.slice(1, 3), 16);
  const g8 = parseInt(hex.slice(3, 5), 16);
  const b8 = parseInt(hex.slice(5, 7), 16);

  return [toLinear(r8 / 255), toLinear(g8 / 255), toLinear(b8 / 255)];
}

/**
 * Converts an sRGB channel in [0, 1] to linear light.
 * WCAG 2.x formula (IEC 61966-2-1).
 */
function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG 2.x relative luminance from linear-light RGB channels.
 * L = 0.2126 R + 0.7152 G + 0.0722 B
 */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Computes the WCAG 2.x contrast ratio between two opaque hex colours.
 *
 * Returns a value in [1, 21] when both inputs are valid 6-digit hex strings.
 * Returns CONTRAST_SENTINEL (-1) when either input is unparseable — the
 * caller must check for the sentinel before displaying the result.
 *
 * The ratio is always returned as (lighter + 0.05) / (darker + 0.05), so the
 * returned value is >= 1 regardless of argument order.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const chA = hexToLinearChannels(hexA);
  const chB = hexToLinearChannels(hexB);

  if (chA === null || chB === null) return CONTRAST_SENTINEL;

  const lumA = relativeLuminance(...chA);
  const lumB = relativeLuminance(...chB);

  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  return (lighter + 0.05) / (darker + 0.05);
}

// ── Level mapping ─────────────────────────────────────────────────────────────

/** WCAG 2.x conformance level labels. */
export type ContrastLevel = "AAA" | "AA" | "AA Large" | "Fail" | "unknown";

/**
 * Maps a contrast ratio to a WCAG 2.x conformance level.
 *
 * WCAG thresholds (WCAG 2.x §1.4.3 / §1.4.6):
 *   >= 7    : AAA (enhanced)
 *   >= 4.5  : AA (minimum for normal text)
 *   >= 3    : AA Large (minimum for large text / UI components)
 *   <  3    : Fail
 *
 * Accepts CONTRAST_SENTINEL and returns "unknown" — the badge must never
 * render a misleading level for an unmeasured pair.
 */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio === CONTRAST_SENTINEL) return "unknown";
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}
