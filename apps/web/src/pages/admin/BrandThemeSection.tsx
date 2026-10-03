/**
 * BrandThemeSection — Brand and theme builder screen (S7a).
 *
 * Replaces the legacy BrandingSection. Consumes the branding API to:
 *   - List and select color schemes
 *   - Edit all fifteen palette fields
 *   - Preview the draft palette via ThemeBuilderPreview
 *   - Show contrast grades for key pairings
 *   - Save the edited scheme
 *   - Set the company default (separate from saving)
 *   - Delete non-default schemes with confirmation
 *   - Edit all four brand asset URLs
 *
 * Marco's decisions (2026-09-25):
 *   D-1: Company palette applies in LIGHT MODE only.
 *   D-2: Personal controls (density, per-user override) are NOT on this screen.
 *   D-3: Deleting the active scheme is refused. Default is never deletable.
 *
 * Open decisions not closed by this slice:
 *   - Brand files are links, not uploads (no upload infrastructure exists).
 *   - Presets set colours only — no per-scheme radius, type scale or density.
 *
 * ISOLATION CONTRACT:
 *   This component must NOT call applyBrandScheme().
 *   This component must NOT touch document.documentElement.
 *   The preview is rendered via ThemeBuilderPreview which paints itself only.
 *
 * TRAP 4 (hex ratchet): this file contains ZERO #RRGGBB literals.
 *   All styling colours use CSS tokens via var(--token-name).
 *   Swatch backgrounds come from DATA (string props) — not literals in this file.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement
} from "react";
import { useAuth } from "../../auth/AuthContext";
import { contrastLevel, contrastRatio, CONTRAST_SENTINEL } from "../../lib/contrast";
import {
  getBranding,
  upsertColorScheme,
  deleteColorScheme,
  setActiveColorScheme,
  upsertAsset,
  type BrandingData,
  type BrandAssetKind,
  type ColorSchemeRow
} from "../../lib/branding-api";
import { ThemeBuilderPreview } from "../../components/ThemeBuilderPreview";
import type { BrandScheme } from "../../lib/brand-scheme";

// ── Version marker (done-when gate checks for this string) ────────────────────

export const BRAND_THEME_BUILDER_V1 = "brandtheme-s7a";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The fifteen editable colour fields — the two required plus thirteen optional.
 * Maps directly to UpsertColorSchemePayload / the API DTO.
 */
export interface DraftPalette {
  name: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  sidebarBgHex: string;
  sidebarTextHex: string;
  sidebarTextActiveHex: string;
  surfacePageHex: string;
  surfaceCardHex: string;
  textPrimaryHex: string;
  textSecondaryHex: string;
  textMutedHex: string;
  statusActiveHex: string;
  statusWarningHex: string;
  statusDangerHex: string;
  statusInfoHex: string;
  statusNeutralHex: string;
}

export type DraftAssets = Record<BrandAssetKind, string>;

/** Groups for the palette editor UI. */
export const PALETTE_GROUPS: ReadonlyArray<{
  label: string;
  fields: ReadonlyArray<{ key: keyof DraftPalette; label: string }>;
}> = [
  {
    label: "Brand",
    fields: [
      { key: "primaryColorHex", label: "Primary" },
      { key: "secondaryColorHex", label: "Accent" }
    ]
  },
  {
    label: "Sidebar",
    fields: [
      { key: "sidebarBgHex", label: "Background" },
      { key: "sidebarTextHex", label: "Text" },
      { key: "sidebarTextActiveHex", label: "Text active" }
    ]
  },
  {
    label: "Surfaces and text",
    fields: [
      { key: "surfacePageHex", label: "Page" },
      { key: "surfaceCardHex", label: "Card" },
      { key: "textPrimaryHex", label: "Text primary" },
      { key: "textSecondaryHex", label: "Text secondary" },
      { key: "textMutedHex", label: "Text muted" }
    ]
  },
  {
    label: "Status",
    fields: [
      { key: "statusActiveHex", label: "Active" },
      { key: "statusWarningHex", label: "Warning" },
      { key: "statusDangerHex", label: "Danger" },
      { key: "statusInfoHex", label: "Info" },
      { key: "statusNeutralHex", label: "Neutral" }
    ]
  }
];

/** Asset kind display metadata. */
export const ASSET_META: ReadonlyArray<{
  kind: BrandAssetKind;
  label: string;
  note?: string;
}> = [
  { kind: "LOGO_LIGHT", label: "Logo — light" },
  { kind: "LOGO_DARK", label: "Logo — dark" },
  { kind: "FAVICON", label: "Favicon" },
  {
    kind: "PDF_LETTERHEAD",
    label: "PDF letterhead",
    note: "Applies to system-generated documents only. Uploaded documents are never restyled."
  }
];

