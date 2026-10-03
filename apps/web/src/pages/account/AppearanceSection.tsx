/**
 * AppearanceSection — the "Appearance" card on My account (S7c-2).
 *
 * Mounts DensityControl (existing) and a colour-scheme picker.
 * Both changes are applied immediately and saved to the account via
 * the S7c-1 appearance-preferences API.
 *
 * Marco's rules (2026-09-25 / 2026-10-02):
 *  - Saved to the account, not the browser.
 *  - Company schemes only — no free colour editing.
 *  - Light mode only (enforced upstream by applyBrandScheme — not re-implemented here).
 *  - Lives in Personal settings (My account), not the admin Company page.
 *
 * Pure helpers exported for unit-test coverage (no jsdom required):
 *   pickSchemeAction, revertSchemeAction, densityAction, revertDensityAction,
 *   shouldShowReturnLink.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { DensityControl } from "../../components/DensityControl";
import { applyDensity, useDensity } from "../../lib/density";
import {
  clearUserBrandOverride,
  setUserBrandOverride
} from "../../lib/brand-scheme";
import {
  getMyAppearance,
  listSchemes,
  saveMyAppearance,
  schemeToBrandScheme
} from "../../lib/appearance-api";
import type { SchemeListItem } from "../../lib/appearance-api";
import type { DensityMode } from "../../lib/density";

/** Version marker — gated by done_when in the pipeline prompt. */
export const PERSONAL_THEME_PREFS_V1 = "brandtheme-s7c-2";

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/**
 * "Return to the company theme" link is visible when a personal scheme is
 * actively selected (activeSchemeId is non-null).
 */
export function shouldShowReturnLink(activeSchemeId: string | null): boolean {
  return activeSchemeId !== null;
}

/**
 * Apply a scheme pick optimistically and persist to the account.
 *
 * Sets or clears the brand override immediately, then PUTs the new
 * colourSchemeId to the API. Throws the API error string on failure
 * (reversion is the caller's responsibility).
 */
export async function pickSchemeAction(
  scheme: SchemeListItem | null,
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  callbacks: {
    onApplyBrandOverride: (palette: ReturnType<typeof schemeToBrandScheme>) => void;
    onClearBrandOverride: () => void;
  }
): Promise<string | null> {
  const colourSchemeId = scheme ? scheme.id : null;
  if (scheme) {
    callbacks.onApplyBrandOverride(schemeToBrandScheme(scheme));
  } else {
    callbacks.onClearBrandOverride();
  }
  await saveMyAppearance(authFetch, { colourSchemeId });
  return colourSchemeId;
}

/**
 * Revert a scheme pick: re-apply the previous scheme or clear the override.
 */
export function revertSchemeAction(
  previousSchemeId: string | null,
  schemes: SchemeListItem[],
  callbacks: {
    onApplyBrandOverride: (palette: ReturnType<typeof schemeToBrandScheme>) => void;
    onClearBrandOverride: () => void;
  }
): void {
  if (previousSchemeId === null) {
    callbacks.onClearBrandOverride();
  } else {
    const prevScheme = schemes.find((s) => s.id === previousSchemeId);
    if (prevScheme) {
      callbacks.onApplyBrandOverride(schemeToBrandScheme(prevScheme));
    }
  }
}

/**
 * Apply a density change to the DOM and persist it to the account.
 * Throws on API failure (reversion is the caller's responsibility).
 */
export async function densityAction(
  density: DensityMode,
  authFetch: (input: string, init?: RequestInit) => Promise<Response>
): Promise<void> {
  applyDensity(density);
  await saveMyAppearance(authFetch, { density });
}

/**
 * Revert a density change by re-applying the previous mode.
 */
export function revertDensityAction(previousDensity: DensityMode): void {
  applyDensity(previousDensity);
}

// ── Load state ────────────────────────────────────────────────────────────────

type SchemeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      schemes: SchemeListItem[];
      activeSchemeId: string | null;
    };

// ── Swatch chip ────────────────────────────────────────────────────────────────

function SwatchRow({ scheme }: { scheme: SchemeListItem }) {
  const colours = [
    scheme.primaryColorHex,
    scheme.secondaryColorHex,
    scheme.sidebarBgHex ?? null,
    scheme.surfacePageHex ?? null
  ].filter((c): c is string => c !== null);

  return (
    <div style={{ display: "flex", gap: 3 }}>
      {colours.map((hex, i) => (
        <i
          key={i}
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: 4,
            border: "1px solid rgba(0,0,0,.08)",
            backgroundColor: hex
          }}
        />
      ))}
    </div>
  );
}

// ── Company-theme card ─────────────────────────────────────────────────────────

function CompanyThemeCard({
  active,
  onSelect,
  disabled
}: {
  active: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      data-testid="scheme-company-theme"
      style={{
        border: `1px solid ${active ? "var(--brand-primary)" : "var(--border-default)"}`,
        boxShadow: active
          ? "0 0 0 2px color-mix(in srgb, var(--brand-primary) 15%, transparent)"
          : undefined,
        borderRadius: 8,
        padding: "10px 12px",
        background: "var(--surface-card)",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        textAlign: "left",
        width: "100%"
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 13.5,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center"
        }}
      >
        <span>Company theme</span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 4,
            background: "color-mix(in srgb, var(--brand-primary) 12%, transparent)",
            color: "var(--brand-primary)"
          }}
        >
          Default
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Whatever your company has set. Changes when they change it.
      </div>
    </button>
  );
}

// ── Scheme card ────────────────────────────────────────────────────────────────

