// SCOPE_OTHER_COSTS_V1 — "Other operational costs", the second section inside
// a scope card.
//
// The premise this closes: a card could price manpower, plant and waste and
// nothing else. Every cost that is neither a crew nor a machine — permits,
// traffic control, scaffolding, site fees — had no home, so it was buried in a
// WBS item's description or left out of the tender.
//
// Position inside the card, fixed by the approved mock-up:
//   WBS items -> Other operational costs -> Waste -> Concrete cutting
//   -> + Add WBS item -> subtotal
// This file is the second of those; ScopeCardsTab mounts it in that slot.
//
// PERSISTENCE. Nothing here is local-only. Every line is a
// ScopeOperationalCostLine row behind the routes PR #1665 shipped:
//   GET    /tenders/:tenderId/scope/cards/:cardId/operational-costs
//   POST   /tenders/:tenderId/scope/cards/:cardId/operational-costs
//   PATCH  /tenders/:tenderId/scope/cards/:cardId/operational-costs/:lineId
//   DELETE /tenders/:tenderId/scope/cards/:cardId/operational-costs/:lineId
// (apps/api/src/modules/tendering/scope-costs.controller.ts). No API route,
// service method, DTO or schema field is added, changed or removed by this
// slice — it is web-only.
//
// MONEY. The card subtotal is computed in exactly ONE place,
// `computeCardBarStats` in DisciplineSummaryBar.tsx, folded per card in
// ScopeCardsTab's `statsByCard`, and read by BOTH the card header's "Card
// total" AND the discipline summary bar from slice 1. This section does not
// grow a second summing path: it reports its total upward through
// `onSectionTotalChange` and ScopeCardsTab adds it at that single fold point,
// so the card total and the bar can only ever move together.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { readApiErrorMessage } from "../../../lib/api-errors";
import { useAuth } from "../../../auth/AuthContext";
import { useConfirm } from "../../../hooks/useConfirm";

// ── The lump-sum rule ───────────────────────────────────────────────────
//
// MIRROR, NOT A SECOND LIST. `DURATION_BEARING_UNITS` and
// `isDurationBearingUnit` below are a verbatim mirror of
// `apps/api/src/modules/tendering/dto/scope-costs.dto.ts`, which PR #1665
// shipped and which enforces the same rule server-side (a non-duration unit
// carrying days other than 1 is a 400). Two lists that can disagree is the
// defect, so `other-operational-costs.test.tsx` reads the API DTO off disk and
// fails if this array and that one ever diverge. Change the server list and
// this one in the same commit, or the suite goes red.
//
// The API's own grounding note: "day" comes from EstimatePlantRate.unit and
// the labour rate resolver; "hr" from the subcontractor-rate DTOs; the
// plural/long spellings are a stated guess, because no unit taxonomy exists in
// the repo yet. The check is DEFAULT-DENY: an unrecognised unit is treated as
// NOT duration-bearing, so it can only ever pin a days field, never free one.
export const DURATION_BEARING_UNITS: readonly string[] = [
  "day",
  "days",
  "hr",
  "hrs",
  "hour",
  "hours",
  "shift",
  "shifts",
  "week",
  "weeks",
  "wk",
  "wks"
];

const DURATION_BEARING_SET = new Set(DURATION_BEARING_UNITS);

/**
 * True when `unit` carries a duration and a `days` value other than 1 is
 * meaningful. Null / undefined / unknown units return false (default-deny).
 * Matching is case-insensitive and whitespace-trimmed — same as the API.
 */
export function isDurationBearingUnit(unit: string | null | undefined): boolean {
  if (typeof unit !== "string") return false;
  return DURATION_BEARING_SET.has(unit.trim().toLowerCase());
}

/**
 * The days a line may actually hold, given its unit.
 *
 * A unit that carries no duration — `Ea`, `Lump sum`, anything unrecognised —
 * is PINNED at 1. The days input for such a line is rendered disabled and
 * greyed, so an estimator cannot type days against a lump sum; this function
 * is what the row and the persister both ask, so the greyed input and the
 * value we PATCH can never disagree.
 */
export function daysForUnit(unit: string | null | undefined, days: number | null): number | null {
  if (!isDurationBearingUnit(unit)) return 1;
  return days;
}

