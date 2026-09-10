/**
 * Density preference — compact / comfortable.
 *
 * Mirrors the shape of theme.ts exactly: a storage key, an apply function, and
 * a React hook. The apply function sets `data-density` on the document root;
 * comfortable removes the attribute so the :root defaults in tokens.css stand.
 *
 * Separation from THEME_STORAGE_KEY is load-bearing: a stale density value
 * in localStorage must never be able to corrupt the light/dark preference, and
 * the two keys must remain independent indefinitely.
 *
 * Apply-on-module-load: density.ts calls applyDensity once at the bottom of
 * this file (same pattern as brand-scheme.ts) so the attribute is set
 * synchronously before React mounts — no first-paint reflow of row heights.
 */
import { useCallback, useEffect, useState } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────

export type DensityMode = "comfortable" | "compact";

/** Separate from THEME_STORAGE_KEY — density and theme are independent axes. */
export const DENSITY_STORAGE_KEY = "projectops.density";

// ── localStorage helpers ───────────────────────────────────────────────────────

function readStoredDensity(): DensityMode {
  if (typeof window === "undefined") return "comfortable";
  try {
    const value = window.localStorage.getItem(DENSITY_STORAGE_KEY);
    if (value === "compact") return "compact";
    // Any other stored value (including "comfortable" or unknown strings)
    // falls back to comfortable rather than being written through to the DOM.
    return "comfortable";
  } catch {
    // Site data blocked or private browsing — render comfortable, never throw.
    return "comfortable";
  }
}

// ── Core primitive ─────────────────────────────────────────────────────────────

/**
 * Applies a density mode by setting or removing `data-density` on the document
 * root. Comfortable is the natural state — the attribute is absent and
 * :root defaults in tokens.css apply. Compact sets the attribute so the
 * :root[data-density="compact"] override block in tokens.css fires.
 *
 * This attribute does not collide with `data-theme` (set by theme.ts). The two
 * attributes are independent and compose across all four combinations.
 */
export function applyDensity(mode: DensityMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "compact") {
    root.setAttribute("data-density", "compact");
  } else {
    root.removeAttribute("data-density");
  }
}

// ── Apply cached preference synchronously on module load ──────────────────────
// Same pattern as brand-scheme.ts: runs once when this module is first imported,
// before React mounts, preventing a first-paint reflow of row and control heights.

(function applyOnLoad() {
  const stored = readStoredDensity();
  applyDensity(stored);
})();

// ── React hook ─────────────────────────────────────────────────────────────────

export function useDensity(): {
  mode: DensityMode;
  setMode: (mode: DensityMode) => void;
} {
  const [mode, setModeState] = useState<DensityMode>(readStoredDensity);

  const setMode = useCallback((next: DensityMode) => {
    setModeState(next);
    try {
      if (next === "comfortable") {
        window.localStorage.removeItem(DENSITY_STORAGE_KEY);
      } else {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
      }
    } catch {
      // Quota exceeded or private browsing — preference is lost on reload but
      // the current session continues without throwing.
    }
    applyDensity(next);
  }, []);

  // Keep the hook in sync if another tab changes the preference.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== DENSITY_STORAGE_KEY) return;
      const next = event.newValue === "compact" ? "compact" : "comfortable";
      setModeState(next);
      applyDensity(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { mode, setMode };
}
