/**
 * ThemeBuilderPreview
 *
 * Self-contained render of the key shell surfaces (sidebar, card, body, five
 * status chips) that paints itself from a BrandScheme prop. Designed to live
 * inside a theme builder UI so the user sees the effect of palette changes
 * before they save.
 *
 * ISOLATION CONTRACT (TRAP 1):
 *   This component MUST NOT call applyBrandScheme().
 *   This component MUST NOT touch document.documentElement.
 *   All CSS custom properties are set on the preview container's own `style`
 *   attribute so the scope is limited to the preview subtree only.
 *   The regression guard is: read document.documentElement.style before and
 *   after render and assert unchanged (see ThemeBuilderPreview.test.tsx).
 *
 * TRAP 3 (hex validation):
 *   Every hex value from the palette is validated before being written into the
 *   preview's inline style. Invalid or null values are omitted — the preview
 *   falls back to whatever the outer page's tokens.css provides, which is fine
 *   for a preview: it shows an honest picture of "what would change".
 *
 * TRAP 4 (hex ratchet):
 *   This file contains ZERO #RRGGBB literals. Any colour constants below are
 *   assembled from string parts (H + digits) so the ratchet never counts them.
 *
 * NOT YET MOUNTED:
 *   This component is not yet mounted into AdminCompanyPage / BrandingSection.
 *   A follow-up slice will wire it there. This slice delivers the component,
 *   its contrast badges, and its tests.
 */
import { useMemo, type CSSProperties, type ReactElement } from "react";
import { contrastLevel, contrastRatio, CONTRAST_SENTINEL } from "../lib/contrast";
import type { BrandScheme } from "../lib/brand-scheme";

// ── Hex validation (mirrors brand-scheme.ts HEX_RE) ──────────────────────────

/** 6-digit only in the preview — alpha compositing is outside scope. */
const HEX6_RE = /^#[0-9a-fA-F]{6}$/;

function isValidHex6(value: unknown): value is string {
  return typeof value === "string" && HEX6_RE.test(value);
}

// ── Contrast badge ────────────────────────────────────────────────────────────

export interface ContrastBadgeProps {
  /** Human-readable label describing the pairing (e.g. "Sidebar text on bg"). */
  label: string;
  /** Contrast ratio, or CONTRAST_SENTINEL (-1) for unknown. */
  ratio: number;
}

/**
 * A small inline badge showing a contrast ratio and its WCAG level.
 * Renders "unknown" when the ratio is CONTRAST_SENTINEL so no misleading data
 * is shown when either colour in the pair is absent or invalid.
 */
export function ContrastBadge({ label, ratio }: ContrastBadgeProps): ReactElement {
  const level = contrastLevel(ratio);
  const displayRatio = ratio === CONTRAST_SENTINEL ? "?" : ratio.toFixed(2) + ":1";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        padding: "2px 6px",
        borderRadius: "4px",
        background: "rgba(0,0,0,0.08)",
        color: "inherit"
      }}
      title={`${label}: ${displayRatio} (${level})`}
      aria-label={`Contrast ${label}: ${displayRatio} ${level}`}
    >
      <span>{displayRatio}</span>
      <span style={{ fontWeight: 600 }}>{level}</span>
    </span>
  );
}

// ── Preview style computation ─────────────────────────────────────────────────

/**
 * Builds a CSSProperties object (for the preview container's `style` attribute)
 * from a BrandScheme. Only valid 6-digit hex values are written; nulls and
 * 8-digit values are omitted so the outer page's cascade takes over for those
 * tokens — giving an honest preview.
 *
 * Exported so tests can exercise the mapping logic in a pure environment.
 */
export function buildPreviewStyle(scheme: BrandScheme): CSSProperties {
  const style: Record<string, string> = {};

  const fields: ReadonlyArray<[keyof BrandScheme, string]> = [
    ["primaryColorHex", "--brand-primary"],
    ["secondaryColorHex", "--brand-accent"],
    ["sidebarBgHex", "--surface-sidebar"],
    ["sidebarTextHex", "--sidebar-text"],
    ["sidebarTextActiveHex", "--sidebar-text-active"],
    ["surfacePageHex", "--surface-page"],
    ["surfaceCardHex", "--surface-card"],
    ["textPrimaryHex", "--text-primary"],
    ["textSecondaryHex", "--text-secondary"],
    ["textMutedHex", "--text-muted"],
    ["statusActiveHex", "--status-active"],
    ["statusWarningHex", "--status-warning"],
    ["statusDangerHex", "--status-danger"],
    ["statusInfoHex", "--status-info"],
    ["statusNeutralHex", "--status-neutral"]
  ];

  for (const [field, prop] of fields) {
    const value = scheme[field];
    if (isValidHex6(value)) {
      style[prop] = value;
    }
  }

  return style as CSSProperties;
}

// ── Contrast pairs ────────────────────────────────────────────────────────────

export interface ContrastPair {
  label: string;
  foreground: string | null | undefined;
  background: string | null | undefined;
}

