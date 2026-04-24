import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// Pills row that hangs under every scope item. Two sections:
//   • Plant   — pills sourced from the row's plantItems Json array,
//               "+ Plant" popover reads from /estimate-rates/plant.
//   • Measure — pills sourced from the row's measurements Json array,
//               "+ Measure" popover reads from /lists/measurement-units.
// Adding or removing a pill PATCHes the full array back — we never mutate
// the server copy in place. The first measurement also syncs down to
// legacy measurementQty/measurementUnit for backward compat with screens
// that still read those columns.

export type ScopePlantItem = {
  plantRateId?: string;
  description: string;
  qty: number;
  days: number;
  unit?: string;
};
export type ScopeMeasurement = {
  qty: number;
  unit: string;
};

type ScopeItemLike = {
  id: string;
  days: string | null;
  plantItems: ScopePlantItem[] | null;
  measurements: ScopeMeasurement[] | null;
  measurementQty: string | null;
  measurementUnit: string | null;
};

type PlantRate = {
  id: string;
  name: string;
  category: string | null;
  ratePerDay: string | number | null;
  unit: string | null;
  isActive: boolean;
};

type MeasurementUnit = { id: string; value: string; label: string };

const MAX_VISIBLE_PILLS = 3;

export function ScopeRowPills({
  item,
  onPatch
}: {
  item: ScopeItemLike;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { authFetch } = useAuth();
  const [plantRates, setPlantRates] = useState<PlantRate[]>([]);
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [showAllPlant, setShowAllPlant] = useState(false);
  const [showAllMeasure, setShowAllMeasure] = useState(false);
  const [plantOpen, setPlantOpen] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);

  // Refs allow one row's popover to auto-dismiss when the user clicks
  // anywhere else — including another row's pill section. Keeps the UI
  // from filling with stacked popovers.
  const plantPopoverRef = useRef<HTMLDivElement | null>(null);
  const measurePopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!plantOpen && !measureOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (plantPopoverRef.current && !plantPopoverRef.current.contains(target)) setPlantOpen(false);
      if (measurePopoverRef.current && !measurePopoverRef.current.contains(target))
        setMeasureOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [plantOpen, measureOpen]);

  useEffect(() => {
    if (!plantOpen || plantRates.length > 0) return;
    void (async () => {
      const r = await authFetch("/estimate-rates/plant");
      if (!r.ok) return;
      const arr = (await r.json()) as PlantRate[];
      setPlantRates(arr.filter((p) => p.isActive));
    })();
  }, [plantOpen, plantRates.length, authFetch]);

  useEffect(() => {
    if (!measureOpen || units.length > 0) return;
    void (async () => {
      const r = await authFetch("/lists/measurement-units");
      if (!r.ok) return;
      // /lists/:slug returns { items: [{ value, label, ... }] } from the
      // global-lists service (PR #44 era). Fall back to [] when the
      // shape is unexpected rather than throwing.
      const body = await r.json();
      const items = Array.isArray(body.items) ? body.items : [];
      setUnits(
        items.map((it: Record<string, unknown>, i: number) => ({
          id: String(it.id ?? i),
          value: String(it.value ?? it.label ?? ""),
          label: String(it.label ?? it.value ?? "")
        }))
      );
    })();
  }, [measureOpen, units.length, authFetch]);

  const plant = Array.isArray(item.plantItems) ? item.plantItems : [];
  const measurements = Array.isArray(item.measurements) ? item.measurements : [];

  const savePlant = async (next: ScopePlantItem[]) => {
    await onPatch({ plantItems: next });
  };
  const saveMeasurements = async (next: ScopeMeasurement[]) => {
    // First measurement mirrors into legacy single-column fields so older
    // screens keep reading the right primary value.
    const primary = next[0];
    await onPatch({
      measurements: next,
      measurementQty: primary ? primary.qty : null,
      measurementUnit: primary ? primary.unit : null
    });
  };

  const visiblePlant = showAllPlant ? plant : plant.slice(0, MAX_VISIBLE_PILLS);
  const visibleMeasure = showAllMeasure ? measurements : measurements.slice(0, MAX_VISIBLE_PILLS);

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
      {/* ── Plant section ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Plant:</span>
        {plant.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
        ) : (
          visiblePlant.map((p, idx) => (
            <Pill
              key={idx}
              label={`${p.description} ×${p.qty}${p.days ? ` · ${p.days}d` : ""}`}
              onRemove={() => void savePlant(plant.filter((_, i) => i !== idx))}
              tone="#3B82F6"
            />
          ))
        )}
        {plant.length > MAX_VISIBLE_PILLS && !showAllPlant ? (
          <button
            type="button"
            onClick={() => setShowAllPlant(true)}
            style={{ fontSize: 11, background: "transparent", border: "none", cursor: "pointer", color: "var(--brand-primary, #005B61)" }}
          >
            +{plant.length - MAX_VISIBLE_PILLS} more
          </button>
        ) : null}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              setMeasureOpen(false);
              setPlantOpen((v) => !v);
            }}
            className="s7-btn s7-btn--ghost s7-btn--sm"
            style={{ fontSize: 11, padding: "2px 8px" }}
          >
            + Plant
          </button>
          {plantOpen ? (
            <PlantPicker
              anchorRef={plantPopoverRef}
              rates={plantRates}
              defaultDays={item.days ? Number(item.days) : 1}
              onAdd={(entry) => {
                void savePlant([...plant, entry]);
                setPlantOpen(false);
              }}
              onCancel={() => setPlantOpen(false)}
            />
          ) : null}
        </div>
      </div>

      {/* ── Measurement section ───────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Measure:</span>
        {measurements.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
        ) : (
          visibleMeasure.map((m, idx) => (
            <Pill
              key={idx}
              label={`${m.qty} ${m.unit}`}
              onRemove={() => void saveMeasurements(measurements.filter((_, i) => i !== idx))}
              tone="#22C55E"
            />
          ))
        )}
        {measurements.length > MAX_VISIBLE_PILLS && !showAllMeasure ? (
          <button
            type="button"
            onClick={() => setShowAllMeasure(true)}
            style={{ fontSize: 11, background: "transparent", border: "none", cursor: "pointer", color: "var(--brand-primary, #005B61)" }}
          >
            +{measurements.length - MAX_VISIBLE_PILLS} more
          </button>
        ) : null}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              setPlantOpen(false);
              setMeasureOpen((v) => !v);
            }}
            className="s7-btn s7-btn--ghost s7-btn--sm"
            style={{ fontSize: 11, padding: "2px 8px" }}
          >
            + Measure
          </button>
          {measureOpen ? (
            <MeasurePicker
              anchorRef={measurePopoverRef}
              units={units}
              onAdd={(entry) => {
                void saveMeasurements([...measurements, entry]);
                setMeasureOpen(false);
              }}
              onCancel={() => setMeasureOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Pill({
  label,
  onRemove,
  tone
}: {
  label: string;
  onRemove: () => void;
  tone: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
        color: tone,
        border: `1px solid ${tone}33`,
        fontSize: 11,
        maxWidth: 240,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          color: "inherit",
          lineHeight: 1,
          marginLeft: 2
        }}
      >
        ×
      </button>
    </span>
  );
}

function PlantPicker({
  anchorRef,
  rates,
  defaultDays,
  onAdd,
  onCancel
}: {
  anchorRef: React.MutableRefObject<HTMLDivElement | null>;
  rates: PlantRate[];
  defaultDays: number;
  onAdd: (entry: ScopePlantItem) => void;
  onCancel: () => void;
}) {
  const [rateId, setRateId] = useState<string>(rates[0]?.id ?? "");
  const [qty, setQty] = useState<number>(1);
  const [days, setDays] = useState<number>(defaultDays || 1);
  const [filter, setFilter] = useState("");
  const selected = rates.find((r) => r.id === rateId);
  const filtered = rates.filter((r) =>
    filter ? r.name.toLowerCase().includes(filter.toLowerCase()) : true
  );

  return (
    <div
      ref={anchorRef}
      style={popoverStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Add plant</div>
      <input
        autoFocus
        placeholder="Search plant…"
        className="s7-input s7-input--sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: "100%", marginBottom: 6 }}
      />
      <select
        value={rateId}
        onChange={(e) => setRateId(e.target.value)}
        style={{ width: "100%", fontSize: 12, padding: 4, marginBottom: 6 }}
        size={Math.min(6, Math.max(3, filtered.length))}
      >
        {filtered.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.ratePerDay !== null ? ` — $${r.ratePerDay}/${r.unit ?? "day"}` : ""}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 11, flex: 1 }}>
          Qty
          <input
            type="number"
            className="s7-input s7-input--sm"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
            min={0}
            step={1}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ fontSize: 11, flex: 1 }}>
          Days
          <input
            type="number"
            className="s7-input s7-input--sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 0)}
            min={0}
            step={0.5}
            style={{ width: "100%" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          disabled={!selected || qty <= 0}
          onClick={() =>
            selected &&
            onAdd({
              plantRateId: selected.id,
              description: selected.name,
              qty,
              days,
              unit: selected.unit ?? "day"
            })
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}

function MeasurePicker({
  anchorRef,
  units,
  onAdd,
  onCancel
}: {
  anchorRef: React.MutableRefObject<HTMLDivElement | null>;
  units: MeasurementUnit[];
  onAdd: (entry: ScopeMeasurement) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState<number>(0);
  const [unit, setUnit] = useState<string>(units[0]?.value ?? "Sqm");

  useEffect(() => {
    if (!unit && units[0]) setUnit(units[0].value);
  }, [units, unit]);

  return (
    <div
      ref={anchorRef}
      style={popoverStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Add measurement</div>
      <div style={{ display: "flex", gap: 6 }}>
        <label style={{ fontSize: 11, flex: 1 }}>
          Qty
          <input
            autoFocus
            type="number"
            className="s7-input s7-input--sm"
            value={qty || ""}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
            step="any"
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ fontSize: 11, flex: 1 }}>
          Unit
          <select
            className="s7-select s7-input--sm"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{ width: "100%" }}
          >
            {units.length === 0 ? <option value={unit}>{unit}</option> : null}
            {units.map((u) => (
              <option key={u.id} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          disabled={!qty || !unit}
          onClick={() => onAdd({ qty, unit })}
        >
          Add
        </button>
      </div>
    </div>
  );
}

const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  zIndex: 30,
  background: "white",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 8,
  padding: 10,
  minWidth: 280,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
};