function SchemeCard({
  scheme,
  active,
  onSelect,
  disabled
}: {
  scheme: SchemeListItem;
  active: boolean;
  onSelect: (scheme: SchemeListItem) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(scheme)}
      disabled={disabled}
      aria-pressed={active}
      data-testid={`scheme-card-${scheme.id}`}
      style={{
        border: `1px solid ${active ? "var(--brand-primary)" : "var(--border-default)"}`,
        boxShadow: active
          ? "0 0 0 2px color-mix(in srgb, var(--brand-primary) 15%, transparent)"
          : undefined,
        borderRadius: 8,
        padding: "10px 12px",
        background: "var(--surface-card)",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        textAlign: "left",
        width: "100%"
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 13.5
        }}
      >
        {scheme.name}
      </div>
      <SwatchRow scheme={scheme} />
    </button>
  );
}

// ── AppearanceSection ──────────────────────────────────────────────────────────

export function AppearanceSection() {
  const { authFetch } = useAuth();

  // Scheme state — loaded from the API.
  const [schemeState, setSchemeState] = useState<SchemeState>({ status: "loading" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Density — the hook reflects the current value in localStorage / DOM.
  const { mode: densityMode, setMode: setDensityMode } = useDensity();
  // Track whether the initial account preferences have been loaded.
  const densityInitialised = useRef(false);
  const prevDensity = useRef<DensityMode>(densityMode);

  // ── Scheme / density load on mount ───────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [prefs, schemes] = await Promise.all([
          getMyAppearance(authFetch),
          listSchemes(authFetch)
        ]);
        if (cancelled) return;

        // Apply and record the saved density.
        applyDensity(prefs.density);
        setDensityMode(prefs.density);
        prevDensity.current = prefs.density;
        densityInitialised.current = true;

        setSchemeState({
          status: "ready",
          schemes,
          activeSchemeId: prefs.colourSchemeId
        });
      } catch (err) {
        if (cancelled) return;
        setSchemeState({ status: "error", message: (err as Error).message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authFetch, setDensityMode]);

  // ── Save density when the hook value changes post-initialisation ─────────────

  useEffect(() => {
    if (!densityInitialised.current) return;
    if (densityMode === prevDensity.current) return;

    const previousDensity = prevDensity.current;
    prevDensity.current = densityMode;

    setSaveError(null);
    setSaving(true);

    void saveMyAppearance(authFetch, { density: densityMode })
      .then(() => {
        setSaving(false);
      })
      .catch((err: Error) => {
        revertDensityAction(previousDensity);
        setDensityMode(previousDensity);
        prevDensity.current = previousDensity;
        setSaveError(err.message);
        setSaving(false);
      });
  }, [authFetch, densityMode, setDensityMode]);

  // ── Handle scheme pick ───────────────────────────────────────────────────────

  const handlePickScheme = useCallback(
    async (scheme: SchemeListItem | null) => {
      if (schemeState.status !== "ready") return;

      const previousSchemeId = schemeState.activeSchemeId;
      const colourSchemeId = scheme ? scheme.id : null;

      // Optimistic apply.
      if (scheme) {
        setUserBrandOverride(schemeToBrandScheme(scheme));
      } else {
        clearUserBrandOverride();
      }
      setSchemeState({ ...schemeState, activeSchemeId: colourSchemeId });
      setSaveError(null);
      setSaving(true);

      try {
        await saveMyAppearance(authFetch, { colourSchemeId });
      } catch (err) {
        revertSchemeAction(previousSchemeId, schemeState.schemes, {
          onApplyBrandOverride: (palette) => setUserBrandOverride(palette),
          onClearBrandOverride: clearUserBrandOverride
        });
        setSchemeState({ ...schemeState, activeSchemeId: previousSchemeId });
        setSaveError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [authFetch, schemeState]
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section className="s7-card" style={{ marginTop: 24 }} data-testid="appearance-section">
      <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>
        Appearance
      </h2>
      <p style={{ color: "var(--text-secondary)", marginTop: 0, fontSize: 13 }}>
        How ProjectOperations looks for you. Nobody else is affected.
      </p>

      {schemeState.status === "loading" && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      )}

      {schemeState.status === "error" && (
        <p
          style={{ color: "var(--status-danger)", fontSize: 13 }}
          data-testid="load-error"
        >
          {schemeState.message}
        </p>
      )}

      {schemeState.status === "ready" && (
        <>
          {/* Density */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginTop: 14,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Density
          </div>
          <DensityControl />

          {/* Colour scheme */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginTop: 14,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Colour scheme
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10
            }}
          >
            <CompanyThemeCard
              active={schemeState.activeSchemeId === null}
              onSelect={() => void handlePickScheme(null)}
              disabled={saving}
            />
            {schemeState.schemes.map((scheme) => (
              <SchemeCard
                key={scheme.id}
                scheme={scheme}
                active={schemeState.activeSchemeId === scheme.id}
                onSelect={(s) => void handlePickScheme(s)}
                disabled={saving}
              />
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
            Colour schemes apply in light mode. Dark mode keeps the standard dark theme.
            A scheme changes colours only, not corner shape, type size or spacing.
          </p>

          {/* Return link — only when a personal scheme is active */}
          {shouldShowReturnLink(schemeState.activeSchemeId) && (
            <button
              type="button"
              onClick={() => void handlePickScheme(null)}
              disabled={saving}
              data-testid="return-to-company-theme"
              style={{
                color: "var(--brand-primary)",
                fontWeight: 600,
                textDecoration: "underline",
                fontSize: 13,
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: 0,
                marginTop: 10
              }}
            >
              Return to the company theme
            </button>
          )}

          {saveError && (
            <p
              style={{
                color: "var(--status-danger)",
                fontSize: 13,
                marginTop: 10
              }}
              data-testid="save-error"
            >
              {saveError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