// ── Unit vocabulary offered in the dropdown ─────────────────────────────
//
// `ScopeOperationalCostLine.unit` is free text on the model, so this is a
// convenience vocabulary, not a constraint. Whether an entry is duration-
// bearing is decided by `isDurationBearingUnit` above and NOT restated here —
// the test pins that every entry this list calls duration-bearing is in the
// mirrored server list.
export const UNIT_OPTIONS: readonly string[] = [
  "Ea",
  "Lump sum",
  "day",
  "hr",
  "week",
  "m2",
  "m3",
  "tonne"
];

// ── Numbers off the wire ────────────────────────────────────────────────
//
// Prisma Decimal columns serialise as strings. Every numeric read goes
// through this so a "0" is a real zero and a "" or a null is an absence.
export function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** One persisted operational-cost line, as the API returns it. */
export type OperationalCostLine = {
  id: string;
  cardId: string;
  description: string;
  qty: string | number | null;
  unit: string | null;
  days: string | number | null;
  rate: string | number | null;
  rateOverride: string | number | null;
  plantRateId: string | null;
  sortOrder: number;
};

// ── Rate resolution — the manpower / plant override pattern ─────────────

/**
 * The rate a line actually prices at: the estimator's override when present,
 * otherwise the locked rate the line carries from the rate library.
 *
 * Same null-means-inherit semantics as `dayRateOverride` on the WBS manpower
 * and plant rows, and the same semantics the API documents for
 * `ScopeOperationalCostLine.rateOverride`: a stored 0 is a real value ("this
 * line is free"), not an absence.
 */
export function resolveLineRate(
  rate: number | null,
  rateOverride: number | null
): number | null {
  if (rateOverride !== null) return rateOverride;
  return rate;
}

/** Is the estimator's typed rate actually overriding the locked one? */
export function isRateOverridden(
  rateOverride: number | null,
  lockedRate: number | null
): boolean {
  if (rateOverride === null) return false;
  if (lockedRate === null) return true;
  return rateOverride !== lockedRate;
}

/**
 * A line's total.
 *
 * `qty x (rateOverride ?? rate)` — the formula
 * `apps/api/src/modules/tendering/scope-costs.controller.ts` states, quoted
 * verbatim: "No total is returned or stored. The line total is
 * `qty x (rateOverride ?? rate)`." Days is deliberately NOT a factor: it is a
 * duration recorded against the line, not a multiplier, and inventing a second
 * pricing formula web-side is exactly the drift the API's "no stored copy"
 * note exists to prevent. A lump-sum line therefore totals rate x qty.
 */
export function operationalLineTotal(
  qty: number | null,
  rate: number | null,
  rateOverride: number | null
): number | null {
  const resolved = resolveLineRate(rate, rateOverride);
  if (qty === null || resolved === null) return null;
  if (!Number.isFinite(qty) || !Number.isFinite(resolved)) return null;
  return qty * resolved;
}

/**
 * The section total: the sum of the line totals, with an unpriceable line
 * (no qty, or no rate) contributing zero.
 *
 * This is the ONLY sum in this file, and it is not a card subtotal — it is
 * handed to ScopeCardsTab, which folds it into the single existing card-money
 * computation. See the file header.
 */
export function sumOperationalLines(lines: OperationalCostLine[]): number {
  return lines.reduce((sum, line) => {
    const total = operationalLineTotal(
      toNum(line.qty),
      toNum(line.rate),
      toNum(line.rateOverride)
    );
    return sum + (total ?? 0);
  }, 0);
}

