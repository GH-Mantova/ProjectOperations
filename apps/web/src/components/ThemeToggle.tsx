import { useTheme } from "../lib/theme";

const ICON_SUN = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const ICON_MOON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
  </svg>
);

// Cycles through light → dark → system. Rendered in the shell topbar next to
// the notifications bell.
export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();

  const next = preference === "light" ? "dark" : preference === "dark" ? "system" : "light";
  const label =
    preference === "system"
      ? `Theme: system (${resolved}). Switch to light.`
      : preference === "light"
        ? "Theme: light. Switch to dark."
        : "Theme: dark. Switch to system.";

  return (
    <button
      type="button"
      className="shell__topbar-action"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
    >
      {resolved === "dark" ? ICON_MOON : ICON_SUN}
    </button>
  );
}
