/**
 * Brand scheme — applies saved brand colours from the server as CSS custom
 * properties on <html>, preventing flash-of-wrong-brand by caching the last
 * known values in localStorage and applying them synchronously on module load.
 *
 * Only two tokens are written today: --brand-primary and --brand-accent.
 * A future slice (S3) will add more columns to the schema and extend this
 * module — do not synthesise derived tints here.
 */
import { Fragment, createElement, useEffect, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

// ── Constants ─────────────────────────────────────────────────────────────────

export const BRAND_SCHEME_STORAGE_KEY = "projectops.brand-scheme";

/** Hex must be either #RRGGBB (6 digits) or #RRGGBBAA (8 digits). */
const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrandScheme {
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
}

// ── Core primitives ───────────────────────────────────────────────────────────

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/**
 * Applies a brand scheme to CSS custom properties on the document root.
 * Each hex value is validated before being written; invalid values are silently
 * skipped, leaving the tokens.css defaults in place (TRAP 5).
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
}

/**
 * Removes the inline custom properties, restoring tokens.css defaults.
 * Call on unmount and when user goes null.
 */
export function clearBrandScheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.removeProperty("--brand-primary");
  root.style.removeProperty("--brand-accent");
}

// ── localStorage helpers ──────────────────────────────────────────────────────

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

// ── Apply cached value synchronously on module load (TRAP 4) ─────────────────

(function applyOnLoad() {
  const cached = readCachedScheme();
  if (cached) {
    applyBrandScheme(cached);
  }
})();

// ── BrandSchemeProvider ───────────────────────────────────────────────────────

/**
 * Mounts inside AuthProvider. On mount it applies the cached localStorage
 * value synchronously (already done at module load) then re-validates over
 * the network. On user logout / null, the scheme is cleared so a departing
 * user's brand does not bleed into the login screen.
 *
 * Renders children unconditionally — a failed fetch degrades gracefully to
 * tokens.css defaults; the app never blanks.
 */
export function BrandSchemeProvider({ children }: { children: ReactNode }): ReactNode {
  const { user, authFetch } = useAuth();

  useEffect(() => {
    if (!user) {
      clearBrandScheme();
      return;
    }

    let cancelled = false;

    void authFetch("/branding/active")
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const scheme = (await response.json()) as BrandScheme;
        if (cancelled) return;

        // Only re-apply if different from cached to avoid unnecessary repaints.
        const cached = readCachedScheme();
        const changed =
          !cached ||
          cached.primaryColorHex !== scheme.primaryColorHex ||
          cached.secondaryColorHex !== scheme.secondaryColorHex;

        writeCachedScheme(scheme);

        if (changed) {
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

  // Clear scheme when user logs out.
  useEffect(() => {
    if (!user) {
      clearBrandScheme();
    }
  }, [user]);

  return createElement(Fragment, null, children);
}
