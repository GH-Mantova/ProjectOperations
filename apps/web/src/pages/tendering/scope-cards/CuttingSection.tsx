// SCOPE_CUTTING_V1 — "Cutting take-off", the read-only cutting section inside
// a scope card. Seventh and last slice of the card redesign.
//
// The premise this closes: `Cutting?` on a measurement was a tickbox and
// nothing more. The card never showed WHAT had been ticked, what rig it would
// be cut with, or what it cost, so the estimator priced concrete cutting blind
// and only found out at export.
//
// Position inside the card, fixed by the approved mock-up:
//   WBS items -> Other operational costs -> Waste -> Concrete cutting
//   -> + Add WBS item -> subtotal
// This file is the fourth of those. ScopeCardsTab mounts it directly under
// Waste, immediately above the existing editable Cutrite sheet
// (ScopeCuttingSheet) that the estimator picks rigs in. This section is the
// READ view of what that sheet has produced for the card; it edits nothing.
//
// THE HEADING IS "Cutting take-off", NOT "Concrete cutting", AND DELIBERATELY
// SO. ScopeCuttingSheet already renders a heading reading exactly "Concrete
// cutting". Two sections on one card answering to the same name is a defect
// for the estimator before it is a defect for a test, and it is what turned
// `tendering-e2e` red on #1682: `getByText("Concrete cutting")` resolved to
// two elements. Note that substring matching means "Concrete cutting take-off"
// would NOT have fixed it — the name must not contain that phrase at all. The
// test file asserts this section's rendered markup contains no "Concrete
// cutting" anywhere, so the collision fails in unit tests rather than in e2e.
//
// THE OPEN QUESTION THIS SURFACED, WHICH THIS FILE DOES NOT SETTLE: the
// approved mock-up has ONE cutting section, and the card now carries two
// surfaces — this read-only take-off and the editable Cutrite sheet below it.
// Which of them should survive is Marco's call. Renaming this one keeps both
// legible and honest in the meantime; it is not an answer to that question.
//
// ── EVERY FIGURE COMES FROM THE SERVER'S CUTTING TAKE-OFF ────────────────
//
// THE RIG RULES ARE NOT RE-DERIVED HERE. They shipped server-side in
// `pr-estpricing-s2-cutting-rate-corrections-b` (#1437), in
// `resolveCuttingRate` (apps/api/src/modules/tendering/scope-redesign.service.ts):
//
//   - Roadsaw is floor-only, and prices Asphalt separately from Concrete.
//   - Demosaw floor is material-blind on the Cutrite sheet, and its wall rows
//     are priced in the sheet itself, so NO elevation multiplier is applied on
//     top — applying one double-loads the rate.
//   - Ringsaw wall rows already carry the premium the old x1.1 used to apply.
//   - Depth scaling for Tracksaw and Flush-cut derives from the seeded 25mm
//     floor row.
//
// A second implementation of those rules in the browser is PRECISELY the
// double-loading defect #1437 fixed. So this file:
//
//   - computes NO cutting price,
//   - applies NO multiplier,
//   - re-selects NO rig row,
//   - performs NO arithmetic on a rate — `ratePerM` is read, formatted and
//     displayed, and is never an operand.
//
// No multiplication or division operator appears anywhere in this file. The
// only additive operator is the section fold in `sumCuttingTakeOff`, which
// ADDS SERVER-COMPUTED LINE TOTALS — the same thing `computeCardBarStats`
// does for WBS items and `sumOperationalLines` does for slice 6.
//
// THE PAYLOAD. `GET /tenders/:tenderId/scope/cutting-items?cardId=:cardId`
// (apps/api/src/modules/tendering/scope-redesign.controller.ts), the endpoint
// the card already fetches through <ScopeCuttingSheet>. Each row carries the
// rig (`equipment`), `method`, `depthMm`, the length (`quantityLm`), and the
// price the server resolved (`ratePerM`, `lineTotal`). Saw-cut rows are
// created from the slice-5 `Cutting?` tick by the per-card copy-from-above
// aggregator, which reads scope items where `cuttingIncluded === true`. No API
// route, service method, DTO or schema field is added, changed or removed by
// this slice — it is web-only.
//
// MONEY. The card subtotal is computed in exactly ONE place,
// `computeCardBarStats` in DisciplineSummaryBar.tsx, folded per card in
// ScopeCardsTab's `statsByCard`, and read by BOTH the card header's "Card
// total" AND the slice-1 DisciplineSummaryBar. This section does not grow a
// second summing path: it reports its total upward through
// `onSectionTotalChange` and ScopeCardsTab adds it at that single fold point,
// exactly as slice 6 (#1681) does.
//
// ASBESTOS CARDS NEVER CUT. The gate is `showsCuttingColumn(discipline)`,
// exported from ScopeQuantitiesTable.tsx — the ERP's single source of truth
// for which disciplines cut, and the same function that gates the `Cutting?`
// tick itself. This file states no discipline code of its own.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { readApiErrorMessage } from "../../../lib/api-errors";
import { useAuth } from "../../../auth/AuthContext";
import { showsCuttingColumn, type Discipline } from "../ScopeQuantitiesTable";

