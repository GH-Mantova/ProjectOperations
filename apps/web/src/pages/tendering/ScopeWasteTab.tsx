import { useCallback, useEffect, useMemo, useState } from "react";
import { readApiErrorMessage } from "../../lib/api-errors";
import { useAuth } from "../../auth/AuthContext";
import { NotesField } from "../../components";
import { SectionMarkupOverride, computeWithMarkup } from "./SectionMarkupOverride";

// Waste disposal rows for a tender × discipline. truckDays and lineTotal
// are derived server-side — the UI only submits raw inputs (tonnes, loads,
// rates) and re-reads the server response. Minimal dependencies on the
// wider scope tab (just the selected discipline and the list of WBS refs
// for its scope items, for the row-level wbsRef dropdown).

type WasteRow = {
  id: string;
  tenderId: string;
  discipline: string;
  wbsRef: string | null;
  description: string;
  wasteGroup: string | null;
  wasteType: string | null;
  wasteFacility: string | null;
  // PR B4a — `unit` is no longer user-editable on the subtable. It's a
  // read-only display badge carrying the facility's rate unit forward
  // ("Billed by" column). `autoSummed` distinguishes rows created by
  // "Sum from above" (regenerable) from manual rows (preserved).
  unit: string | null;
  autoSummed: boolean;
  // PR B4a — the qty column carries the primary waste quantity (tonnes
  // by default); m³ is the companion column. Both are persisted per row;
  // the line total bills against whichever side matches the facility's
  // rate.unit. Renamed from `wasteTonnes` in chore/schema-hygiene-waste.
  qty: string | null;
  m3: string | null;
  wasteLoads: number | null;
  truckDays: string | null;
  ratePerTonne: string | null;
  ratePerLoad: string | null;
  lineTotal: string | null;
  notes: string | null;
  sortOrder: number;
};

type WasteRate = {
  id: string;
  wasteGroup: string | null;
  wasteType: string;
  facility: string;
  unit: string;
  tonRate: string;
  loadRate: string;
  isActive: boolean;
};

function ceilHalf(value: number): number {
  return Math.ceil(value * 2) / 2;
}