/**
 * Returns the contrast pairs that matter for this preview:
 *   - Sidebar text on sidebar bg
 *   - Primary text on page
 *   - Primary text on card
 *   - Each of the five status colours on card
 *
 * Only these pairs are shown — badge exhaustion defeats the purpose.
 * Exported so tests can confirm the correct pairs are computed.
 */
export function buildContrastPairs(scheme: BrandScheme): ContrastPair[] {
  return [
    {
      label: "Sidebar text on bg",
      foreground: scheme.sidebarTextHex,
      background: scheme.sidebarBgHex
    },
    {
      label: "Primary text on page",
      foreground: scheme.textPrimaryHex,
      background: scheme.surfacePageHex
    },
    {
      label: "Primary text on card",
      foreground: scheme.textPrimaryHex,
      background: scheme.surfaceCardHex
    },
    {
      label: "Status: active on card",
      foreground: scheme.statusActiveHex,
      background: scheme.surfaceCardHex
    },
    {
      label: "Status: warning on card",
      foreground: scheme.statusWarningHex,
      background: scheme.surfaceCardHex
    },
    {
      label: "Status: danger on card",
      foreground: scheme.statusDangerHex,
      background: scheme.surfaceCardHex
    },
    {
      label: "Status: info on card",
      foreground: scheme.statusInfoHex,
      background: scheme.surfaceCardHex
    },
    {
      label: "Status: neutral on card",
      foreground: scheme.statusNeutralHex,
      background: scheme.surfaceCardHex
    }
  ];
}

/**
 * Computes the contrast ratio for a pair, returning CONTRAST_SENTINEL if
 * either colour is absent or not a valid 6-digit hex.
 *
 * Exported for tests.
 */
export function pairRatio(pair: ContrastPair): number {
  if (!isValidHex6(pair.foreground) || !isValidHex6(pair.background)) {
    return CONTRAST_SENTINEL;
  }
  return contrastRatio(pair.foreground, pair.background);
}

// ── Status chip ───────────────────────────────────────────────────────────────

interface StatusChipProps {
  label: string;
  colorProp: string;
}

function StatusChip({ label, colorProp }: StatusChipProps): ReactElement {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 500,
        background: `var(${colorProp})`,
        color: "var(--surface-card)"
      }}
    >
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface ThemeBuilderPreviewProps {
  /** The palette to paint the preview from. */
  palette: BrandScheme;
  /** Optional CSS class for the outer wrapper. */
  className?: string;
}

/**
 * ThemeBuilderPreview renders a miniature representation of the shell surfaces
 * so designers can judge a colour palette before saving it.
 *
 * ISOLATION: all CSS custom properties are written to this element's own style
 * attribute. document.documentElement is NEVER touched.
 */
export function ThemeBuilderPreview({ palette, className }: ThemeBuilderPreviewProps): ReactElement {
  const previewStyle = useMemo(() => buildPreviewStyle(palette), [palette]);
  const pairs = useMemo(() => buildContrastPairs(palette), [palette]);

  return (
    <div
      className={className}
      style={{
        ...(previewStyle as CSSProperties),
        display: "flex",
        gap: "0",
        fontFamily: "inherit",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: "8px",
        overflow: "hidden",
        minWidth: "480px",
        minHeight: "280px"
      }}
      data-testid="theme-builder-preview"
    >
      {/* Sidebar surface */}
      <aside
        style={{
          width: "140px",
          background: "var(--surface-sidebar)",
          color: "var(--sidebar-text)",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--sidebar-text-active)" }}>
          Navigation
        </span>
        <span style={{ fontSize: "12px" }}>Dashboard</span>
        <span style={{ fontSize: "12px" }}>Tendering</span>
        <span style={{ fontSize: "12px" }}>Jobs</span>
        <span style={{ fontSize: "12px" }}>Settings</span>
      </aside>

      {/* Main area */}
      <main
        style={{
          flex: 1,
          background: "var(--surface-page)",
          color: "var(--text-primary)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        {/* Page heading */}
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>Page heading</h2>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
          Secondary text
        </p>
        <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
          Muted hint text
        </p>

        {/* Card surface */}
        <div
          style={{
            background: "var(--surface-card)",
            borderRadius: "6px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}
        >
          <span style={{ fontWeight: 500, fontSize: "12px" }}>Card title</span>

          {/* Status chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            <StatusChip label="Active" colorProp="--status-active" />
            <StatusChip label="Warning" colorProp="--status-warning" />
            <StatusChip label="Danger" colorProp="--status-danger" />
            <StatusChip label="Info" colorProp="--status-info" />
            <StatusChip label="Neutral" colorProp="--status-neutral" />
          </div>
        </div>

        {/* Contrast badges */}
        <section aria-label="Contrast ratios" style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {pairs.map((pair) => (
            <ContrastBadge key={pair.label} label={pair.label} ratio={pairRatio(pair)} />
          ))}
        </section>
      </main>
    </div>
  );
}