// ── The payload ─────────────────────────────────────────────────────────

/** A saw-cut row's type on the cutting sheet. */
export type CuttingItemType = "saw-cut" | "core-hole" | "other-rate";

/**
 * One row of the server's cutting take-off, exactly as
 * `GET /scope/cutting-items?cardId=` returns it. Decimal columns arrive as
 * strings (Prisma.Decimal serialised); they are parsed for DISPLAY only.
 *
 * The fields this section shows are the five the slice asks for — rig
 * (`equipment`), `method`, depth (`depthMm`), length (`quantityLm`) and price
 * (`ratePerM` / `lineTotal`) — plus the WBS ref and description that identify
 * which measurement the row came from.
 */
export type CuttingTakeOffRow = {
  id: string;
  wbsRef: string;
  description: string | null;
  itemType: CuttingItemType;
  /** The rig. Null until the estimator picks one on the Cutrite sheet. */
  equipment: string | null;
  elevation: string | null;
  material: string | null;
  depthMm: number | null;
  /** Length in linear metres. Decimal-as-string. */
  quantityLm: string | null;
  method: string | null;
  /** Server-resolved rate per metre. Read and displayed; never an operand. */
  ratePerM: string | null;
  /** Server-computed line total. The only figure this section sums. */
  lineTotal: string | null;
  /** True for rows the `Cutting?` tick generated via copy-from-above. */
  autoCopied: boolean;
};

// ── What a rig can physically do ────────────────────────────────────────
//
// MIRROR, NOT A SECOND RULE. This is a CAPABILITY table, not a rate table: it
// says which elevations a rig can be asked for, and it is the client-side
// mirror of `sanitiseSawElevation` in
// apps/api/src/modules/tendering/scope-redesign.service.ts:
//
//     function sanitiseSawElevation(equipment: string, elevation: string) {
//       if (equipment === "Roadsaw") return "Floor"; // Roadsaw is Floor-only
//       if (elevation === "Inverted") return "Floor";
//       return elevation;
//     }
//
// The server SILENTLY COERCES the elevation before it resolves a rate. A row
// stored as Roadsaw + Wall therefore comes back holding a FLOOR price against
// a WALL cut — a price that cannot be bought. This section refuses to print
// that number and prints the reason instead. `cutting-section.test.tsx` reads
// the server function off disk and fails if this mirror and that one diverge,
// so the two cannot drift apart the way two rate implementations did.
//
// Nothing here re-prices anything. The rate on such a row is not recomputed,
// not corrected, and not shown.
export const SAW_ELEVATIONS_BY_RIG: Readonly<Record<string, readonly string[]>> = {
  Roadsaw: ["Floor"],
  Demosaw: ["Floor", "Wall"],
  Ringsaw: ["Floor", "Wall"],
  "Flush-cut": ["Floor", "Wall"],
  Tracksaw: ["Floor", "Wall"]
};

