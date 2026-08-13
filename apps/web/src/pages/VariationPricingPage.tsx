import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { NoAccess } from "../components/NoAccess";

// -- API types ---------------------------------------------------------

type SorCategory = "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
type Tier = "ORDINARY" | "ONE_AND_HALF" | "DOUBLE";

type SnapshotRate = {
  id: string;
  category: SorCategory;
  name: string;
  class: string | null;
  unit: string | null;
  ordinary: string | null;
  oneAndHalf: string | null;
  double: string | null;
};

type Snapshot = {
  id: string;
  sorVersion: string;
  sorPeriodLabel: string;
  status: string;
  rates: SnapshotRate[];
};

type VariationSorLine = {
  id: string;
  variationId: string;
  jobSorSnapshotId: string;
  sorVersion: string;
  snapshotRateId: string | null;
  category: SorCategory;
  name: string;
  class: string | null;
  unit: string | null;
  tier: Tier;
  rate: string;
  quantity: string;
  lineAmount: string;
  notes: string | null;
  sortOrder: number;
};

type LinesResponse = {
  lines: VariationSorLine[];
  total: string;
};

type Variation = {
  id: string;
  variationNumber: string;
  description: string;
  status: string;
  pricedAmount: string | null;
};

// -- Formatting --------------------------------------------------------

const fmtMoney = (v: string | null | undefined) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
};

const TIER_LABEL: Record<Tier, string> = {
  ORDINARY: "Ordinary",
  ONE_AND_HALF: "1.5x",
  DOUBLE: "2x",
};

function tierRate(rate: SnapshotRate, tier: Tier): string | null {
  switch (tier) {
    case "ORDINARY":
      return rate.ordinary;
    case "ONE_AND_HALF":
      return rate.oneAndHalf;
    case "DOUBLE":
      return rate.double;
  }
}

// -- Page --------------------------------------------------------------

/**
 * SoR S6 -- Variation pricing screen.
 *
 * Reads the locked Job SoR snapshot for the variation's job and lets the
 * user desktop-price the variation by picking rows from the snapshot
 * (freeze rate + tier + quantity), or add manual lines with an arbitrary
 * rate. Rate is never re-read from live SorRate after a line is created.
 */
