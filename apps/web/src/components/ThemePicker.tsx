import { useEffect, useRef, useState } from "react";
import { THEMES, useTheme, type ThemePreference } from "../lib/theme";

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

const ICON_CHECK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export function ThemePicker() {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeLabel = THEMES.find((t) => t.id === preference)?.label ?? "System";
  const label = `Theme: ${activeLabel}${preference === "system" ? ` (${resolved})` : ""}. Change theme.`;

  const choose = (id: ThemePreference) => {
    setPreference(id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        className="shell__topbar-action"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        data-testid="theme-picker"
      >
        {resolved === "dark" ? ICON_MOON : ICON_SUN}
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Theme"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 160,
            background: "var(--surface-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md, 8px)",
            boxShadow: "var(--shadow-dropdown, 0 4px 16px rgba(0,0,0,0.10))",
            padding: 4,
            zIndex: 1000,
          }}
        >
          {THEMES.map((theme) => {
            const active = theme.id === preference;
            return (
              <button
                key={theme.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(theme.id)}
                data-testid={`theme-picker-option-${theme.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  padding: "8px 10px",
                  background: active ? "var(--border-subtle)" : "transparent",
                  color: "inherit",
                  border: 0,
                  borderRadius: "var(--radius-sm, 6px)",
                  cursor: "pointer",
                  fontSize: 14,
                  textAlign: "left",
                }}
              >
                <span>{theme.label}</span>
                <span
                  aria-hidden
                  style={{
                    color: "var(--brand-primary)",
                    visibility: active ? "visible" : "hidden",
                    display: "inline-flex",
                  }}
                >
                  {ICON_CHECK}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