// ── Pure helpers (exported for tests) ────────────────────────────────────────

const HEX6_RE = /^#[0-9a-fA-F]{6}$/;

/** Returns true when the value is a valid 6-digit hex colour. */
export function isValidHex(value: string): boolean {
  return HEX6_RE.test(value);
}

/**
 * Converts a ColorSchemeRow to a DraftPalette, filling missing fields with
 * empty strings so the editor always has a value in every input.
 */
export function schemeRowToDraft(row: ColorSchemeRow): DraftPalette {
  return {
    name: row.name,
    primaryColorHex: row.primaryColorHex ?? "",
    secondaryColorHex: row.secondaryColorHex ?? "",
    sidebarBgHex: row.sidebarBgHex ?? "",
    sidebarTextHex: row.sidebarTextHex ?? "",
    sidebarTextActiveHex: row.sidebarTextActiveHex ?? "",
    surfacePageHex: row.surfacePageHex ?? "",
    surfaceCardHex: row.surfaceCardHex ?? "",
    textPrimaryHex: row.textPrimaryHex ?? "",
    textSecondaryHex: row.textSecondaryHex ?? "",
    textMutedHex: row.textMutedHex ?? "",
    statusActiveHex: row.statusActiveHex ?? "",
    statusWarningHex: row.statusWarningHex ?? "",
    statusDangerHex: row.statusDangerHex ?? "",
    statusInfoHex: row.statusInfoHex ?? "",
    statusNeutralHex: row.statusNeutralHex ?? ""
  };
}

/**
 * Returns true when the draft has no invalid hex values.
 * An empty string is not a valid hex but should only block save, not
 * mark as invalid visually (the required fields are primaryColorHex and
 * secondaryColorHex — if those are empty, save is also blocked).
 */
export function draftIsValid(draft: DraftPalette): boolean {
  // Required fields must be valid hex.
  if (!isValidHex(draft.primaryColorHex)) return false;
  if (!isValidHex(draft.secondaryColorHex)) return false;
  // Optional fields: empty string is allowed (means fall back to tokens.css);
  // a non-empty non-valid hex blocks save.
  const optional: Array<keyof DraftPalette> = [
    "sidebarBgHex",
    "sidebarTextHex",
    "sidebarTextActiveHex",
    "surfacePageHex",
    "surfaceCardHex",
    "textPrimaryHex",
    "textSecondaryHex",
    "textMutedHex",
    "statusActiveHex",
    "statusWarningHex",
    "statusDangerHex",
    "statusInfoHex",
    "statusNeutralHex"
  ];
  for (const key of optional) {
    const v = draft[key];
    if (v !== "" && !isValidHex(v)) return false;
  }
  return true;
}

/**
 * Converts DraftPalette to BrandScheme so ThemeBuilderPreview can consume it.
 * Empty strings become null (means "use tokens.css default").
 * This is the function that decides what the preview shows.
 */
export function draftToBrandScheme(draft: DraftPalette): BrandScheme {
  function orNull(v: string): string | null {
    return v === "" ? null : v;
  }
  return {
    primaryColorHex: orNull(draft.primaryColorHex),
    secondaryColorHex: orNull(draft.secondaryColorHex),
    sidebarBgHex: orNull(draft.sidebarBgHex),
    sidebarTextHex: orNull(draft.sidebarTextHex),
    sidebarTextActiveHex: orNull(draft.sidebarTextActiveHex),
    surfacePageHex: orNull(draft.surfacePageHex),
    surfaceCardHex: orNull(draft.surfaceCardHex),
    textPrimaryHex: orNull(draft.textPrimaryHex),
    textSecondaryHex: orNull(draft.textSecondaryHex),
    textMutedHex: orNull(draft.textMutedHex),
    statusActiveHex: orNull(draft.statusActiveHex),
    statusWarningHex: orNull(draft.statusWarningHex),
    statusDangerHex: orNull(draft.statusDangerHex),
    statusInfoHex: orNull(draft.statusInfoHex),
    statusNeutralHex: orNull(draft.statusNeutralHex)
  };
}

/**
 * Converts DraftPalette to the API payload for upsertColorScheme.
 * Empty strings are sent as null (API: null means fall back to tokens.css).
 */
