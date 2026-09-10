/**
 * DensityControl — compact / comfortable picker.
 *
 * Renders two option buttons (Comfortable / Compact), marks the current one,
 * and calls applyDensity + persists to localStorage on change.
 *
 * Style rules:
 *   - Zero hex literals (enforced by check-hex-ratchet.mjs). All colours come
 *     from existing CSS custom properties defined in tokens.css.
 *   - No inline styles that reference raw colour values.
 *
 * Placement: anywhere in the Settings shell. Import and drop in; no Provider
 * needed because density state lives in localStorage + the DOM attribute.
 */
import { useDensity, type DensityMode } from "../lib/density";

// ── Option descriptor — exported so tests can inspect the shape without
//    rendering JSX (no jsdom in this workspace).

export interface DensityOption {
  value: DensityMode;
  label: string;
  description: string;
}

export const DENSITY_OPTIONS: DensityOption[] = [
  {
    value: "comfortable",
    label: "Comfortable",
    description: "Default spacing — standard row and control heights."
  },
  {
    value: "compact",
    label: "Compact",
    description: "Reduced spacing — more rows visible at once."
  }
];

/** Returns true when the given option is currently active. */
export function isActiveOption(option: DensityOption, current: DensityMode): boolean {
  return option.value === current;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DensityControl() {
  const { mode, setMode } = useDensity();

  return (
    <div
      role="group"
      aria-label="Display density"
      style={{
        display: "flex",
        gap: "8px"
      }}
    >
      {DENSITY_OPTIONS.map((option) => {
        const active = isActiveOption(option, mode);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            aria-pressed={active}
            title={option.description}
            data-testid={`density-option-${option.value}`}
            style={{
              background: active ? "var(--brand-primary)" : "var(--surface-card)",
              color: active ? "var(--text-inverse)" : "var(--text-primary)",
              border: `1px solid ${active ? "var(--brand-primary)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-md)",
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: active ? 600 : 400,
              cursor: "pointer",
              transition: "background 120ms ease, border-color 120ms ease, color 120ms ease"
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