/**
 * The sentence a row shows when the rig cannot do what the measurement asks,
 * or null when it can.
 *
 * Default-permissive on the UNKNOWN: a rig this table has never heard of, or a
 * row with no rig or no elevation picked yet, is NOT called impossible — the
 * server is the authority on pricing and an unrecognised rig is a stale-client
 * problem, not a fact about the job.
 *
 * @param rig - the row's `equipment`
 * @param elevation - the row's `elevation`
 * @returns a plain-English reason, or null when the combination is buyable
 */
export function rigCannotCut(
  rig: string | null | undefined,
  elevation: string | null | undefined
): string | null {
  if (!rig || !elevation) return null;
  const allowed = SAW_ELEVATIONS_BY_RIG[rig];
  if (!allowed) return null;
  if (allowed.includes(elevation)) return null;
  const only = allowed.length === 1 ? `${allowed[0].toLowerCase()}-only` : allowed.join(" or ");
  return `${rig} cannot cut at ${elevation} — it is ${only}. Re-pick the rig or the elevation on the cutting sheet below.`;
}

// ── Row state ───────────────────────────────────────────────────────────

/**
 * What a take-off row is:
 *   - "cannot-cut" — the rig cannot do the asked elevation. Whatever price
 *     the row holds was resolved against a DIFFERENT elevation, so it is not
 *     shown and it contributes nothing to the section total.
 *   - "unpriced"   — copy-from-above created it and no rig has been picked
 *     yet, so the server has not priced it (`lineTotal` is null).
 *   - "priced"     — the server priced it and the figure is shown as given.
 */
export type TakeOffRowState = "priced" | "unpriced" | "cannot-cut";

/**
 * Classify one take-off row. "cannot-cut" deliberately OUTRANKS a stored
 * price: the whole point is that the stored price cannot be bought.
 */
export function takeOffRowState(row: CuttingTakeOffRow): TakeOffRowState {
  if (rigCannotCut(row.equipment, row.elevation) !== null) return "cannot-cut";
  if (row.lineTotal === null || row.lineTotal === undefined) return "unpriced";
  const n = Number(row.lineTotal);
  if (!Number.isFinite(n)) return "unpriced";
  return "priced";
}

/**
 * A row's contribution to the section total: the server's own `lineTotal`,
 * read verbatim, and zero for anything that is not priced. No rate is touched.
 */
