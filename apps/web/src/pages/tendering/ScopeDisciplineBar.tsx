import type { ReactNode } from "react";

export const DISCIPLINES = ["SO", "Str", "Asb", "Civ", "Prv"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

type DisciplineMeta = {
  long: string;
  accent: string;
};

export const DISCIPLINE_META: Record<Discipline, DisciplineMeta> = {
  SO: { long: "Strip-outs", accent: "#94A3B8" },
  Str: { long: "Structural", accent: "#3B82F6" },
  Asb: { long: "Asbestos", accent: "#F59E0B" },
  Civ: { long: "Civil", accent: "#22C55E" },
  Prv: { long: "Provisional", accent: "#9CA3AF" }
};

export type DisciplineStat = {
  itemCount: number;
  subtotal: number;
  withMarkup: number;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

export function ScopeDisciplineBar({
  selected,
  onSelect,
  stats,
  extra
}: {
  selected: Discipline;
  onSelect: (d: Discipline) => void;
  stats: Record<Discipline, DisciplineStat>;
  extra?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "stretch", marginBottom: 16 }}>
      {DISCIPLINES.map((d) => {
        const meta = DISCIPLINE_META[d];
        const stat = stats[d] ?? { itemCount: 0, subtotal: 0, withMarkup: 0 };
        const active = d === selected;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            style={{
              flex: "1 1 140px",
              minWidth: 140,
              padding: 12,
              borderRadius: 8,
              border: active ? "2px solid #005B61" : "1px solid var(--border, #e5e7eb)",
              background: active ? "#f0f9f9" : "var(--surface, #fff)",
              textAlign: "left",
              cursor: "pointer"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: meta.accent,
                  color: "#fff"
                }}
              >
                {d}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{stat.itemCount} item{stat.itemCount === 1 ? "" : "s"}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 2 }}>{meta.long}</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(stat.withMarkup)}</div>
          </button>
        );
      })}
      {extra}
    </div>
  );
}

export function ScopeGrandTotalBar({
  stats,
  cuttingSubtotal,
  tenderPrice
}: {
  stats: Record<Discipline, DisciplineStat>;
  cuttingSubtotal: number;
  tenderPrice: number;
}) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 8,
        background: "var(--surface-muted, #F6F6F6)",
        border: "1px solid var(--border, #e5e7eb)",
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "center",
        justifyContent: "space-between"
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {DISCIPLINES.map((d) => (
          <div key={d} style={{ fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)", marginRight: 4 }}>{d}</span>
            <strong>{fmt(stats[d]?.withMarkup ?? 0)}</strong>
          </div>
        ))}
        <div style={{ fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)", marginRight: 4 }}>Cutting</span>
          <strong>{fmt(cuttingSubtotal)}</strong>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Tender price
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#FEAA6D" }}>{fmt(tenderPrice)}</div>
      </div>
    </div>
  );
}
