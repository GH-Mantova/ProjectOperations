import { useCallback, useEffect, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { readApiErrorMessage } from "../../lib/api-errors";
import { IS_DISCIPLINE_CODES, IS_DISCIPLINE_LABELS } from "../../constants/disciplines";

// Discipline labels and codes — imported from the single source of truth.
// apps/web/src/constants/disciplines.ts mirrors the API canonical source.
// Spread into Record<string, string> so string-typed runtime values can index
// into the map without a cast (same runtime behaviour, looser type annotation).
const DISCIPLINE_LABELS: Record<string, string> = { ...IS_DISCIPLINE_LABELS };
const DISCIPLINE_CODES = IS_DISCIPLINE_CODES;

type SubcontractorRate = {
  id: string;
  subcontractorSupplierId: string;
  discipline: string;
  unit: string;
  rate: string;
  validFrom: string | null;
  validTo: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

type RateFormState = {
  discipline: string;
  unit: string;
  rate: string;
  validFrom: string;
  validTo: string;
  notes: string;
};

const EMPTY_FORM: RateFormState = {
  discipline: "DEM",
  unit: "hr",
  rate: "",
  validFrom: "",
  validTo: "",
  notes: "",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtRate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const num = parseFloat(raw);
  if (!Number.isFinite(num)) return raw;
  return num.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function SubcontractorRatesTab({
  subcontractorSupplierId,
  canManage,
}: {
  subcontractorSupplierId: string;
  canManage: boolean;
}) {
  const { authFetch, user } = useAuth();
  const canView = can(user, "subcontractors.rates.view");

  const [rates, setRates] = useState<SubcontractorRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state: null = closed, "add" = new rate, string = id of rate to supersede
  const [modalMode, setModalMode] = useState<null | "add" | string>(null);
  const [form, setForm] = useState<RateFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(
        `/subcontractors/${subcontractorSupplierId}/rates`
      );
      if (!response.ok) throw new Error(await readApiErrorMessage(response));
      setRates((await response.json()) as SubcontractorRate[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, subcontractorSupplierId, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setSubmitError(null);
    setModalMode("add");
  };

  const openEdit = (rate: SubcontractorRate) => {
    setForm({
      discipline: rate.discipline,
      unit: rate.unit,
      rate: rate.rate,
      validFrom: "",
      validTo: "",
      notes: rate.notes ?? "",
    });
    setSubmitError(null);
    setModalMode(rate.id);
  };

  const closeModal = () => {
    setModalMode(null);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!form.rate.trim()) {
      setSubmitError("Rate is required.");
      return;
    }
    const rateNum = parseFloat(form.rate);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setSubmitError("Rate must be a valid non-negative number.");
      return;
    }
    // Format to 2 decimal places as string (API expects Decimal string)
    const rateStr = rateNum.toFixed(2);

    setSubmitting(true);
    setSubmitError(null);
    try {
      let response: Response;
      if (modalMode === "add") {
        response = await authFetch(
          `/subcontractors/${subcontractorSupplierId}/rates`,
          {
            method: "POST",
            body: JSON.stringify({
              discipline: form.discipline,
              unit: form.unit.trim() || "hr",
              rate: rateStr,
              validFrom: form.validFrom || undefined,
              validTo: form.validTo || undefined,
              notes: form.notes.trim() || undefined,
            }),
          }
        );
      } else {
        // Supersede: POST to /:id/supersede
        response = await authFetch(
          `/subcontractors/${subcontractorSupplierId}/rates/${modalMode}/supersede`,
          {
            method: "POST",
            body: JSON.stringify({
              discipline: form.discipline,
              unit: form.unit.trim() || undefined,
              rate: rateStr,
              validFrom: form.validFrom || undefined,
              validTo: form.validTo || undefined,
              notes: form.notes.trim() || undefined,
            }),
          }
        );
      }
      if (!response.ok) {
        const text = await response.text();
        let message = `Request failed (${response.status}).`;
        try {
          const parsed = JSON.parse(text) as { message?: string | string[] };
          if (Array.isArray(parsed.message)) message = parsed.message.join(" ");
          else if (parsed.message) message = String(parsed.message);
        } catch {
          if (text) message = text;
        }
        throw new Error(message);
      }
      closeModal();
      await load();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          You do not have permission to view rate cards.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ marginTop: 12 }}>
        <div
          className="s7-skeleton"
          style={{
            height: 120,
            background: "var(--surface-muted, #f3f4f6)",
            borderRadius: 6,
          }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  // Active rates shown normally; inactive (superseded) shown greyed with badge
  const activeRates = rates.filter((r) => r.isActive);
  const inactiveRates = rates.filter((r) => !r.isActive);

  const isModalOpen = modalMode !== null;
  const modalTitle =
    modalMode === "add"
      ? "Add rate"
      : modalMode !== null
      ? "Edit rate (supersede)"
      : "";

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {activeRates.length} active rate{activeRates.length === 1 ? "" : "s"}
        </div>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            style={{ minHeight: 44 }}
            onClick={openAdd}
          >
            + Add rate
          </button>
        ) : null}
      </div>

      {rates.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          No rates recorded yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {[
                  "Discipline",
                  "Unit",
                  "Rate (AUD)",
                  "Valid from",
                  "Valid to",
                  "Notes",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRates.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    {DISCIPLINE_LABELS[r.discipline] ?? r.discipline}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{r.unit}</td>
                  <td style={{ padding: "6px 8px" }}>{fmtRate(r.rate)}</td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {fmtDate(r.validFrom)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {fmtDate(r.validTo)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      maxWidth: 180,
                    }}
                  >
                    {r.notes ?? "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {canManage ? (
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => openEdit(r)}
                        title="Edit (supersede)"
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {inactiveRates.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderTop: "1px solid var(--border, #e5e7eb)",
                    opacity: 0.45,
                  }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ color: "var(--text-muted)" }}>
                      {DISCIPLINE_LABELS[r.discipline] ?? r.discipline}
                    </span>
                  </td>
                  <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                    {r.unit}
                  </td>
                  <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                    {fmtRate(r.rate)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {fmtDate(r.validFrom)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    {fmtDate(r.validTo)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      maxWidth: 180,
                    }}
                  >
                    {r.notes ?? "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        background: "var(--surface-muted, #e5e7eb)",
                        color: "var(--text-muted)",
                        borderRadius: 999,
                        textTransform: "uppercase",
                      }}
                    >
                      superseded
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen ? (
        <CenteredModal
          title={modalTitle}
          subtitle={
            modalMode !== "add"
              ? "Editing creates a new rate row and marks the old one as superseded (append-only)."
              : undefined
          }
          onClose={closeModal}
          busy={submitting}
          maxWidth={480}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={closeModal}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting
                  ? "Saving…"
                  : modalMode === "add"
                  ? "Add rate"
                  : "Save (supersede)"}
              </button>
            </>
          }
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <label
              style={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span>Discipline *</span>
              <select
                className="s7-select"
                value={form.discipline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discipline: e.target.value }))
                }
                style={{ minHeight: 44 }}
              >
                {DISCIPLINE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {DISCIPLINE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>

            <label
              style={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span>Unit *</span>
              <input
                className="s7-input"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
                placeholder="hr, day, m2, tonne…"
                maxLength={50}
                style={{ minHeight: 44 }}
              />
            </label>

            <label
              style={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span>Rate (AUD / unit) *</span>
              <input
                className="s7-input"
                type="number"
                min="0"
                step="0.01"
                value={form.rate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rate: e.target.value }))
                }
                placeholder="e.g. 125.00"
                style={{ minHeight: 44 }}
              />
            </label>

            <div />

            <label
              style={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span>Valid from (optional)</span>
              <input
                className="s7-input"
                type="date"
                value={form.validFrom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, validFrom: e.target.value }))
                }
                style={{ minHeight: 44 }}
              />
            </label>

            <label
              style={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span>Valid to (optional)</span>
              <input
                className="s7-input"
                type="date"
                value={form.validTo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, validTo: e.target.value }))
                }
                style={{ minHeight: 44 }}
              />
            </label>

            <label
              style={{
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                gridColumn: "1 / -1",
              }}
            >
              <span>Notes (optional)</span>
              <textarea
                className="s7-textarea"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                maxLength={1000}
                style={{ resize: "vertical" }}
              />
            </label>
          </div>

          {submitError ? (
            <p
              style={{
                color: "var(--status-danger)",
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {submitError}
            </p>
          ) : null}
        </CenteredModal>
      ) : null}
    </div>
  );
}
