// SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — tests for the LineMarkupCell
// shared component.
//
// Pattern: pure helpers and static-markup assertions, no jsdom.
// Any claim about a number → pure helper.
// Any claim about the DOM → renderToStaticMarkup.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LineMarkupCell,
  SCOPE_LINE_MARKUP_ALL_TYPES_V1,
  hasLineMarkupOverride
} from "../LineMarkupCell";

// ── hasLineMarkupOverride ────────────────────────────────────────────────

describe("hasLineMarkupOverride", () => {
  it("null → not overridden", () => {
    expect(hasLineMarkupOverride(null)).toBe(false);
  });

  it("undefined → not overridden", () => {
    expect(hasLineMarkupOverride(undefined)).toBe(false);
  });

  it("0 → overridden (stored 0 is a real override)", () => {
    expect(hasLineMarkupOverride(0)).toBe(true);
  });

  it("12.5 → overridden", () => {
    expect(hasLineMarkupOverride(12.5)).toBe(true);
  });
});

// ── SCOPE_LINE_MARKUP_ALL_TYPES_V1 marker ───────────────────────────────

describe("SCOPE_LINE_MARKUP_ALL_TYPES_V1 marker", () => {
  it("is exported from LineMarkupCell", () => {
    expect(SCOPE_LINE_MARKUP_ALL_TYPES_V1).toBe("scopecards-s3");
  });
});

// ── Inherited state (dashed border, placeholder) ────────────────────────

describe("LineMarkupCell — inherited (no override)", () => {
  it("renders with dashed border when no override", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={null}
        effectiveMarkup={30}
        inheritedPhrase="the card's cutting markup"
        onPatch={() => undefined}
      />
    );
    expect(html).toContain("dashed");
    expect(html).toContain('data-overridden="false"');
  });

  it("sets placeholder to effectiveMarkup", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={null}
        effectiveMarkup={25}
        inheritedPhrase="the card's waste markup"
        onPatch={() => undefined}
      />
    );
    expect(html).toContain('placeholder="25"');
  });

  it("does NOT render the reset button when inheriting", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={null}
        effectiveMarkup={30}
        inheritedPhrase="the card's markup"
        onPatch={() => undefined}
      />
    );
    expect(html).not.toContain('data-testid="line-markup-reset"');
  });
});

// ── Overridden state (amber fill) ────────────────────────────────────────

describe("LineMarkupCell — overridden", () => {
  it("renders amber fill when override set", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={25}
        effectiveMarkup={25}
        inheritedPhrase="the card's cutting markup"
        onPatch={() => undefined}
      />
    );
    expect(html).toContain("surface-override");
    expect(html).toContain('data-overridden="true"');
  });

  it("renders the reset button (↺) when overridden", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={25}
        effectiveMarkup={25}
        inheritedPhrase="the card's markup"
        onPatch={() => undefined}
      />
    );
    expect(html).toContain('data-testid="line-markup-reset"');
    expect(html).toContain("↺"); // ↺
  });

  it("stored 0 is rendered as overridden (0 is NOT absence)", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={0}
        effectiveMarkup={0}
        inheritedPhrase="the card's markup"
        onPatch={() => undefined}
      />
    );
    expect(html).toContain('data-overridden="true"');
    expect(html).toContain("surface-override");
  });

  it("renders % suffix", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={15}
        effectiveMarkup={15}
        inheritedPhrase="the card's markup"
        onPatch={() => undefined}
      />
    );
    expect(html).toContain("%");
  });
});

// ── reset PATCHes { markupOverride: null } ──────────────────────────────
// Note: can't test click handlers in static-markup world.
// We test the shape by checking aria-label on the reset button.

describe("LineMarkupCell — reset button", () => {
  it("reset button has aria-label 'Reset to section default'", () => {
    const html = renderToStaticMarkup(
      <LineMarkupCell
        markupOverride={25}
        effectiveMarkup={25}
        inheritedPhrase="the card's markup"
        onPatch={() => undefined}
      />
    );
    expect(html).toContain("Reset to section default");
  });
});