function fmtCurrency(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

export function ScopeWasteTab({
  tenderId,
  discipline,
  wbsRefs,
  canManage,
  wasteNotes,
  onWasteNotesChange,
  cardId,
  tenderMarkup,
  sectionMarkupOverride,
  onSectionMarkupChange
}: {
  tenderId: string;
  discipline: string;
  wbsRefs: string[];
  canManage: boolean;
  // PR B1.7 — shared notes for the whole subtable (persists to
  // ScopeCard.wasteNotes via PATCH /scope/cards/:cardId). Optional so
  // legacy callers without card context still render.
  wasteNotes?: string | null;
  onWasteNotesChange?: (value: string | null) => Promise<void> | void;
  // PR B3 — when supplied, the subtable lists rows scoped to this
  // card (instead of the whole discipline) and exposes the "Sum from
  // above" button.
  cardId?: string;
  // Per-section markup override for this card's waste subtable.
  // Independent cost stream from the scope-card markup.
  tenderMarkup?: number;
  sectionMarkupOverride?: number | null;
  onSectionMarkupChange?: (next: number | null) => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<WasteRow[]>([]);
  const [rates, setRates] = useState<WasteRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // PR B3 — when a cardId is in scope, filter by it (per-card view).
      // Falls back to whole-discipline for legacy callers without a card.
      const wasteUrl = cardId
        ? `/tenders/${tenderId}/scope/waste?cardId=${encodeURIComponent(cardId)}`
        : `/tenders/${tenderId}/scope/waste?discipline=${discipline}`;
      const [rowsResp, ratesResp] = await Promise.all([
        authFetch(wasteUrl),
        authFetch(`/estimate-rates/waste`)
      ]);
      if (!rowsResp.ok) throw new Error(await rowsResp.text());
      setRows((await rowsResp.json()) as WasteRow[]);
      if (ratesResp.ok) {
        const arr = (await ratesResp.json()) as WasteRate[];
        setRates(arr.filter((r) => r.isActive));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, discipline, cardId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cascade helpers — group → types → facilities → rate record. Exposed
  // as plain computed arrays so the row renderer can filter on each
  // change cheaply.
  const groups = useMemo(() => {
    const s = new Set<string>();
    for (const r of rates) if (r.wasteGroup) s.add(r.wasteGroup);
    return [...s].sort();
  }, [rates]);
  const typesForGroup = (group: string | null) => {
    const s = new Set<string>();
    for (const r of rates) if (!group || r.wasteGroup === group) s.add(r.wasteType);
    return [...s].sort();
  };
  const facilitiesForType = (type: string | null) => {
    const s = new Set<string>();
    for (const r of rates) if (!type || r.wasteType === type) s.add(r.facility);
    return [...s].sort();
  };
  // PR B4a — facility filter relaxed to (group, type) only. A given
  // (group, type) may map to multiple facilities at different units;
  // the chosen facility's rate.unit decides which side (tonnes vs m³)
  // the line total bills against.
  const facilitiesForRow = (group: string | null, type: string | null) => {
    const s = new Set<string>();
    for (const r of rates) {
      if (group && r.wasteGroup !== group) continue;
      if (type && r.wasteType !== type) continue;
      s.add(r.facility);
    }
    return [...s].sort();
  };
  const rateFor = (type: string | null, facility: string | null) => {
    if (!type || !facility) return null;
    return rates.find((r) => r.wasteType === type && r.facility === facility) ?? null;
  };

  const addRow = async () => {
    if (!canManage) return;
    // PR B-followup — cardId is now required by the API. Guard the
    // legacy whole-tender mount path with a controlled error.
    if (!cardId) {
      setError("Cannot add a waste row without a scope card in context.");
      return;
    }
    const body = {
      discipline,
      cardId,
      wbsRef: wbsRefs[0] ?? null,
      description: "Waste disposal"
    };
    const response = await authFetch(`/tenders/${tenderId}/scope/waste`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  // PR B3 — "Sum from above" handler. Confirm dialog fires only when
  // there's at least one autoSummed row already (those will be
  // regenerated). Manual rows are preserved server-side regardless.
  const sumFromAbove = async () => {
    if (!canManage || !cardId) return;
    const autoCount = rows.filter((r) => r.autoSummed).length;
    if (autoCount > 0) {
      const ok = window.confirm(
        `This will regenerate ${autoCount} auto-summed waste row${
          autoCount === 1 ? "" : "s"
        }. Manual rows will be preserved. Continue?`
      );
      if (!ok) return;
    }
    const response = await authFetch(
      `/tenders/${tenderId}/scope/cards/${cardId}/waste/sum-from-above`,
      { method: "POST" }
    );
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  const patchRow = async (id: string, patch: Record<string, unknown>) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/waste/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  const deleteRow = async (id: string) => {
    if (!window.confirm("Delete this waste row?")) return;
    const response = await authFetch(`/tenders/${tenderId}/scope/waste/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  const subtotal = useMemo(
    () => rows.reduce((sum, r) => sum + (r.lineTotal ? Number(r.lineTotal) : 0), 0),
    [rows]
  );
  // SoT §10 waste-weight calculator surface (BACKLOG-DECISIONS.md #7):
  // display-only Σ tonnes across all rows so estimators can eyeball the
  // total waste volume they're pricing against. Pure sum — the server's
  // wasteWeightCalculator seam owns the m³ × density → tonnes math.
  const totalTonnes = useMemo(
    () => rows.reduce((sum, r) => (r.qty ? sum + Number(r.qty) : sum), 0),
    [rows]
  );

  return (
    <section className="s7-card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12
        }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          {discipline} — Waste disposal
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
            ({rows.length} row{rows.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {onSectionMarkupChange && tenderMarkup !== undefined ? (
            <SectionMarkupOverride
              label="Waste markup:"
              value={sectionMarkupOverride}
              tenderMarkup={tenderMarkup}
              onSave={onSectionMarkupChange}
              disabled={!canManage}
            />
          ) : null}
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Total: <strong style={{ color: "var(--text)" }}>{totalTonnes.toFixed(2)} t</strong>
            <span> · </span>
            Subtotal: <strong style={{ color: "var(--text)" }}>{fmtCurrency(subtotal)}</strong>
            {tenderMarkup !== undefined ? (
              <>
                <span> · </span>
                with markup:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {fmtCurrency(computeWithMarkup(subtotal, sectionMarkupOverride, tenderMarkup))}
                </strong>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Waste rows live on the tender directly (not inside a scope item) so one WBS ref can
        have multiple waste streams with different facilities and rates.
      </p>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No waste rows for {discipline} yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
              <tr>
                {[
                  "WBS",
                  "Description",
                  "Group",
                  "Type",
                  "Facility",
                  "Billed by",
                  "Tonnes",
                  "M³",
                  "Loads",
                  "Truck days",
                  "$/unit",
                  "$/Load",
                  "Line total",
                  ""
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 4px",
                      textAlign: "left",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-muted)"
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const facilityOptions = facilitiesForRow(row.wasteGroup, row.wasteType);
                const noFacility =
                  !!row.wasteGroup && !!row.wasteType && facilityOptions.length === 0;
                // PR B4a — billing unit comes from the row's `unit`
                // (set by the aggregator to rate.unit, or by manual
                // edit). Defaults to "t" when blank so legacy rows
                // keep working.
                const billingUnit = row.unit === "m³" ? "m³" : "t";
                const rateLabel = billingUnit === "m³" ? "$/m³" : "$/t";
                const rowTint = noFacility ? "rgba(254, 170, 109, 0.12)" : undefined;
                return (
                <tr
                  key={row.id}
                  style={{
                    borderTop: "1px solid var(--border, #e5e7eb)",
                    background: rowTint
                  }}
                >
                  <td style={{ padding: 2 }}>
                    <select
                      value={row.wbsRef ?? ""}
                      onChange={(e) => void patchRow(row.id, { wbsRef: e.target.value || null })}
                      disabled={!canManage}
                      style={{ fontSize: 12, padding: 2, width: 70 }}
                    >
                      <option value="">—</option>
                      {!wbsRefs.includes(row.wbsRef ?? "") && row.wbsRef ? (
                        <option value={row.wbsRef}>{row.wbsRef}</option>
                      ) : null}
                      {wbsRefs.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* PR B3 — small "auto" badge marks rows created by
                          Sum from above; tells the user this row will be
                          replaced on the next regeneration. */}
                      {row.autoSummed ? (
                        <span
                          title="Auto-summed from items above — regenerated when you press Sum from above"
                          style={{
                            fontSize: 9,
                            padding: "1px 5px",
                            background: "#FEAA6D",
                            color: "#fff",
                            borderRadius: 999,
                            fontWeight: 700,
                            whiteSpace: "nowrap"
                          }}
                        >
                          AUTO
                        </span>
                      ) : null}
                      <input
                        className="s7-input s7-input--sm"
                        defaultValue={row.description}
                        disabled={!canManage}
                        onBlur={(e) =>
                          e.target.value !== row.description &&
                          void patchRow(row.id, { description: e.target.value })
                        }
                        style={{ width: "100%" }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: 2 }}>
                    <select
                      className="s7-select s7-input--sm"
                      value={row.wasteGroup ?? ""}
                      disabled={!canManage}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        // Group change clears type + facility so the
                        // cascade stays consistent.
                        void patchRow(row.id, {
                          wasteGroup: next,
                          wasteType: null,
                          wasteFacility: null,
                          ratePerTonne: null,
                          ratePerLoad: null
                        });
                      }}
                      style={{ width: 110, fontSize: 12, padding: 2 }}
                    >
                      <option value="">—</option>
                      {row.wasteGroup && !groups.includes(row.wasteGroup) ? (
                        <option value={row.wasteGroup}>{row.wasteGroup}</option>
                      ) : null}
                      {groups.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 2 }}>
                    <select
                      className="s7-select s7-input--sm"
                      value={row.wasteType ?? ""}
                      disabled={!canManage || !row.wasteGroup}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        void patchRow(row.id, {
                          wasteType: next,
                          wasteFacility: null,
                          ratePerTonne: null,
                          ratePerLoad: null
                        });
                      }}
                      style={{ width: 130, fontSize: 12, padding: 2 }}
                    >
                      <option value="">—</option>
                      {row.wasteType && !typesForGroup(row.wasteGroup).includes(row.wasteType) ? (
                        <option value={row.wasteType}>{row.wasteType}</option>
                      ) : null}
                      {typesForGroup(row.wasteGroup).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 2 }}>
                    {/* PR B4a — facility filter relaxed: (group, type)
                        only. Picking a facility writes the facility's
                        rate.unit forward to row.unit so the line total
                        bills against the right side. */}
                    <select
                      className="s7-select s7-input--sm"
                      value={row.wasteFacility ?? ""}
                      disabled={!canManage || !row.wasteType || noFacility}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        const rate = rateFor(row.wasteType, next);
                        void patchRow(row.id, {
                          wasteFacility: next,
                          unit: rate?.unit ?? null,
                          ratePerTonne: rate ? Number(rate.tonRate) : null,
                          ratePerLoad: rate ? Number(rate.loadRate) : null
                        });
                      }}
                      style={{ width: 140, fontSize: 12, padding: 2 }}
                      title={
                        noFacility
                          ? "No facility for this group/type"
                          : row.wasteFacility ?? "Pick a facility"
                      }
                    >
                      {noFacility ? (
                        <option value="">— no facility —</option>
                      ) : (
                        <option value="">—</option>
                      )}
                      {row.wasteFacility && !facilityOptions.includes(row.wasteFacility) ? (
                        <option value={row.wasteFacility}>{row.wasteFacility}</option>
                      ) : null}
                      {facilityOptions.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 2, fontSize: 11, color: "var(--text-muted)" }}>
                    {/* PR B4a — read-only "Billed by" badge mirrors the
                        facility's rate.unit. Empty when no facility set. */}
                    {row.wasteFacility ? (
                      <span
                        title={`Line total bills against ${billingUnit}`}
                        style={{
                          display: "inline-block",
                          padding: "1px 6px",
                          background: "var(--surface-muted, #F6F6F6)",
                          borderRadius: 4,
                          fontFamily: "ui-monospace, monospace"
                        }}
                      >
                        {billingUnit}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.001"
                      defaultValue={row.qty ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.qty))
                          void patchRow(row.id, { qty: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.01"
                      defaultValue={row.m3 ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.m3))
                          void patchRow(row.id, { m3: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      defaultValue={row.wasteLoads ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.wasteLoads))
                          void patchRow(row.id, { wasteLoads: n });
                      }}
                      style={{ width: 60, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                    {row.wasteLoads !== null && row.wasteLoads !== undefined
                      ? ceilHalf(row.wasteLoads / 3).toFixed(1) + " d"
                      : "—"}
                  </td>
                  <td style={{ padding: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <input
                        className="s7-input s7-input--sm"
                        type="number"
                        step="0.01"
                        defaultValue={row.ratePerTonne ?? ""}
                        disabled={!canManage}
                        title={`Rate per ${billingUnit}`}
                        onBlur={(e) => {
                          const n = e.target.value === "" ? null : Number(e.target.value);
                          if (String(n) !== String(row.ratePerTonne))
                            void patchRow(row.id, { ratePerTonne: n });
                        }}
                        style={{ width: 60, textAlign: "right" }}
                      />
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{rateLabel}</span>
                    </div>
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.01"
                      defaultValue={row.ratePerLoad ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.ratePerLoad))
                          void patchRow(row.id, { ratePerLoad: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2, fontWeight: 500, textAlign: "right" }}>
                    {fmtCurrency(row.lineTotal)}
                  </td>
                  <td style={{ padding: 2 }}>
                    {canManage ? (
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => void deleteRow(row.id)}
                        aria-label="Delete waste row"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void addRow()}
          >
            + Add waste row
          </button>
          {cardId ? (
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => void sumFromAbove()}
              title="Aggregate scope items above (wasteIncluded=true) into auto-summed waste rows"
            >
              Sum from above
            </button>
          ) : null}
        </div>
      ) : null}

      {onWasteNotesChange ? (
        <div style={{ marginTop: 16 }}>
          <NotesField
            label="Waste notes"
            value={wasteNotes ?? null}
            onSave={(v) => onWasteNotesChange(v)}
            disabled={!canManage}
            placeholder="Shared notes for this card's waste subtable…"
          />
        </div>
      ) : null}
    </section>
  );
}
