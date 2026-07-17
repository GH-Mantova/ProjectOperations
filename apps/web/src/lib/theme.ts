import { useCallback, useEffect, useState } from "react";

// Persisted theme preference. "system" means "follow the OS via
// prefers-color-scheme" (no data-theme attribute set); "light" / "dark" pin
// the value. The initial value is applied by an inline script in index.html
// so tokens resolve on the first paint — this hook keeps React in sync.
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "projectops.theme";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (value === "light" || value === "dark") return value;
  return "system";
}

export function applyThemePreference(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (pref === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", pref);
  }
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    if (typeof window === "undefined") return;
    if (pref === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, pref);
    }
    applyThemePreference(pref);
  }, []);

  const resolved: "light" | "dark" =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  return { preference, resolved, setPreference, toggle };
}