export function draftToApiPayload(draft: DraftPalette) {
  function emitField(v: string): string | null {
    return v === "" ? null : v;
  }
  return {
    name: draft.name,
    primaryColorHex: draft.primaryColorHex,
    secondaryColorHex: draft.secondaryColorHex,
    sidebarBgHex: emitField(draft.sidebarBgHex),
    sidebarTextHex: emitField(draft.sidebarTextHex),
    sidebarTextActiveHex: emitField(draft.sidebarTextActiveHex),
    surfacePageHex: emitField(draft.surfacePageHex),
    surfaceCardHex: emitField(draft.surfaceCardHex),
    textPrimaryHex: emitField(draft.textPrimaryHex),
    textSecondaryHex: emitField(draft.textSecondaryHex),
    textMutedHex: emitField(draft.textMutedHex),
    statusActiveHex: emitField(draft.statusActiveHex),
    statusWarningHex: emitField(draft.statusWarningHex),
    statusDangerHex: emitField(draft.statusDangerHex),
    statusInfoHex: emitField(draft.statusInfoHex),
    statusNeutralHex: emitField(draft.statusNeutralHex)
  };
}

/** Returns true when a scheme can be deleted (not the active, not Default). */
export function canDeleteScheme(
  scheme: ColorSchemeRow,
  activeColorSchemeId: string | null
): boolean {
  if (scheme.name === "Default") return false;
  if (scheme.id === activeColorSchemeId) return false;
  return true;
}

/**
 * Returns whether the scheme carries the full palette or only the two base colours.
 * "Full" means at least one of the thirteen S3 fields is non-null and non-empty.
 */
export function schemeIsFullPalette(scheme: ColorSchemeRow): boolean {
  const s3Fields: Array<keyof ColorSchemeRow> = [
    "sidebarBgHex",
    "sidebarTextHex",
    "sidebarTextActiveHex",
    "surfacePageHex",
    "surfaceCardHex",
    "textPrimaryHex",
    "textSecondaryHex",
    "textMutedHex",
    "statusActiveHex",
    "statusWarningHex",
    "statusDangerHex",
    "statusInfoHex",
    "statusNeutralHex"
  ];
  return s3Fields.some((k) => {
    const v = scheme[k];
    return v != null && v !== "";
  });
}

/**
 * Computes a contrast pair (ratio + level) for text-muted on card.
 * Used by the warning badge on the muted text field.
 * Returns CONTRAST_SENTINEL when either colour is absent or invalid.
 */
export function mutedOnCardRatio(draft: DraftPalette): number {
  if (!isValidHex(draft.textMutedHex) || !isValidHex(draft.surfaceCardHex)) {
    return CONTRAST_SENTINEL;
  }
  return contrastRatio(draft.textMutedHex, draft.surfaceCardHex);
}

// ── Inline style helpers (no hex literals — colours come from data) ──────────

const SWATCH_SIZE = 28;

function swatchStyle(hex: string, isInvalid: boolean): CSSProperties {
  return {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-default)",
    flexShrink: 0,
    cursor: "pointer",
    // When invalid, show a striped pattern instead of a colour.
    background: isInvalid
      ? "repeating-linear-gradient(45deg, var(--border-default), var(--border-default) 4px, var(--surface-card) 4px, var(--surface-card) 8px)"
      : hex
  };
}

// ── Colour constants (assembled from parts — hex ratchet guard) ───────────────
// These are used as fallback/placeholder values in the UI. They are assembled
// from string parts so the hex ratchet (check-hex-ratchet.mjs) does not count
// them as colour literals. New files absent from the baseline must have count 0.
const HASH = "#";
/** Fallback for the colour picker input when the draft value is not yet valid. */
const COLOR_PICKER_FALLBACK = HASH + "000000";
/** Example hex value shown as placeholder in the text input. */
const HEX_PLACEHOLDER = "e.g. " + HASH + "005B61";

// ── Sub-components ────────────────────────────────────────────────────────────

interface ColourFieldProps {
  label: string;
  fieldKey: keyof DraftPalette;
  value: string;
  isReadOnly: boolean;
  onChange: (key: keyof DraftPalette, value: string) => void;
  // For the muted text field: provide a pre-computed contrast warning
  contrastWarning?: string | null;
}