export function takeOffRowTotal(row: CuttingTakeOffRow): number {
  if (takeOffRowState(row) !== "priced") return 0;
  const n = Number(row.lineTotal);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The take-off the `Cutting?` tick produces: saw-cut rows. Core-hole and
 * other-rate rows live on their own tabs of the Cutrite sheet below, are not
 * generated from a measurement's `Cutting?` tick, and carry no rig / depth /
 * length, so they are not part of this take-off.
 */
export function sawCutTakeOff(rows: CuttingTakeOffRow[]): CuttingTakeOffRow[] {
  return rows.filter((r) => r.itemType === "saw-cut");
}

/**
 * The section total. A fold of SERVER-COMPUTED line totals and nothing else —
 * the same shape as `computeCardBarStats` for WBS items. Rows the rig cannot
 * cut contribute nothing, because their stored figure is a price for a cut
 * nobody is buying.
 */
export function sumCuttingTakeOff(rows: CuttingTakeOffRow[]): number {
  return rows.reduce((sum, row) => sum + takeOffRowTotal(row), 0);
}

/** How many rows are asking a rig for something it cannot do. */
export function countCannotCut(rows: CuttingTakeOffRow[]): number {
  return rows.filter((r) => takeOffRowState(r) === "cannot-cut").length;
}

/** How many rows are still waiting for the estimator to pick a rig. */
export function countUnpriced(rows: CuttingTakeOffRow[]): number {
  return rows.filter((r) => takeOffRowState(r) === "unpriced").length;
}

// ── Display formatting (no arithmetic) ──────────────────────────────────

/** Money as the rest of the card shows it. Parse and format; no operator. */
export function fmtCuttingMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/** A plain number, or an em dash. Parse and format; no operator. */
export function fmtCuttingNumber(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(n);
}

/** A value the estimator has not filled in yet. */
function orDash(v: string | null | undefined): string {
  return v === null || v === undefined || v === "" ? "—" : v;
}

// ── The table ───────────────────────────────────────────────────────────

const cellStyle: CSSProperties = { padding: "6px 10px", verticalAlign: "top" };
const numericCellStyle: CSSProperties = { ...cellStyle, textAlign: "right", whiteSpace: "nowrap" };
const mutedStyle: CSSProperties = { color: "var(--text-muted)" };

/**
 * SCOPE_CUTTING_V1 — one take-off row.
 *
 * A row the rig cannot cut prints the reason IN WORDS across the rate and
 * total cells instead of a figure. Exported so the suite can render it on its
 * own — the container needs an AuthProvider, this does not.
 */
export function CuttingTakeOffRowView({ row }: { row: CuttingTakeOffRow }) {
  const state = takeOffRowState(row);
  const reason = rigCannotCut(row.equipment, row.elevation);

  return (
    <tr data-testid="cutting-take-off-row" data-row-state={state}>
      <td style={cellStyle}>{row.wbsRef}</td>
      <td style={cellStyle}>{orDash(row.description)}</td>
      <td style={cellStyle}>{orDash(row.equipment)}</td>
      <td style={cellStyle}>{orDash(row.method)}</td>
      <td style={cellStyle}>{orDash(row.elevation)}</td>
      <td style={numericCellStyle}>{fmtCuttingNumber(row.depthMm)}</td>
      <td style={numericCellStyle}>{fmtCuttingNumber(row.quantityLm)}</td>
      {state === "cannot-cut" ? (
        <td
          colSpan={2}
          style={{ ...cellStyle, color: "var(--status-danger)" }}
          data-testid="cutting-row-cannot-cut"
        >
          {reason}
        </td>
      ) : state === "unpriced" ? (
        <td colSpan={2} style={{ ...cellStyle, ...mutedStyle }} data-testid="cutting-row-unpriced">
          Not yet priced — pick a rig on the cutting sheet below.
        </td>
      ) : (
        <>
          <td style={numericCellStyle} data-testid="cutting-row-rate">
            {fmtCuttingMoney(row.ratePerM)}
          </td>
          <td style={numericCellStyle} data-testid="cutting-row-total">
            {fmtCuttingMoney(row.lineTotal)}
          </td>
        </>
      )}
    </tr>
  );
}

/**
 * SCOPE_CUTTING_V1 — the section body: heading, the take-off table and the
 * section total.
 *
 * Presentational and auth-free, so the suite can render it directly. It also
 * owns the discipline gate, through `showsCuttingColumn` — an asbestos card
 * renders NOTHING at all, not an empty section.
 */
export function CuttingTakeOff({
  discipline,
  rows,
  loading = false,
  error = null
}: {
  discipline: Discipline;
  rows: CuttingTakeOffRow[];
  loading?: boolean;
  error?: string | null;
}) {
  // Asbestos cards never cut. Single source of truth, shared with the
  // `Cutting?` tick this take-off is downstream of.
  if (!showsCuttingColumn(discipline)) return null;

  const takeOff = sawCutTakeOff(rows);
  const sectionTotal = sumCuttingTakeOff(takeOff);
  const cannotCut = countCannotCut(takeOff);
  const unpriced = countUnpriced(takeOff);

  return (
    <section className="s7-card" style={{ marginTop: 16 }} data-testid="scope-cutting-section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
          flexWrap: "wrap"
        }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Cutting take-off
          <span style={{ fontSize: 12, ...mutedStyle, marginLeft: 8 }}>
            ({takeOff.length} row{takeOff.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div style={{ fontSize: 13, ...mutedStyle }}>
          Section total:{" "}
          <strong style={{ color: "var(--text)" }} data-testid="cutting-section-total">
            {fmtCuttingMoney(sectionTotal)}
          </strong>
        </div>
      </div>

      <p style={{ fontSize: 12, ...mutedStyle, margin: "0 0 12px" }}>
        Every measurement ticked <strong>Cutting?</strong> on this card, with the rig it will be cut
        with and the price the rate library resolved for it. Every figure below is the server&apos;s —
        rig selection, depth scaling and elevation loading are decided once, in the cutting rate
        resolver, and shown here unchanged. This section&apos;s total rolls into the card total
        above and into the discipline bar; it is not added anywhere else.
      </p>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={mutedStyle}>Loading…</p>
      ) : takeOff.length === 0 ? (
        <p style={{ ...mutedStyle, fontSize: 13 }} data-testid="cutting-section-empty">
          Nothing ticked for cutting on this card yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="s7-table" aria-label="Cutting take-off">
            <thead>
              <tr>
                <th>WBS</th>
                <th>Description</th>
                <th>Rig</th>
                <th>Method</th>
                <th>Elevation</th>
                <th style={{ textAlign: "right" }}>Depth (mm)</th>
                <th style={{ textAlign: "right" }}>Length (Lm)</th>
                <th style={{ textAlign: "right" }}>Rate ($/m)</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {takeOff.map((row) => (
                <CuttingTakeOffRowView key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cannotCut > 0 ? (
        <p
          style={{ fontSize: 12, color: "var(--status-danger)", margin: "8px 0 0" }}
          data-testid="cutting-section-cannot-cut-note"
        >
          {cannotCut} row{cannotCut === 1 ? "" : "s"} ask{cannotCut === 1 ? "s" : ""} a rig for a cut
          it cannot make. Those rows carry no price here and add nothing to the card total.
        </p>
      ) : null}

      {unpriced > 0 ? (
        <p
          style={{ fontSize: 12, ...mutedStyle, margin: "8px 0 0" }}
          data-testid="cutting-section-unpriced-note"
        >
          {unpriced} row{unpriced === 1 ? "" : "s"} still need{unpriced === 1 ? "s" : ""} a rig
          picked on the cutting sheet below before the server can price {unpriced === 1 ? "it" : "them"}.
        </p>
      ) : null}
    </section>
  );
}

// ── Container ───────────────────────────────────────────────────────────

/**
 * SCOPE_CUTTING_V1 — the section as the card mounts it.
 *
 * Reads the card's cutting take-off from the endpoint the card already
 * fetches, and reports the section total upward so ScopeCardsTab can fold it
 * into the ONE place card money is computed. This component never renders a
 * card subtotal of its own, and never prices a cut.
 *
 * @param onSectionTotalChange - reports this section's total upward
 * @param reloadKey - bump to re-read the take-off after the sheet below edits it
 */
export function CuttingSection({
  tenderId,
  cardId,
  discipline,
  onSectionTotalChange,
  reloadKey
}: {
  tenderId: string;
  cardId: string;
  discipline: Discipline;
  onSectionTotalChange?: (cardId: string, total: number) => void;
  reloadKey?: number;
}) {
  const { authFetch } = useAuth();

  const [rows, setRows] = useState<CuttingTakeOffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Asbestos cards never cut, so nothing is fetched for one either.
  const cuts = showsCuttingColumn(discipline);

  const load = useCallback(async () => {
    if (!cuts) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/tenders/${tenderId}/scope/cutting-items?cardId=${encodeURIComponent(cardId)}`
      );
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setRows((await res.json()) as CuttingTakeOffRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, cardId, cuts, tenderId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const sectionTotal = useMemo(() => sumCuttingTakeOff(sawCutTakeOff(rows)), [rows]);

  // Report upward. Deliberately NOT a card subtotal — see the file header.
  useEffect(() => {
    onSectionTotalChange?.(cardId, sectionTotal);
  }, [onSectionTotalChange, cardId, sectionTotal]);

  return <CuttingTakeOff discipline={discipline} rows={rows} loading={loading} error={error} />;
}