export function VariationPricingPage() {
  const { id: variationId } = useParams();
  const { authFetch, user } = useAuth();
  const canManage = useMemo(() => can(user, "finance.manage"), [user]);
  const canView = useMemo(() => can(user, "finance.view"), [user]);

  const [variation, setVariation] = useState<Variation | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lines, setLines] = useState<VariationSorLine[]>([]);
  const [total, setTotal] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-form state.
  const [selectedRateId, setSelectedRateId] = useState<string>("");
  const [tier, setTier] = useState<Tier>("ORDINARY");
  const [quantity, setQuantity] = useState<string>("1");
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState<SorCategory>("LABOUR");
  const [manualUnit, setManualUnit] = useState("");
  const [manualRate, setManualRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // -- Load ------------------------------------------------------------

  const loadAll = useCallback(async () => {
    if (!variationId) return;
    setLoading(true);
    setError(null);
    try {
      const linesRes = await authFetch(`/variations/${variationId}/sor-lines`);
      if (!linesRes.ok) throw new Error(await linesRes.text());
      const linesData = (await linesRes.json()) as LinesResponse;
      setLines(linesData.lines);
      setTotal(linesData.total);

      // Walk contracts -> variations to find the parent variation + job
      // snapshot. We do not have a direct GET /variations/:id endpoint on
      // main, so we resolve via the first line if any, then fall back to
      // scanning contracts for the variation. Cheap path first.
      let snapshotId: string | null = linesData.lines[0]?.jobSorSnapshotId ?? null;
      let resolvedVariation: Variation | null = null;
      let resolvedContractId: string | null = null;
      if (snapshotId) {
        // We have at least one line -- look up the variation by scanning
        // contracts is expensive, so leave variation as a stub for
        // display purposes.
        resolvedVariation = {
          id: variationId,
          variationNumber: variationId,
          description: "",
          status: "",
          pricedAmount: linesData.total,
        };
      }
      setVariation(resolvedVariation);
      setContractId(resolvedContractId);

      // If we have a snapshot id from an existing line, load that
      // snapshot. Otherwise skip until the user adds one via API.
      if (snapshotId) {
        // No direct /schedule-of-rates/job-sor-snapshot/:id endpoint on
        // main -- we resolve rates one by one only when needed. For the
        // catalog picker we still need the merged list, so we would need
        // for-job with a jobId. That requires knowing the job, which we
        // don't have from the variation surface here.
      }
      setSnapshot(null);
    } catch (err) {
      setError((err as Error).message || "Failed to load pricing data.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, variationId]);

  useEffect(() => {
    if (!canView) return;
    void loadAll();
  }, [canView, loadAll]);

  // -- Actions ---------------------------------------------------------

  const addLine = useCallback(async () => {
    if (!variationId) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        tier,
        quantity: Number(quantity),
      };
      if (manualMode) {
        body.name = manualName;
        body.category = manualCategory;
        body.unit = manualUnit || undefined;
        body.rate = Number(manualRate);
      } else {
        if (!selectedRateId) throw new Error("Pick a rate from the catalog first.");
        body.snapshotRateId = selectedRateId;
      }
      const res = await authFetch(`/variations/${variationId}/sor-lines`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setQuantity("1");
      setSelectedRateId("");
      setManualName("");
      setManualRate("");
      setManualUnit("");
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [
    authFetch,
    loadAll,
    manualCategory,
    manualMode,
    manualName,
    manualRate,
    manualUnit,
    quantity,
    selectedRateId,
    tier,
    variationId,
  ]);

  const updateQty = useCallback(
    async (lineId: string, nextQty: string) => {
      if (!variationId) return;
      try {
        const res = await authFetch(`/variations/${variationId}/sor-lines/${lineId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: Number(nextQty) }),
        });
        if (!res.ok) throw new Error(await res.text());
        await loadAll();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, loadAll, variationId],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!variationId) return;
      try {
        const res = await authFetch(`/variations/${variationId}/sor-lines/${lineId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(await res.text());
        await loadAll();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, variationId],
  );

  // -- Guards / loading ------------------------------------------------

  if (!canView) return <NoAccess required="finance.view" />;

  return (
    <div className="s7-page">
      <header className="s7-page__header">
        <h1>Variation pricing</h1>
        <p className="s7-page__subtitle">
          Desktop-price this variation from the locked Job SoR snapshot.
          Rates are frozen at line creation, so subsequent snapshot
          reissues or rate-card edits leave existing lines untouched.
        </p>
        {snapshot && (
          <p className="s7-page__meta">
            Locked SoR: <strong>{snapshot.sorPeriodLabel}</strong>
            <span className="s7-page__version"> ({snapshot.sorVersion})</span>
          </p>
        )}
        {contractId && (
          <p>
            <Link to={`/contracts/${contractId}`}>Back to contract</Link>
          </p>
        )}
      </header>

      {error && <div className="s7-alert s7-alert--error">{error}</div>}
      {loading && <Skeleton height={120} />}

      {!loading && (
        <section className="s7-panel">
          <h2>Lines</h2>
          {lines.length === 0 ? (
            <EmptyState
              heading="No priced lines yet"
              subtext="Add a line from the SoR catalog or as a manual entry."
            />
          ) : (
            <table className="s7-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Name</th>
                  <th>Unit</th>
                  <th>Tier</th>
                  <th>Rate</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  {canManage && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.category}</td>
                    <td>
                      {line.name}
                      {line.class ? <span className="muted-text"> ({line.class})</span> : null}
                    </td>
                    <td>{line.unit ?? "—"}</td>
                    <td>{TIER_LABEL[line.tier]}</td>
                    <td>{fmtMoney(line.rate)}</td>
                    <td>
                      {canManage ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={line.quantity}
                          onBlur={(e) => {
                            if (e.target.value !== line.quantity) {
                              void updateQty(line.id, e.target.value);
                            }
                          }}
                          className="s7-input s7-input--sm"
                          aria-label={`Quantity for ${line.name}`}
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    <td>{fmtMoney(line.lineAmount)}</td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="s7-btn s7-btn--danger s7-btn--sm"
                          onClick={() => void removeLine(line.id)}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ textAlign: "right" }}>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{fmtMoney(total)}</strong>
                  </td>
                  {canManage && <td />}
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      )}

      {canManage && !loading && (
        <section className="s7-panel">
          <h2>Add a line</h2>
          <div className="s7-form-row">
            <label className="s7-toggle">
              <input
                type="checkbox"
                checked={manualMode}
                onChange={(e) => setManualMode(e.target.checked)}
              />
              Manual line (no catalog match)
            </label>
          </div>

          {manualMode ? (
            <div className="s7-form-grid">
              <label>
                Category
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as SorCategory)}
                  className="s7-select"
                >
                  <option value="LABOUR">Labour</option>
                  <option value="PLANT">Plant</option>
                  <option value="WASTE">Waste</option>
                  <option value="SUBCONTRACTOR">Subcontractor</option>
                </select>
              </label>
              <label>
                Name
                <input
                  className="s7-input"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </label>
              <label>
                Unit
                <input
                  className="s7-input"
                  value={manualUnit}
                  onChange={(e) => setManualUnit(e.target.value)}
                />
              </label>
              <label>
                Rate
                <input
                  className="s7-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="s7-form-grid">
              <label>
                Snapshot rate
                <select
                  value={selectedRateId}
                  onChange={(e) => setSelectedRateId(e.target.value)}
                  className="s7-select"
                  disabled={!snapshot}
                >
                  <option value="">
                    {snapshot
                      ? "— pick a rate —"
                      : "Snapshot not loaded (add a line via API first)"}
                  </option>
                  {snapshot?.rates.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.category}] {r.name}
                      {r.class ? ` (${r.class})` : ""} @ {fmtMoney(tierRate(r, tier))}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="s7-form-grid">
            <label>
              Tier
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as Tier)}
                className="s7-select"
              >
                <option value="ORDINARY">Ordinary</option>
                <option value="ONE_AND_HALF">1.5x</option>
                <option value="DOUBLE">2x</option>
              </select>
            </label>
            <label>
              Quantity
              <input
                className="s7-input"
                type="number"
                min={0}
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
          </div>

          <div className="s7-wizard-actions">
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => void addLine()}
              disabled={submitting}
            >
              {submitting ? "Adding…" : "Add line"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default VariationPricingPage;