export function fmtMoney(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

// ── The shared item picker ──────────────────────────────────────────────

/**
 * One row of the rate library the picker offers. Shape of
 * `GET /estimate-rates/plant`, the catalogue ScopeQuantitiesTable already
 * consumes and the same catalogue `ScopeOperationalCostLine.plantRateId`
 * points at.
 */
export type RateLibraryItem = {
  id: string;
  item: string;
  unit: string;
  rate: string | number;
  isActive?: boolean;
  category?: string | null;
};

/** What the picker hands back when the estimator chooses a library row. */
export type PickedRateItem = {
  plantRateId: string;
  description: string;
  unit: string;
  rate: number | null;
};

export const CUSTOM_ITEM_VALUE = "__custom__";

/**
 * SHARED PICKER — one picker, two consumers.
 *
 * The approved mock-up's own comment: "One picker, used by both Other
 * operational costs and a subcontract quote." It is therefore built here as a
 * standalone, named export with no operational-cost vocabulary anywhere in its
 * props: it knows about a rate library, a chosen id and a free-text
 * description, and nothing about what section is rendering it. Slice 8's
 * subcontract quote imports `RateLibraryItemPicker` from this module rather
 * than growing a second picker that can drift from this one.
 *
 * The only reason it lives in this file rather than its own is that this
 * slice's scope is three paths; moving it to a file of its own later is a pure
 * re-export and changes no behaviour.
 *
 * Behaviour: choosing a library row reports the row's description, unit and
 * rate upward in one `onPick`; choosing "Custom item" clears the library link
 * and hands the free-text field to the estimator. A line whose library row was
 * later removed (`plantRateId` set null by the schema's SetNull) falls back to
 * custom with its description intact.
 */
export function RateLibraryItemPicker({
  selectedId,
  description,
  options,
  disabled,
  ariaLabelPrefix,
  onPick,
  onDescriptionChange
}: {
  selectedId: string | null;
  description: string;
  options: readonly RateLibraryItem[];
  disabled?: boolean;
  /** e.g. "Item for operational cost row 2" — the consumer names its rows. */
  ariaLabelPrefix: string;
  onPick: (picked: PickedRateItem | null) => void;
  onDescriptionChange: (description: string) => void;
}) {
  const [localText, setLocalText] = useState(description);
  useEffect(() => {
    setLocalText(description);
  }, [description]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, RateLibraryItem[]>();
    for (const opt of options) {
      if (opt.isActive === false) continue;
      const key = opt.category ?? "Other";
      const bucket = byCategory.get(key);
      if (bucket) bucket.push(opt);
      else byCategory.set(key, [opt]);
    }
    return [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [options]);

  const knownId = selectedId !== null && options.some((o) => o.id === selectedId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}>
      <select
        className="s7-input"
        value={knownId ? (selectedId as string) : CUSTOM_ITEM_VALUE}
        disabled={disabled}
        aria-label={`${ariaLabelPrefix} — pick from the rate library`}
        title="Pick an item from the rate library, or keep it as a custom line"
        style={{ height: 28, minWidth: 200 }}
        onChange={(e) => {
          const value = e.target.value;
          if (value === CUSTOM_ITEM_VALUE) {
            onPick(null);
            return;
          }
          const match = options.find((o) => o.id === value);
          if (!match) return;
          onPick({
            plantRateId: match.id,
            description: match.item,
            unit: match.unit,
            rate: toNum(match.rate)
          });
        }}
      >
        <option value={CUSTOM_ITEM_VALUE}>Custom item…</option>
        {grouped.map(([category, items]) => (
          <optgroup key={category} label={category}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.item}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input
        className="s7-input"
        type="text"
        value={localText}
        disabled={disabled}
        aria-label={`${ariaLabelPrefix} — description`}
        placeholder="Describe this item"
        style={{ height: 28, padding: "0 4px", minWidth: 200 }}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={() => {
          const trimmed = localText.trim();
          if (trimmed === "" || trimmed === description) {
            setLocalText(description);
            return;
          }
          onDescriptionChange(trimmed);
        }}
      />
    </div>
  );
}

// ── Presentation ────────────────────────────────────────────────────────

const cellStyle: CSSProperties = {
  padding: "4px",
  borderTop: "1px solid var(--border-default, #e5e7eb)",
  verticalAlign: "top"
};

const headStyle: CSSProperties = {
  padding: "6px 4px",
  textAlign: "left",
  fontSize: 10,
  textTransform: "uppercase",
  color: "var(--text-muted)"
};

/** Patch payload a row can send. Mirrors UpsertOperationalCostLineDto's
 *  optional fields — nothing here is a field the DTO does not already take. */
export type OperationalCostPatch = {
  description?: string;
  qty?: number | null;
  unit?: string | null;
  days?: number | null;
  rate?: number | null;
  rateOverride?: number | null;
  plantRateId?: string | null;
};

/**
 * One line. Pure presentation — no context, no fetching — so the lump-sum rule
 * and the rate override can be asserted by rendering this alone.
 */
export function OperationalCostRow({
  line,
  index,
  rateOptions,
  disabled,
  onPatch,
  onRemove
}: {
  line: OperationalCostLine;
  index: number;
  rateOptions: readonly RateLibraryItem[];
  disabled?: boolean;
  onPatch: (patch: OperationalCostPatch) => void;
  onRemove: () => void;
}) {
  const label = `operational cost row ${index + 1}`;

  const qty = toNum(line.qty);
  const lockedRate = toNum(line.rate);
  const rateOverride = toNum(line.rateOverride);
  const overridden = isRateOverridden(rateOverride, lockedRate);
  const rowTotal = operationalLineTotal(qty, lockedRate, rateOverride);

  // The rule, in one place: a unit that carries no duration pins days at 1 and
  // the input is disabled, so there is no keystroke that can put anything else
  // in it. #1665 rejects the same value on the wire.
  const durationBearing = isDurationBearingUnit(line.unit);
  const shownDays = daysForUnit(line.unit, toNum(line.days)) ?? "";

  const [localQty, setLocalQty] = useState(qty === null ? "" : String(qty));
  const [localDays, setLocalDays] = useState(String(shownDays));
  const [localRate, setLocalRate] = useState(rateOverride === null ? "" : String(rateOverride));

  useEffect(() => {
    setLocalQty(qty === null ? "" : String(qty));
  }, [qty]);
  useEffect(() => {
    setLocalDays(String(daysForUnit(line.unit, toNum(line.days)) ?? ""));
  }, [line.unit, line.days]);
  useEffect(() => {
    setLocalRate(rateOverride === null ? "" : String(rateOverride));
  }, [rateOverride]);

  const unitOptions = useMemo(() => {
    const seen = new Set(UNIT_OPTIONS);
    const extra = line.unit && !seen.has(line.unit) ? [line.unit] : [];
    return [...extra, ...UNIT_OPTIONS];
  }, [line.unit]);

  return (
    <tr data-testid="other-cost-row" data-line-id={line.id}>
      {/* Item — the shared picker. */}
      <td style={cellStyle}>
        <RateLibraryItemPicker
          selectedId={line.plantRateId}
          description={line.description}
          options={rateOptions}
          disabled={disabled}
          ariaLabelPrefix={`Item for ${label}`}
          onPick={(picked) => {
            if (!picked) {
              onPatch({ plantRateId: null });
              return;
            }
            // Picking a library row re-pins days: a library row whose unit
            // carries no duration cannot arrive holding the 3 days the
            // estimator typed while it was a "day" line — the API would
            // reject that PATCH, and it should.
            onPatch({
              plantRateId: picked.plantRateId,
              description: picked.description,
              unit: picked.unit,
              rate: picked.rate,
              days: daysForUnit(picked.unit, toNum(line.days))
            });
          }}
          onDescriptionChange={(description) => onPatch({ description })}
        />
      </td>

      {/* Qty */}
      <td style={cellStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          value={localQty}
          disabled={disabled}
          aria-label={`Qty for ${label}`}
          data-testid="other-cost-qty"
          style={{ width: 70, height: 28, padding: "0 4px", textAlign: "right" }}
          onChange={(e) => setLocalQty(e.target.value)}
          onBlur={() => onPatch({ qty: localQty === "" ? null : toNum(localQty) })}
        />
      </td>

      {/* Unit */}
      <td style={cellStyle}>
        <select
          className="s7-input"
          value={line.unit ?? ""}
          disabled={disabled}
          aria-label={`Unit for ${label}`}
          data-testid="other-cost-unit"
          style={{ height: 28, minWidth: 96 }}
          onChange={(e) => {
            const unit = e.target.value === "" ? null : e.target.value;
            // Days is re-pinned in the SAME patch that changes the unit.
            // #1665's PATCH checks the EFFECTIVE unit/days pair, so sending
            // the unit alone against a stored days of 3 would be a 400.
            onPatch({ unit, days: daysForUnit(unit, toNum(line.days)) });
          }}
        >
          <option value="">—</option>
          {unitOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>

      {/* Days — pinned at 1 and greyed for a unit that carries no duration. */}
      <td style={cellStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.5"
          value={localDays}
          disabled={disabled || !durationBearing}
          readOnly={!durationBearing}
          aria-label={`Days for ${label}`}
          data-testid="other-cost-days"
          data-days-pinned={durationBearing ? "false" : "true"}
          title={
            durationBearing
              ? "Days for this line"
              : `“${line.unit ?? "—"}” carries no duration — days is pinned at 1`
          }
          style={{
            width: 60,
            height: 28,
            padding: "0 4px",
            textAlign: "right",
            background: durationBearing ? undefined : "var(--surface-muted, #F6F6F6)",
            color: durationBearing ? undefined : "var(--text-muted)"
          }}
          onChange={(e) => setLocalDays(e.target.value)}
          onBlur={() => {
            if (!durationBearing) return;
            onPatch({ days: localDays === "" ? null : toNum(localDays) });
          }}
        />
      </td>

      {/* Rate — the manpower/plant override pattern: the locked rate is the
          placeholder, typing overrides it, and the revert control NAMES the
          rate it returns to rather than saying "auto-derived value". */}
      <td style={{ ...cellStyle, textAlign: "right" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: overridden ? "var(--surface-override, #FDD387)" : undefined,
            borderRadius: "var(--radius-sm, 4px)",
            padding: overridden ? "0 2px" : undefined
          }}
        >
          <input
            className="s7-input"
            type="number"
            step="0.01"
            value={localRate}
            disabled={disabled}
            placeholder={lockedRate !== null ? String(lockedRate) : "—"}
            aria-label={`Rate for ${label}`}
            data-testid="other-cost-rate"
            title={
              lockedRate !== null
                ? `Locked rate: ${fmtMoney(lockedRate)}${overridden ? " (overridden)" : ""}`
                : "No library rate — type one"
            }
            style={{
              width: 84,
              height: 28,
              padding: "0 4px",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums"
            }}
            onChange={(e) => setLocalRate(e.target.value)}
            onBlur={() => {
              if (localRate === "") {
                onPatch({ rateOverride: null });
                return;
              }
              const n = toNum(localRate);
              if (n !== null) onPatch({ rateOverride: n });
            }}
          />
          {overridden ? (
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              data-testid="other-cost-rate-revert"
              /* The control names what it returns to. "Revert to auto-derived
                 value" — the generic OverrideField wording — does not tell an
                 estimator which number they are about to get back. */
              aria-label={
                lockedRate !== null
                  ? `Revert rate for ${label} to the locked rate ${fmtMoney(lockedRate)}`
                  : `Clear the rate override for ${label}`
              }
              title={
                lockedRate !== null
                  ? `Revert to the locked rate ${fmtMoney(lockedRate)}`
                  : "Clear this rate override"
              }
              onClick={() => {
                setLocalRate("");
                onPatch({ rateOverride: null });
              }}
            >
              ↺ {lockedRate !== null ? fmtMoney(lockedRate) : "clear"}
            </button>
          ) : null}
        </span>
      </td>

      {/* Total */}
      <td
        style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        data-testid="other-cost-total"
        title="Qty x Rate — the formula the API states for this line"
      >
        {fmtMoney(rowTotal)}
      </td>

      {/* Row remove */}
      <td style={{ ...cellStyle, textAlign: "center" }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={disabled}
          aria-label={`Remove ${label}`}
          title="Remove this line"
          data-testid="other-cost-remove"
          onClick={onRemove}
        >
          ×
        </button>
      </td>
    </tr>
  );
}

const COLUMNS = ["Item", "Qty", "Unit", "Days", "Rate", "Total", ""] as const;

/**
 * The table. Pure presentation, so a test can render it without an auth
 * provider or a fetch stub.
 */
export function OperationalCostLinesTable({
  lines,
  rateOptions,
  disabled,
  onPatchLine,
  onRemoveLine
}: {
  lines: OperationalCostLine[];
  rateOptions: readonly RateLibraryItem[];
  disabled?: boolean;
  onPatchLine: (lineId: string, patch: OperationalCostPatch) => void;
  onRemoveLine: (lineId: string) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
          <tr>
            {COLUMNS.map((h, i) => (
              <th key={h === "" ? `blank-${i}` : h} style={headStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <OperationalCostRow
              key={line.id}
              line={line}
              index={index}
              rateOptions={rateOptions}
              disabled={disabled}
              onPatch={(patch) => onPatchLine(line.id, patch)}
              onRemove={() => onRemoveLine(line.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Container ───────────────────────────────────────────────────────────

/**
 * SCOPE_OTHER_COSTS_V1 — the section as the card mounts it.
 *
 * @param onSectionTotalChange - reports this section's total upward so
 *   ScopeCardsTab can fold it into the ONE place card money is computed. This
 *   component never renders a card subtotal of its own.
 */
export function OtherOperationalCosts({
  tenderId,
  cardId,
  canManage = true,
  onSectionTotalChange
}: {
  tenderId: string;
  cardId: string;
  canManage?: boolean;
  onSectionTotalChange?: (cardId: string, total: number) => void;
}) {
  const { authFetch } = useAuth();
  const confirm = useConfirm();

  const [lines, setLines] = useState<OperationalCostLine[]>([]);
  const [rateOptions, setRateOptions] = useState<RateLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/tenders/${tenderId}/scope/cards/${cardId}/operational-costs`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(basePath);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setLines((await res.json()) as OperationalCostLine[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, basePath]);

  useEffect(() => {
    void load();
  }, [load]);

  // The rate library the picker offers. Existing endpoint, consumed unchanged —
  // the same one ScopeQuantitiesTable reads for its plant rows, and the one
  // ScopeOperationalCostLine.plantRateId points at.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/estimate-rates/plant");
        if (!res.ok) return;
        const body = (await res.json()) as RateLibraryItem[];
        if (!cancelled) setRateOptions(body);
      } catch {
        /* the picker degrades to custom-item-only; the section still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const sectionTotal = useMemo(() => sumOperationalLines(lines), [lines]);

  // Report upward. Deliberately NOT a card subtotal — see the file header.
  useEffect(() => {
    onSectionTotalChange?.(cardId, sectionTotal);
  }, [onSectionTotalChange, cardId, sectionTotal]);

  const patchLine = useCallback(
    async (lineId: string, patch: OperationalCostPatch) => {
      setError(null);
      try {
        const res = await authFetch(`${basePath}/${lineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch)
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        const updated = (await res.json()) as OperationalCostLine;
        setLines((prev) => prev.map((l) => (l.id === lineId ? updated : l)));
      } catch (err) {
        setError((err as Error).message);
        // The server refused; re-read so the row shows what is actually
        // stored rather than what was typed.
        void load();
      }
    },
    [authFetch, basePath, load]
  );

  const addLine = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "New operational cost",
          qty: 1,
          // A new line starts as a lump sum: no duration, days pinned at 1 —
          // the value #1665 accepts for a non-duration unit.
          unit: "Lump sum",
          days: 1,
          sortOrder: lines.length
        })
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const created = (await res.json()) as OperationalCostLine;
      setLines((prev) => [...prev, created]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, basePath, lines.length]);

  const removeLine = useCallback(
    async (lineId: string) => {
      const line = lines.find((l) => l.id === lineId);
      const ok = await confirm({
        title: "Remove this operational cost?",
        message: line ? `“${line.description}” will be deleted from this card.` : undefined,
        confirmLabel: "Remove",
        variant: "danger"
      });
      if (!ok) return;
      setError(null);
      try {
        const res = await authFetch(`${basePath}/${lineId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await readApiErrorMessage(res));
        setLines((prev) => prev.filter((l) => l.id !== lineId));
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, basePath, confirm, lines]
  );

  return (
    <section className="s7-card" style={{ marginTop: 16 }} data-testid="scope-other-costs">
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
          Other operational costs
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
            ({lines.length} row{lines.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Section total:{" "}
          <strong style={{ color: "var(--text)" }} data-testid="other-costs-section-total">
            {fmtMoney(sectionTotal)}
          </strong>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Costs that are neither a crew nor a machine — permits, traffic control, scaffolding,
        site fees. This section&apos;s total rolls into the card total above and into the
        discipline bar; it is not added anywhere else.
      </p>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : lines.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No other operational costs on this card yet.
        </p>
      ) : (
        <OperationalCostLinesTable
          lines={lines}
          rateOptions={rateOptions}
          disabled={!canManage}
          onPatchLine={(lineId, patch) => void patchLine(lineId, patch)}
          onRemoveLine={(lineId) => void removeLine(lineId)}
        />
      )}

      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={!canManage}
          onClick={() => void addLine()}
          data-testid="other-cost-add"
        >
          + Add operational cost
        </button>
      </div>
    </section>
  );
}