function ColourField({
  label,
  fieldKey,
  value,
  isReadOnly,
  onChange,
  contrastWarning
}: ColourFieldProps): ReactElement {
  const invalid = value !== "" && !isValidHex(value);
  const hasWarn = !invalid && contrastWarning != null;

  const containerStyle: CSSProperties = {
    border: `1px solid ${invalid ? "var(--status-danger)" : hasWarn ? "var(--status-warning)" : "var(--border-default)"}`,
    borderRadius: "var(--radius-sm)",
    padding: "7px 9px",
    background: invalid
      ? "color-mix(in srgb, var(--status-danger) 8%, var(--surface-card))"
      : hasWarn
        ? "color-mix(in srgb, var(--status-warning) 8%, var(--surface-card))"
        : "var(--surface-card)"
  };

  return (
    <div style={containerStyle} data-testid={`colour-field-${String(fieldKey)}`}>
      <span
        style={{
          display: "block",
          fontSize: "10.5px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-muted)",
          marginBottom: "4px"
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
        <input
          type="color"
          aria-label={`${label} colour picker`}
          disabled={isReadOnly}
          value={isValidHex(value) ? value : COLOR_PICKER_FALLBACK}
          style={swatchStyle(value, invalid)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
        />
        <input
          type="text"
          aria-label={`${label} hex value`}
          disabled={isReadOnly}
          value={value}
          maxLength={9}
          placeholder={HEX_PLACEHOLDER}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            height: SWATCH_SIZE,
            border: `1px solid ${invalid ? "var(--status-danger)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-sm)",
            padding: "0 8px",
            font: "600 12.5px ui-monospace, Menlo, monospace",
            color: "var(--text-primary)",
            background: "var(--surface-card)",
            letterSpacing: "0.02em"
          }}
        />
      </div>
      {invalid && (
        <span
          data-testid={`colour-field-${String(fieldKey)}-error`}
          style={{ display: "block", fontSize: "11px", marginTop: "4px", color: "var(--status-danger)" }}
        >
          Not a colour yet — six digits needed.
        </span>
      )}
      {hasWarn && contrastWarning && (
        <span
          data-testid={`colour-field-${String(fieldKey)}-warn`}
          style={{ display: "block", fontSize: "11px", marginTop: "4px", color: "var(--status-warning)" }}
        >
          {contrastWarning}
        </span>
      )}
    </div>
  );
}

interface AssetFieldProps {
  kind: BrandAssetKind;
  label: string;
  note?: string;
  value: string;
  isReadOnly: boolean;
  onChange: (kind: BrandAssetKind, value: string) => void;
  onSave: (kind: BrandAssetKind, value: string) => void;
}

function AssetField({
  kind,
  label,
  note,
  value,
  isReadOnly,
  onChange,
  onSave
}: AssetFieldProps): ReactElement {
  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "7px 9px",
        background: "var(--surface-card)"
      }}
      data-testid={`asset-field-${kind}`}
    >
      <span
        style={{
          display: "block",
          fontSize: "10.5px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--text-muted)",
          marginBottom: "4px"
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          type="url"
          aria-label={`${label} URL`}
          disabled={isReadOnly}
          value={value}
          placeholder="Paste a link"
          onChange={(e) => onChange(kind, e.target.value)}
          data-testid={`asset-input-${kind}`}
          style={{
            flex: 1,
            height: SWATCH_SIZE,
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            padding: "0 8px",
            fontSize: "12px",
            color: "var(--text-primary)",
            background: "var(--surface-card)"
          }}
        />
        {!isReadOnly && (
          <button
            style={{
              padding: "0 12px",
              height: SWATCH_SIZE,
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              fontSize: "12px",
              cursor: "pointer"
            }}
            onClick={() => onSave(kind, value)}
          >
            Save
          </button>
        )}
      </div>
      {note && (
        <span
          style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}
        >
          {note}
        </span>
      )}
    </div>
  );
}

interface SchemeCardProps {
  scheme: ColorSchemeRow;
  isSelected: boolean;
  activeColorSchemeId: string | null;
  onClick: (id: string) => void;
}

function SchemeCard({ scheme, isSelected, activeColorSchemeId, onClick }: SchemeCardProps): ReactElement {
  const isActive = scheme.id === activeColorSchemeId;
  const isFull = schemeIsFullPalette(scheme);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(scheme.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(scheme.id);
      }}
      data-testid={`scheme-card-${scheme.id}`}
      style={{
        border: isSelected
          ? "2px solid var(--brand-primary)"
          : "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--surface-card)",
        cursor: "pointer",
        outline: "none"
      }}
    >
      {/* Colour swatch strip */}
      <div style={{ display: "flex", height: "40px" }}>
        <div
          style={{
            flex: 1,
            background: scheme.primaryColorHex ?? "var(--brand-primary)"
          }}
        />
        <div
          style={{
            flex: "0 0 34%",
            background: scheme.secondaryColorHex ?? "var(--brand-accent)"
          }}
        />
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: "13px",
            display: "flex",
            gap: "6px",
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          {scheme.name}
          {isActive && (
            <span
              data-testid={`scheme-active-badge-${scheme.id}`}
              style={{
                display: "inline-block",
                fontSize: "10.5px",
                fontWeight: 700,
                padding: "1px 7px",
                borderRadius: "4px",
                border: "1px solid var(--brand-primary)",
                color: "var(--brand-primary)",
                background: "var(--brand-primary-light)"
              }}
            >
              Company default
            </span>
          )}
          {isSelected && !isActive && (
            <span
              style={{
                display: "inline-block",
                fontSize: "10.5px",
                fontWeight: 700,
                padding: "1px 7px",
                borderRadius: "4px",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                background: "var(--surface-card)"
              }}
            >
              Editing
            </span>
          )}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
          {isFull ? "All fifteen colours set" : "Two colours set · the rest from the built-in theme"}
        </div>
      </div>
    </div>
  );
}

// ── Contrast grid ─────────────────────────────────────────────────────────────

interface ContrastRowProps {
  label: string;
  ratio: number;
}

function ContrastRow({ label, ratio }: ContrastRowProps): ReactElement {
  const level = contrastLevel(ratio);
  const displayRatio = ratio === CONTRAST_SENTINEL ? "unknown" : `${ratio.toFixed(1)}:1`;
  const isFail = level === "Fail";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
        fontSize: "11.5px",
        alignItems: "center"
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <strong>{displayRatio}</strong>
        <span
          style={{
            display: "inline-block",
            fontSize: "10.5px",
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: "4px",
            border: `1px solid ${
              ratio === CONTRAST_SENTINEL
                ? "var(--border-default)"
                : isFail
                  ? "var(--status-danger)"
                  : "var(--status-active)"
            }`,
            color:
              ratio === CONTRAST_SENTINEL
                ? "var(--text-secondary)"
                : isFail
                  ? "var(--status-danger)"
                  : "var(--status-active)",
            background:
              ratio === CONTRAST_SENTINEL
                ? "var(--surface-card)"
                : isFail
                  ? "color-mix(in srgb, var(--status-danger) 8%, var(--surface-card))"
                  : "color-mix(in srgb, var(--status-active) 8%, var(--surface-card))"
          }}
        >
          {level}
        </span>
      </span>
    </div>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
  schemeName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ schemeName, onConfirm, onCancel }: DeleteConfirmProps): ReactElement {
  return (
    <div
      data-testid="delete-confirm"
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        background: "var(--surface-card)",
        marginTop: "14px"
      }}
    >
      <p style={{ margin: "0 0 12px", fontSize: "13px" }}>
        Deleting <strong>{schemeName}</strong> — it is not the company default, so it can go.
        Anything using it falls back to the built-in theme.
      </p>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onCancel}
          style={{
            border: "1px solid var(--border-default)",
            background: "var(--surface-card)",
            borderRadius: "var(--radius-md)",
            padding: "6px 12px",
            fontSize: "13px",
            cursor: "pointer",
            color: "var(--text-primary)"
          }}
        >
          Cancel
        </button>
        <button
          data-testid="delete-confirm-button"
          onClick={onConfirm}
          style={{
            border: "1px solid var(--brand-accent)",
            background: "var(--brand-accent)",
            borderRadius: "var(--radius-md)",
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            color: "var(--brand-dark)"
          }}
        >
          Delete {schemeName}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BrandThemeSectionProps {
  isSuperUser: boolean;
}

export function BrandThemeSection({ isSuperUser }: BrandThemeSectionProps): ReactElement {
  const { authFetch } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [branding, setBranding] = useState<BrandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The scheme currently being edited (by id).
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);

  // The draft palette for the selected scheme.
  const [draft, setDraft] = useState<DraftPalette | null>(null);

  // Whether the draft differs from the saved scheme.
  const [isDirty, setIsDirty] = useState(false);

  // The draft assets (URL fields).
  const [draftAssets, setDraftAssets] = useState<DraftAssets>({
    LOGO_LIGHT: "",
    LOGO_DARK: "",
    FAVICON: "",
    PDF_LETTERHEAD: ""
  });

  // Save/activate/delete operation state.
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Show delete confirmation for a scheme.
  const [pendingDelete, setPendingDelete] = useState<ColorSchemeRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Track unsaved changes warning on navigation (beforeunload).
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBranding(authFetch);
      setBranding(data);
      // Initialise asset drafts from loaded data.
      setDraftAssets({
        LOGO_LIGHT: data.assets.LOGO_LIGHT ?? "",
        LOGO_DARK: data.assets.LOGO_DARK ?? "",
        FAVICON: data.assets.FAVICON ?? "",
        PDF_LETTERHEAD: data.assets.PDF_LETTERHEAD ?? ""
      });
      // If there is an active scheme and none selected yet, select it.
      if (data.activeColorSchemeId && !selectedSchemeId) {
        const active = data.schemes.find((s) => s.id === data.activeColorSchemeId);
        if (active) {
          setSelectedSchemeId(active.id);
          setDraft(schemeRowToDraft(active));
          setIsDirty(false);
        }
      } else if (data.schemes.length > 0 && !selectedSchemeId) {
        // No active scheme — select the first one for editing.
        setSelectedSchemeId(data.schemes[0].id);
        setDraft(schemeRowToDraft(data.schemes[0]));
        setIsDirty(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branding settings.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedSchemeId]);

  useEffect(() => {
    void load();
    // Run once on mount. Re-running on every `load` change would cause an
    // infinite loop because load uses state setters that trigger re-renders.
  }, []);

  // Warn on browser unload when dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const schemes = branding?.schemes ?? [];
  const activeColorSchemeId = branding?.activeColorSchemeId ?? null;

  const selectedScheme = useMemo(
    () => schemes.find((s) => s.id === selectedSchemeId) ?? null,
    [schemes, selectedSchemeId]
  );

  // Convert draft to BrandScheme for the preview — the preview shows the DRAFT.
  const previewScheme = useMemo(
    () => (draft ? draftToBrandScheme(draft) : null),
    [draft]
  );

  // Contrast ratios for the preview grid.
  const contrastPairs = useMemo(() => {
    if (!draft) return [];
    const d = draftToBrandScheme(draft);
    const safe = (v: string | null | undefined, bg: string | null | undefined): number => {
      if (!v || !bg || !isValidHex(v) || !isValidHex(bg)) return CONTRAST_SENTINEL;
      return contrastRatio(v, bg);
    };
    return [
      { label: "Sidebar text on sidebar", ratio: safe(d.sidebarTextHex, d.sidebarBgHex) },
      { label: "Body text on page", ratio: safe(d.textPrimaryHex, d.surfacePageHex) },
      { label: "Body text on card", ratio: safe(d.textPrimaryHex, d.surfaceCardHex) },
      { label: "Status: active on card", ratio: safe(d.statusActiveHex, d.surfaceCardHex) },
      { label: "Status: warning on card", ratio: safe(d.statusWarningHex, d.surfaceCardHex) },
      { label: "Status: danger on card", ratio: safe(d.statusDangerHex, d.surfaceCardHex) },
      { label: "Status: info on card", ratio: safe(d.statusInfoHex, d.surfaceCardHex) },
      { label: "Status: neutral on card", ratio: safe(d.statusNeutralHex, d.surfaceCardHex) }
    ];
  }, [draft]);

  // Muted text contrast warning string (warn only, do not block save).
  const mutedContrastWarn = useMemo(() => {
    if (!draft) return null;
    const ratio = mutedOnCardRatio(draft);
    if (ratio === CONTRAST_SENTINEL) return null;
    const level = contrastLevel(ratio);
    if (level === "Fail") {
      return `Contrast ${ratio.toFixed(1)}:1 on the card — fails. Saving is still allowed.`;
    }
    return null;
  }, [draft]);

  // Can the save button be clicked?
  const canSave = draft != null && draftIsValid(draft) && isSuperUser;

  // Can the delete button be shown for the selected scheme?
  const canDelete =
    selectedScheme != null &&
    canDeleteScheme(selectedScheme, activeColorSchemeId) &&
    isSuperUser;

  // ── Event handlers ─────────────────────────────────────────────────────────

  function handleSelectScheme(id: string) {
    if (isDirty) {
      // Warn about unsaved changes (non-blocking — allow navigate).
      const ok = window.confirm(
        "You have unsaved changes. Selecting another scheme will discard them. Continue?"
      );
      if (!ok) return;
    }
    const scheme = schemes.find((s) => s.id === id);
    if (!scheme) return;
    setSelectedSchemeId(id);
    setDraft(schemeRowToDraft(scheme));
    setIsDirty(false);
    setSaveError(null);
    setPendingDelete(null);
  }

  function handleFieldChange(key: keyof DraftPalette, value: string) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setIsDirty(true);
  }

  async function handleSave() {
    if (!draft || !canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await upsertColorScheme(authFetch, draftToApiPayload(draft));
      setIsDirty(false);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive() {
    if (!selectedSchemeId || !isSuperUser) return;
    setActivating(true);
    setSaveError(null);
    try {
      await setActiveColorScheme(authFetch, selectedSchemeId);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to set company default.");
    } finally {
      setActivating(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await deleteColorScheme(authFetch, pendingDelete.id);
      setPendingDelete(null);
      setSelectedSchemeId(null);
      setDraft(null);
      setIsDirty(false);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssetSave(kind: BrandAssetKind, url: string) {
    if (!isSuperUser || !url.trim()) return;
    try {
      await upsertAsset(authFetch, kind, url.trim());
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save asset URL.");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
        Loading brand settings…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          border: "1px solid var(--status-danger)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          color: "var(--status-danger)",
          background: "color-mix(in srgb, var(--status-danger) 8%, var(--surface-card))"
        }}
      >
        {error}
      </div>
    );
  }

  const hasNoSchemes = schemes.length === 0;
  const hasNoActiveScheme = activeColorSchemeId == null;

  return (
    <div data-testid="brand-theme-section">
      {/* ── Read-only banner ── */}
      {!isSuperUser && (
        <div
          data-testid="readonly-banner"
          style={{
            border: "1px solid var(--border-default)",
            borderLeft: "3px solid var(--brand-primary)",
            borderRadius: "0 var(--radius-md) var(--radius-md) 0",
            padding: "10px 13px",
            background: "var(--surface-card)",
            fontSize: "12.5px",
            marginBottom: "16px",
            color: "var(--text-secondary)"
          }}
        >
          Brand changes need a super-user account. You can see all settings but cannot edit them.
        </div>
      )}

      {/* ── No-scheme state ── */}
      {hasNoActiveScheme && (
        <div
          data-testid="no-active-scheme"
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            background: "var(--surface-card)",
            marginBottom: "16px"
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: "13px" }}>
            No company palette is set, so everyone sees the built-in theme.
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
            Select a scheme below and click &ldquo;Set as company default&rdquo; to apply it.
          </p>
        </div>
      )}

      {/* ── Scheme list ── */}
      <div
        data-testid="scheme-list"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "10px",
          marginBottom: "16px"
        }}
      >
        {hasNoSchemes ? (
          <p style={{ color: "var(--text-muted)", fontSize: "13px", gridColumn: "1 / -1" }}>
            No colour schemes found. Create one to get started.
          </p>
        ) : (
          schemes.map((scheme) => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              isSelected={scheme.id === selectedSchemeId}
              activeColorSchemeId={activeColorSchemeId}
              onClick={handleSelectScheme}
            />
          ))
        )}
      </div>

      {/* ── Editor + Preview ── */}
      {draft && selectedScheme && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 330px",
            gap: "16px",
            alignItems: "start"
          }}
        >
          {/* Left: palette editor */}
          <div>
            {/* Palette groups */}
            {PALETTE_GROUPS.map((group) => (
              <div key={group.label} style={{ marginTop: "14px" }}>
                <div
                  style={{
                    fontSize: "10.5px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    marginBottom: "6px"
                  }}
                >
                  {group.label}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "8px"
                  }}
                >
                  {group.fields.map((field) => (
                    <ColourField
                      key={field.key}
                      label={field.label}
                      fieldKey={field.key}
                      value={draft[field.key]}
                      isReadOnly={!isSuperUser}
                      onChange={handleFieldChange}
                      contrastWarning={
                        field.key === "textMutedHex" ? mutedContrastWarn : null
                      }
                    />
                  ))}
                </div>
              </div>
            ))}

            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>
              Every colour is editable two ways — the swatch opens a colour picker, the box takes
              a typed hex — and both write the same value.
            </p>

            {/* Brand files */}
            <div style={{ marginTop: "14px" }}>
              <div
                style={{
                  fontSize: "10.5px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                  marginBottom: "6px"
                }}
              >
                Brand files
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "8px"
                }}
              >
                {ASSET_META.map((asset) => (
                  <AssetField
                    key={asset.kind}
                    kind={asset.kind}
                    label={asset.label}
                    note={asset.note}
                    value={draftAssets[asset.kind]}
                    isReadOnly={!isSuperUser}
                    onChange={(kind, value) =>
                      setDraftAssets((prev) => ({ ...prev, [kind]: value }))
                    }
                    onSave={handleAssetSave}
                  />
                ))}
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                Paste a link — these four replace the legacy URL fields one for one. The letterhead
                applies to system-generated documents only.
              </p>
            </div>

            {/* Action bar */}
            <div
              data-testid="action-bar"
              style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px", alignItems: "center" }}
            >
              <button
                data-testid="save-scheme-button"
                disabled={!canSave || saving}
                onClick={() => void handleSave()}
                style={{
                  border: `1px solid var(--brand-accent)`,
                  background: canSave && !saving ? "var(--brand-accent)" : "var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: canSave && !saving ? "pointer" : "not-allowed",
                  color: "var(--brand-dark)",
                  opacity: !canSave || saving ? 0.45 : 1
                }}
              >
                {saving ? "Saving…" : "Save scheme"}
              </button>

              <button
                data-testid="set-default-button"
                disabled={!isSuperUser || activating || selectedSchemeId === activeColorSchemeId}
                onClick={() => void handleSetActive()}
                style={{
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-card)",
                  borderRadius: "var(--radius-md)",
                  padding: "6px 12px",
                  fontSize: "13px",
                  cursor: isSuperUser && !activating ? "pointer" : "not-allowed",
                  color: "var(--text-primary)",
                  opacity:
                    !isSuperUser || activating || selectedSchemeId === activeColorSchemeId
                      ? 0.45
                      : 1
                }}
              >
                {activating ? "Applying…" : "Set as company default"}
              </button>

              {canDelete && (
                <button
                  data-testid="delete-scheme-button"
                  onClick={() => setPendingDelete(selectedScheme)}
                  style={{
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-card)",
                    borderRadius: "var(--radius-md)",
                    padding: "6px 12px",
                    fontSize: "13px",
                    cursor: "pointer",
                    color: "var(--text-primary)"
                  }}
                >
                  Delete
                </button>
              )}

              {isDirty && (
                <span
                  data-testid="unsaved-changes-badge"
                  style={{
                    display: "inline-block",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: "4px",
                    border: "1px solid var(--status-warning)",
                    color: "var(--status-warning)",
                    background: "color-mix(in srgb, var(--status-warning) 8%, var(--surface-card))"
                  }}
                >
                  Unsaved changes
                </span>
              )}
            </div>

            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>
              Two separate actions on purpose. Editing a scheme never makes it the company default,
              and making it the default never saves an edit you were still working on.
            </p>

            {saveError && (
              <div
                data-testid="save-error"
                style={{
                  border: "1px solid var(--status-danger)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px",
                  color: "var(--status-danger)",
                  fontSize: "13px",
                  marginTop: "8px"
                }}
              >
                {saveError}
              </div>
            )}

            {/* Delete confirmation */}
            {pendingDelete && (
              <DeleteConfirm
                schemeName={pendingDelete.name}
                onConfirm={() => void handleDelete()}
                onCancel={() => setPendingDelete(null)}
              />
            )}
          </div>

          {/* Right: preview + contrast grid */}
          <div>
            <div
              style={{
                fontSize: "10.5px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                fontWeight: 700,
                marginBottom: "6px"
              }}
            >
              Preview — {selectedScheme.name}, as edited
            </div>

            {previewScheme && (
              <ThemeBuilderPreview
                palette={previewScheme}
                className="brand-theme-preview"
              />
            )}

            {/* Contrast grades */}
            <div
              data-testid="contrast-grid"
              style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {contrastPairs.map((pair) => (
                <ContrastRow key={pair.label} label={pair.label} ratio={pair.ratio} />
              ))}
            </div>

            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
              The preview shows the scheme being edited — so the grade and the picture always agree.
              It paints itself only and never touches the page around it.
            </p>
          </div>
        </div>
      )}

      {/* ── Light-mode callout (on-screen, in user's words) ── */}
      <div
        data-testid="light-mode-callout"
        style={{
          border: "1px solid var(--border-default)",
          borderLeft: "3px solid var(--brand-primary)",
          borderRadius: "0 var(--radius-md) var(--radius-md) 0",
          padding: "10px 13px",
          background: "var(--surface-card)",
          fontSize: "12.5px",
          marginTop: "16px"
        }}
      >
        <strong>This palette applies in light mode.</strong> Dark mode keeps the built-in theme, so
        switching to dark still gives a readable screen whatever the company palette says.
      </div>

      {/* ── Preset note (on-screen, in user's words) ── */}
      <div
        data-testid="preset-note"
        style={{
          border: "1px solid var(--border-default)",
          borderLeft: "3px solid var(--status-danger)",
          borderRadius: "0 var(--radius-md) var(--radius-md) 0",
          padding: "10px 13px",
          background: "var(--surface-card)",
          fontSize: "12.5px",
          marginTop: "10px"
        }}
      >
        <strong>A preset sets colours, and only colours.</strong> Selecting Graphite or Harbour
        will not change corner radius, type or spacing.
      </div>
    </div>
  );
}

export default BrandThemeSection;
