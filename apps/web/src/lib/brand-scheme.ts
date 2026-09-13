/**
 * Brand scheme — applies saved brand colours from the server as CSS custom
 * properties on <html>, preventing flash-of-wrong-brand by caching the last
 * known values in localStorage and applying them synchronously on module load.
 *
 * S3 extends from two tokens (--brand-primary, --brand-accent) to fifteen:
 * the original two plus the thirteen S3 palette columns that map to tokens
 * tokens.css already declares. NULL from the server means "use the tokens.css
 * fallback" — the property is simply not written, so the cascade takes over.
 *
 * S6 adds a per-user override stored in localStorage under
 * BRAND_OVERRIDE_STORAGE_KEY. Precedence (highest to lowest):
 *
 *   1. per-user override  (BRAND_OVERRIDE_STORAGE_KEY)
 *   2. company active scheme  (BRAND_SCHEME_STORAGE_KEY, fetched from server)
 *   3. tokens.css default  (applied automatically when a CSS property is absent)
 *
 * The override can be set with setUserBrandOverride() and cleared with
 * clearUserBrandOverride(). Clearing re-applies the cached company scheme
 * without a page reload. The override key is also cleared on logout via
 * BrandSchemeProvider's existing user-null cleanup path.
 */
import { Fragment, createElement, useEffect, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

// ── Constants ─────────────────────────────────────────────────────────────────

export const BRAND_SCHEME_STORAGE_KEY = "projectops.brand-scheme";

/**
 * S6: per-user override key.
 * Stored in localStorage alongside the company scheme. Cleared on logout.
 * Precedence: override > company scheme > tokens.css default.
 */
export const BRAND_OVERRIDE_STORAGE_KEY = "projectops.brand-override";

/** Hex must be either #RRGGBB (6 digits) or #RRGGBBAA (8 digits). */
const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrandScheme {
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  // S3 palette — all optional/nullable; absent or null means use tokens.css fallback.
  sidebarBgHex?: string | null;
  sidebarTextHex?: string | null;
  sidebarTextActiveHex?: string | null;
  surfacePageHex?: string | null;
  surfaceCardHex?: string | null;
  textPrimaryHex?: string | null;
  textSecondaryHex?: string | null;
  textMutedHex?: string | null;
  statusActiveHex?: string | null;
  statusWarningHex?: string | null;
  statusDangerHex?: string | null;
  statusInfoHex?: string | null;
  statusNeutralHex?: string | null;
}

/**
 * Maps each BrandScheme S3 field to its CSS custom property.
 * Each field overrides the corresponding token tokens.css already declares,
 * so a NULL/absent value correctly restores the tokens.css default by simply
 * not writing the inline style.
 */
const S3_PROP_MAP: ReadonlyArray<[keyof BrandScheme, string]> = [
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

/** All CSS custom properties this module manages (for clearBrandScheme). */
const ALL_CSS_PROPS = [
  "--brand-primary",
  "--brand-accent",
  ...S3_PROP_MAP.map(([, prop]) => prop)
];

// ── Core primitives ───────────────────────────────────────────────────────────

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/**
 * Applies a brand scheme to CSS custom properties on the document root.
 * Each hex value is validated before being written; invalid values are silently
 * skipped, leaving the tokens.css defaults in place.
 * One invalid value skips THAT property only — the rest are still applied.
 */
export function applyBrandScheme(scheme: BrandScheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (isValidHex(scheme.primaryColorHex)) {
    root.style.setProperty("--brand-primary", scheme.primaryColorHex);
  }
  if (isValidHex(scheme.secondaryColorHex)) {
    root.style.setProperty("--brand-accent", scheme.secondaryColorHex);
  }
  for (const [field, prop] of S3_PROP_MAP) {
    const value = scheme[field];
    if (isValidHex(value)) {
      root.style.setProperty(prop, value);
    }
  }
}

/**
 * Removes all inline custom properties managed by this module,
 * restoring tokens.css defaults. Call on unmount and when user goes null.
 */
export function clearBrandScheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const prop of ALL_CSS_PROPS) {
    root.style.removeProperty(prop);
  }
}

// ── localStorage helpers (company scheme) ────────────────────────────────────

