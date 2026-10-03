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
 *
 * BRAND_LIGHT_ONLY_V1: Marco ruled 2026-09-25 (D-1) that the company palette
 * applies in LIGHT mode only. Dark mode must keep tokens.css unmodified.
 * applyBrandScheme now writes a single <style id="brand-scheme"> element into
 * <head> with properties scoped to light mode only — no inline custom
 * properties are written on documentElement. This means toggling dark/light
 * (ThemeToggle or OS change) requires NO re-apply and NO reload; the cascade
 * handles it automatically.
 */
import { Fragment, createElement, useEffect, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

// ── Density helpers (inlined to avoid a circular module-load IIFE side effect) ─
// density.ts calls applyDensity at module load, and importing it here would run
// that IIFE before the document stub is in place in tests that import brand-scheme.
// We replicate the two tiny primitives needed for sign-in/out rather than importing.

/** S7c-2: key used by density.ts — kept in sync as a constant. */
const DENSITY_STORAGE_KEY_S7C2 = "projectops.density";

/** S7c-2: apply or clear the data-density attribute. */
function applyDensityS7c2(mode: "comfortable" | "compact"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "compact") {
    root.setAttribute("data-density", "compact");
  } else {
    root.removeAttribute("data-density");
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const BRAND_SCHEME_STORAGE_KEY = "projectops.brand-scheme";

/**
 * S6: per-user override key.
 * Stored in localStorage alongside the company scheme. Cleared on logout.
 * Precedence: override > company scheme > tokens.css default.
 */
export const BRAND_OVERRIDE_STORAGE_KEY = "projectops.brand-override";

/**
 * BRAND_LIGHT_ONLY_V1 — marker required by the done-when gate.
 * Presence in this file is the CI signal that the light-only behaviour is active.
 */
export const BRAND_LIGHT_ONLY_V1 = "brandtheme-light-only";

/** The id of the injected style element. */
const BRAND_STYLE_ID = "brand-scheme";

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
 * not emitting the declaration.
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

// ── Core primitives ───────────────────────────────────────────────────────────

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/**
 * Builds the CSS text for the brand-scheme style element.
 * Properties are scoped to light mode only — two selectors cover both the
 * explicit [data-theme="light"] case and the "system" case when the OS is
 * reporting light (prefers-color-scheme: light with no explicit theme attr).
 *
 * No dark-mode selector is emitted, so tokens.css dark blocks retain
 * full authority in dark mode.
 *
 * Hex values are validated by isValidHex before being interpolated into the
 * CSS text. Invalid values are silently skipped (that property is omitted).
 * This is a defensive measure: we are writing raw CSS text, so untrusted
 * values must never reach the stylesheet.
 */
function buildBrandCss(scheme: BrandScheme): string {
  const declarations: string[] = [];

  if (isValidHex(scheme.primaryColorHex)) {
    declarations.push(`  --brand-primary: ${scheme.primaryColorHex};`);
  }
  if (isValidHex(scheme.secondaryColorHex)) {
    declarations.push(`  --brand-accent: ${scheme.secondaryColorHex};`);
  }
  for (const [field, prop] of S3_PROP_MAP) {
    const value = scheme[field];
    if (isValidHex(value)) {
      declarations.push(`  ${prop}: ${value};`);
    }
  }

  if (declarations.length === 0) return "";

  const block = declarations.join("\n");

  return [
    `:root[data-theme="light"] {`,
    block,
    `}`,
    ``,
    `@media (prefers-color-scheme: light) {`,
    `  :root:not([data-theme]) {`,
    declarations.map((d) => `  ${d}`).join("\n"),
    `  }`,
    `}`
  ].join("\n");
}

/**
 * Applies a brand scheme to the document by writing a single
 * <style id="brand-scheme"> element into <head>. Properties are scoped to
 * light mode only — dark mode is unaffected and tokens.css keeps full authority.
 *
 * The element is replaced (not duplicated) on each call. If the generated CSS
 * is empty (all values invalid/null), any existing element is removed so the
 * cascade falls back to tokens.css.
 *
 * No inline properties are written on documentElement for the managed
 * palette tokens. density (data-density) and theme (data-theme) attributes
 * remain unaffected.
 */
export function applyBrandScheme(scheme: BrandScheme): void {
  if (typeof document === "undefined") return;

  // Remove any existing element first (replace semantics, no duplication).
  const existing = document.getElementById(BRAND_STYLE_ID);
  if (existing) {
    existing.parentNode?.removeChild(existing);
  }

  const css = buildBrandCss(scheme);
  if (!css) return;

  const style = document.createElement("style");
  style.id = BRAND_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Removes the <style id="brand-scheme"> element from <head>,
 * restoring tokens.css defaults. Call on unmount and when user goes null.
 */
export function clearBrandScheme(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(BRAND_STYLE_ID);
  if (el) {
    el.parentNode?.removeChild(el);
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
 * the network. After the company scheme is fetched, it also fetches the
 * user's personal appearance preferences (S7c-2) to apply their saved density
 * and colour-scheme override.
 *
 * On user logout / null, the scheme AND the per-user override are cleared so
 * a departing user's brand does not bleed into the login screen. Additionally,
 * the saved density is removed from localStorage and the data-density attribute
 * is reset, so a shared site tablet never shows the last person's density.
 *
 * Renders children unconditionally — a failed fetch degrades gracefully to
 * tokens.css defaults; the app never blanks.
 *
 * S6 logout clear: BRAND_OVERRIDE_STORAGE_KEY is removed on the same code
 * path that removes BRAND_SCHEME_STORAGE_KEY (user === null).
 *
 * S7c-2 sign-in apply: after /branding/active, also fetch
 * GET /appearance-preferences/me and apply density + colour-scheme override.
 * If the account has no scheme, clear any stale override left in the browser.
 * localStorage stays a cache that prevents a flash of the wrong look on load.
 *
 * S7c-2 sign-out: also removes projectops.density and resets data-density.
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
      // S7c-2: clear density so a shared tablet does not show the last person's density.
      try {
        localStorage.removeItem(DENSITY_STORAGE_KEY_S7C2);
      } catch {
        // Private browsing — safe to continue.
      }
      applyDensityS7c2("comfortable");
      return;
    }

    let cancelled = false;

    void (async () => {
      // Fetch company scheme and personal appearance prefs in parallel.
      const [brandResponse, prefsResponse] = await Promise.all([
        authFetch("/branding/active").catch(() => null),
        authFetch("/appearance-preferences/me").catch(() => null)
      ]);

      if (cancelled) return;

      // Apply company scheme.
      if (brandResponse?.ok) {
        try {
          const scheme = (await brandResponse.json()) as BrandScheme;
          if (cancelled) return;

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
        } catch {
          // Parse failure — degrade gracefully.
        }
      }

      // Apply personal appearance preferences (S7c-2).
      if (prefsResponse?.ok) {
        try {
          const prefs = (await prefsResponse.json()) as {
            density: "comfortable" | "compact";
            colourSchemeId: string | null;
            colourScheme: BrandScheme | null;
          };
          if (cancelled) return;

          // Apply density.
          applyDensityS7c2(prefs.density);

          // Apply or clear the colour-scheme override.
          if (prefs.colourScheme) {
            setUserBrandOverride(prefs.colourScheme);
          } else {
            // Account has no personal scheme — clear any stale browser override.
            clearUserBrandOverride();
          }
        } catch {
          // Parse failure — degrade gracefully.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  // Clear scheme, override, and density when user logs out.
  useEffect(() => {
    if (!user) {
      clearBrandScheme();
      try {
        localStorage.removeItem(BRAND_OVERRIDE_STORAGE_KEY);
      } catch {
        // Private browsing — safe to continue.
      }
      // S7c-2: clear density key and reset DOM attribute.
      try {
        localStorage.removeItem(DENSITY_STORAGE_KEY_S7C2);
      } catch {
        // Private browsing — safe to continue.
      }
      applyDensityS7c2("comfortable");
    }
  }, [user]);

  return createElement(Fragment, null, children);
}
