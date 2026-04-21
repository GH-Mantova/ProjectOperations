import { useMemo, useState } from "react";

// Labels shown in column pills / popover. Keep tight + human-readable —
// the server owns the column key set, this is purely presentation.
const COLUMN_LABEL: Record<string, string> = {
  men: "Men",
  days: "Days",
  shift: "Shift",
  measurementQty: "Measurement",
  measurementUnit: "Unit",
  material: "Material",
  plantAssetId: "Plant",
  wasteGroup: "Waste group",
  wasteType: "Waste type",
  wasteFacility: "Waste facility",
  wasteTonnes: "Waste tonnes",
  wasteLoads: "Waste loads",
  notes: "Notes"
};

// measurementQty + measurementUnit are always toggled together at the UI
// level; the server stores them as two columns but the pill reads as one.
const COUPLED: Record<string, string[]> = {
  measurementQty: ["measurementQty", "measurementUnit"],
  measurementUnit: ["measurementQty", "measurementUnit"]
};

function expand(keys: string[]): string[] {
  const out = new Set<string>();
  for (const k of keys) {
    const pair = COUPLED[k] ?? [k];
    for (const p of pair) out.add(p);
  }
  return Array.from(out);
}

function collapse(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (seen.has(k)) continue;
    seen.add(k);
    const pair = COUPLED[k];
    if (pair) {
      // Only emit the primary ("measurementQty") to represent the pair.
      if (k === "measurementQty") out.push(k);
      else if (k === "measurementUnit" && !keys.includes("measurementQty")) {
        out.push("measurementQty");
        seen.add("measurementUnit");
      }
      for (const p of pair) seen.add(p);
    } else {
      out.push(k);
    }
  }
  return out;
}

export function ScopeColumnManager({
  enabled,
  available,
  onChange
}: {
  /** Full list of currently enabled server columns (may include both halves of coupled pairs). */
  enabled: string[];
  /** Full list of columns available for the current discipline (server-supplied). */
  available: string[];
  onChange: (nextEnabled: string[]) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const enabledPills = useMemo(() => collapse(enabled), [enabled]);
  const availablePills = useMemo(
    () => collapse(available.filter((c) => !enabled.includes(c))),
    [available, enabled]
  );

  const remove = (key: string) => {
    const toRemove = COUPLED[key] ?? [key];
    onChange(enabled.filter((c) => !toRemove.includes(c)));
  };
  const add = (key: string) => {
    const next = expand([...enabled, key]);
    onChange(next);
    setPopoverOpen(false);
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "8px 0 12px" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginRight: 4 }}>
        Columns:
      </span>
      {enabledPills.length === 0 ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>none</span>
      ) : null}
      {enabledPills.map((key) => (
        <span
          key={key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 4px 2px 10px",
            background: "var(--surface-muted, #F6F6F6)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 999,
            fontSize: 12
          }}
        >
          {COLUMN_LABEL[key] ?? key}
          <button
            type="button"
            aria-label={`Remove ${COLUMN_LABEL[key] ?? key}`}
            onClick={() => remove(key)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0 6px",
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </span>
      ))}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setPopoverOpen((v) => !v)}
          disabled={availablePills.length === 0}
          style={{
            padding: "2px 10px",
            background: "transparent",
            border: "1px dashed var(--border, #cbd5e1)",
            borderRadius: 999,
            fontSize: 12,
            cursor: availablePills.length === 0 ? "not-allowed" : "pointer",
            color: availablePills.length === 0 ? "var(--text-muted)" : "var(--text)"
          }}
        >
          + Add column
        </button>
        {popoverOpen && availablePills.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              background: "var(--surface, #fff)",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              padding: 6,
              zIndex: 50,
              minWidth: 180
            }}
          >
            {availablePills.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => add(key)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13
                }}
              >
                {COLUMN_LABEL[key] ?? key}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function labelFor(key: string): string {
  return COLUMN_LABEL[key] ?? key;
}