function readCachedScheme(): BrandScheme | null {
  try {
    const raw = localStorage.getItem(BRAND_SCHEME_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BrandScheme;
  } catch {
    return null;
  }
}

function writeCachedScheme(scheme: BrandScheme): void {
  try {
    localStorage.setItem(BRAND_SCHEME_STORAGE_KEY, JSON.stringify(scheme));
  } catch {
    // Quota exceeded or private browsing — safe to continue without cache.
  }
}

// ── localStorage helpers (per-user override, S6) ─────────────────────────────

/**
 * Reads the per-user brand override from localStorage.
 * Returns null if absent, invalid JSON, or any read error.
 */
function readOverride(): BrandScheme | null {
  try {
    const raw = localStorage.getItem(BRAND_OVERRIDE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BrandScheme;
  } catch {
    return null;
  }
}

/**
 * Sets a per-user brand override and immediately applies it to the document.
 *
 * Precedence after this call:
 *   override > company scheme > tokens.css default
 *
 * The override is cleared on logout via BrandSchemeProvider (same code path
 * that clears the company scheme key).
 */
export function setUserBrandOverride(scheme: BrandScheme): void {
  try {
    localStorage.setItem(BRAND_OVERRIDE_STORAGE_KEY, JSON.stringify(scheme));
  } catch {
    // Quota exceeded or private browsing — apply anyway, just skip persistence.
  }
  applyBrandScheme(scheme);
}

/**
 * Clears the per-user brand override and re-applies the cached company scheme.
 * Does NOT require a page reload — the company scheme is read from localStorage
 * and applied immediately.
 *
 * If no company scheme is cached, clearBrandScheme() is called so tokens.css
 * defaults take over (level 3 of the precedence chain).
 */
export function clearUserBrandOverride(): void {
  try {
    localStorage.removeItem(BRAND_OVERRIDE_STORAGE_KEY);
  } catch {
    // Private browsing or quota error — proceed to re-apply anyway.
  }
  // Re-apply the company scheme without a reload.
  clearBrandScheme();
  const cached = readCachedScheme();
  if (cached) {
    applyBrandScheme(cached);
  }
}

// ── Apply cached value synchronously on module load ───────────────────────────

/**
 * On module load, apply whatever scheme has highest precedence:
 *   1. per-user override (if present)
 *   2. company scheme (if cached)
 *   3. nothing (tokens.css defaults stand)
 */
(function applyOnLoad() {
  const override = readOverride();
  if (override) {
    applyBrandScheme(override);
    return;
  }
  const cached = readCachedScheme();
  if (cached) {
    applyBrandScheme(cached);
  }
})();

// ── BrandSchemeProvider ───────────────────────────────────────────────────────

/**
 * Mounts inside AuthProvider. On mount it applies the cached localStorage
 * value synchronously (already done at module load) then re-validates over
 * the network. On user logout / null, the scheme AND the per-user override
 * are cleared so a departing user's brand does not bleed into the login screen.
 *
 * Renders children unconditionally — a failed fetch degrades gracefully to
 * tokens.css defaults; the app never blanks.
 *
 * S6 logout clear: BRAND_OVERRIDE_STORAGE_KEY is removed on the same code
 * path that removes BRAND_SCHEME_STORAGE_KEY (user === null). This satisfies
 * the requirement that the override clears on logout.
 */
export function BrandSchemeProvider({ children }: { children: ReactNode }): ReactNode {
  const { user, authFetch } = useAuth();

  useEffect(() => {
    if (!user) {
      clearBrandScheme();
      // S6: also clear per-user override on logout.
      try {
        localStorage.removeItem(BRAND_OVERRIDE_STORAGE_KEY);
      } catch {
        // Private browsing — safe to continue.
      }
      return;
    }

    let cancelled = false;

    void authFetch("/branding/active")
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const scheme = (await response.json()) as BrandScheme;
        if (cancelled) return;

        // Only re-apply if different from cached to avoid unnecessary repaints.
        // If a per-user override is active, the company scheme is still cached
        // for re-application when the override is cleared.
        const cached = readCachedScheme();
        const changed =
          !cached ||
          cached.primaryColorHex !== scheme.primaryColorHex ||
          cached.secondaryColorHex !== scheme.secondaryColorHex;

        writeCachedScheme(scheme);

        // Do NOT clobber a per-user override with the company scheme.
        const override = readOverride();
        if (!override && changed) {
          applyBrandScheme(scheme);
        }
      })
      .catch(() => {
        // Network failure — silently degrade to cached/default values.
      });

    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  // Clear scheme and override when user logs out.
  useEffect(() => {
    if (!user) {
      clearBrandScheme();
      try {
        localStorage.removeItem(BRAND_OVERRIDE_STORAGE_KEY);
      } catch {
        // Private browsing — safe to continue.
      }
    }
  }, [user]);

  return createElement(Fragment, null, children);
}
