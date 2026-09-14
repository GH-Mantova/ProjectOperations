import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { NoAccess } from "../components/NoAccess";
import { readApiErrorMessage } from "../lib/api-errors";

// ── Types ─────────────────────────────────────────────────────────────────────

type VariationRow = {
  kind: "VARIATION";
  id: string;
  number: string;
  description: string;
  status: string;
  sorVersion: string | null;
  amount: string | null;
  isEligible: boolean;
  createdAt: string;
};

type AgreedRecordRow = {
  kind: "AGREED_RECORD";
  id: string;
  number: string;
  description: string;
  status: string;
  sorVersion: string | null;
  amount: string | null;
  workerSigned: boolean;
  clientRepSigned: boolean;
  isEligible: boolean;
  createdAt: string;
};

type RegisterRow = VariationRow | AgreedRecordRow;

type JobRegister = {
  jobId: string;
  contractId: string | null;
  variations: VariationRow[];
  agreedRecords: AgreedRecordRow[];
};

type RaiseClaimResult = {
  claimId: string;
  createdClaim: boolean;
  contractId: string;
  linesAdded: number;
  variationLinesAdded: number;
  agreedRecordLinesAdded: number;
  totalClaimed: string;
  skipped: string[];
};

// ── Status pills ──────────────────────────────────────────────────────────────

const PILL_INFO = {
  bg: "color-mix(in srgb, var(--status-info) 12%, transparent)",
  fg: "var(--status-info)",
};
const PILL_WARNING = {
  bg: "color-mix(in srgb, var(--status-warning) 15%, transparent)",
  fg: "var(--status-warning)",
};
const PILL_ACTIVE = {
  bg: "color-mix(in srgb, var(--status-active) 15%, transparent)",
  fg: "var(--status-active)",
};
const PILL_DANGER = {
  bg: "color-mix(in srgb, var(--status-danger) 12%, transparent)",
  fg: "var(--status-danger)",
};
const PILL_NEUTRAL = {
  bg: "color-mix(in srgb, var(--status-neutral) 12%, transparent)",
  fg: "var(--status-neutral)",
};

const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  DRAFT: PILL_INFO,
  SUBMITTED: PILL_WARNING,
  OFFICE_REVIEW: PILL_WARNING,
  PRICED: PILL_INFO,
  APPROVED: PILL_ACTIVE,
  SENT_BACK: PILL_DANGER,
  VOID: PILL_NEUTRAL,
  PENDING: PILL_INFO,
  REJECTED: PILL_DANGER,
};

function statusPill(status: string): { bg: string; fg: string } {
  return STATUS_PILL[status] ?? PILL_NEUTRAL;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(v: string | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Cross-reference a register row against the eligible-for-claim list to derive
 * whether the item is claimable and, if not, why.
 */
function eligibilityReason(row: RegisterRow, eligibleIds: Set<string>): string | null {
  if (eligibleIds.has(row.id)) return null;
  if (row.kind === "VARIATION") {
    return "Not approved";
  }
  // AGREED_RECORD
  const ar = row as AgreedRecordRow;
  if (ar.status !== "APPROVED") return "Not approved";
  if (!ar.workerSigned) return "Missing worker signature";
  if (!ar.clientRepSigned) return "Missing client-rep signature";
  return "Not eligible";
}

// ── Main page ─────────────────────────────────────────────────────────────────

/**
 * SoR S9b — per-job VC + AR register and raise-claim picker.
 *
 * Reads the combined register from agreed-records/register/for-job/:jobId and
 * the approved-only subset from agreed-records/register/for-job/:jobId/eligible-for-claim.
 * Writes via POST agreed-records/register/for-job/:jobId/raise-claim.
 *
 * Permission: finance.view to read, finance.manage to raise a claim.
 */
export function JobSorRegisterPage() {
  const { authFetch, user } = useAuth();
  const canView = useMemo(() => can(user, "finance.view"), [user]);
  const canManage = useMemo(() => can(user, "finance.manage"), [user]);
  const { jobId } = useParams<{ jobId: string }>();

  const [register, setRegister] = useState<JobRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [eligible, setEligible] = useState<JobRegister | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleError, setEligibleError] = useState<string | null>(null);

  // Selection + claim month
  const [selectedVariationIds, setSelectedVariationIds] = useState<Set<string>>(new Set());
  const [selectedAgreedRecordIds, setSelectedAgreedRecordIds] = useState<Set<string>>(new Set());
  const [claimMonth, setClaimMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<RaiseClaimResult | null>(null);

  // ── Load register ──────────────────────────────────────────────────────────

  const loadRegister = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/agreed-records/register/for-job/${jobId}`);
      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        setError(msg);
        return;
      }
      const data = (await res.json()) as JobRegister;
      setRegister(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [authFetch, jobId]);

  useEffect(() => {
    if (canView) void loadRegister();
  }, [canView, loadRegister]);

  // ── Open picker ────────────────────────────────────────────────────────────

  const openPicker = useCallback(async () => {
    if (!jobId) return;
    setPickerOpen(true);
    setEligibleLoading(true);
    setEligibleError(null);
    setSelectedVariationIds(new Set());
    setSelectedAgreedRecordIds(new Set());
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await authFetch(`/agreed-records/register/for-job/${jobId}/eligible-for-claim`);
      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        setEligibleError(msg);
        return;
      }
      const data = (await res.json()) as JobRegister;
      setEligible(data);
    } catch (err) {
      setEligibleError(err instanceof Error ? err.message : String(err));
    } finally {
      setEligibleLoading(false);
    }
  }, [authFetch, jobId]);

  // ── Raise claim ────────────────────────────────────────────────────────────

  const raiseClaim = useCallback(async () => {
    if (!jobId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch(`/agreed-records/register/for-job/${jobId}/raise-claim`, {
        method: "POST",
        body: JSON.stringify({
          claimMonth,
          variationIds: Array.from(selectedVariationIds),
          agreedRecordIds: Array.from(selectedAgreedRecordIds),
        }),
      });
      if (!res.ok) {
        const msg = await readApiErrorMessage(res);
        setSubmitError(msg);
        return;
      }
      const result = (await res.json()) as RaiseClaimResult;
      setSubmitSuccess(result);
      // Reload the register so the user sees the updated state.
      void loadRegister();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [authFetch, jobId, claimMonth, selectedVariationIds, selectedAgreedRecordIds, loadRegister]);

  // ── Derived state (must be above early returns per Rules of Hooks) ──────────

  const eligibleIds = useMemo<Set<string>>(() => {
    if (!eligible) return new Set<string>();
    return new Set<string>([
      ...eligible.variations.map((v) => v.id),
      ...eligible.agreedRecords.map((ar) => ar.id),
    ]);
  }, [eligible]);

  // All register rows merged for the picker (to show non-eligible items as
  // disabled with a reason).
  const allRegisterIds = useMemo(() => {
    if (!register) return { variations: [] as VariationRow[], agreedRecords: [] as AgreedRecordRow[] };
    return { variations: register.variations, agreedRecords: register.agreedRecords };
  }, [register]);

  // Combined rows for the main table.
  const allRows: RegisterRow[] = register
    ? [
        ...register.variations.map((v) => ({ ...v } as RegisterRow)),
        ...register.agreedRecords.map((ar) => ({ ...ar } as RegisterRow)),
      ]
    : [];

  // ── Permission guard ───────────────────────────────────────────────────────

  if (!canView) return <NoAccess required="finance.view" />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="s7-page">
      <header className="s7-page__header">
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>SoR Register</h1>
          {register?.contractId == null && !loading && (
            <span
              style={{
                background: "color-mix(in srgb, var(--status-warning) 15%, transparent)",
                color: "var(--status-warning)",
                borderRadius: 4,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              No linked contract — AR rows only
            </span>
          )}
        </div>
        <p className="s7-page__subtitle">
          Combined Variation Contract and Agreed Record register for this job. Approved items can be
          raised into a progress claim.
        </p>
      </header>

      {error && (
        <div className="s7-alert s7-alert--error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Raise claim button ── */}
      {canManage && !loading && !error && (
        <div style={{ marginBottom: 20 }}>
          <button
            className="s7-btn s7-btn--primary"
            onClick={() => void openPicker()}
            disabled={pickerOpen}
          >
            Raise claim
          </button>
        </div>
      )}

      {/* ── Register table ── */}
      {loading && (
        <div style={{ color: "var(--text-secondary)", padding: "24px 0" }}>Loading register...</div>
      )}

      {!loading && !error && allRows.length === 0 && (
        <div style={{ color: "var(--text-secondary)", padding: "24px 0" }}>
          No variation contracts or agreed records on this job yet.
        </div>
      )}

      {!loading && !error && allRows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="s7-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Number</th>
                <th>Description</th>
                <th>Status</th>
                <th>SoR Version</th>
                <th>Amount</th>
                <th>Signatures</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row) => {
                const pill = statusPill(row.status);
                return (
                  <tr key={row.id}>
                    <td>
                      <span
                        style={{
                          background:
                            row.kind === "VARIATION"
                              ? "color-mix(in srgb, var(--status-info) 12%, transparent)"
                              : "color-mix(in srgb, var(--brand-primary) 12%, transparent)",
                          color:
                            row.kind === "VARIATION"
                              ? "var(--status-info)"
                              : "var(--brand-primary)",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.kind === "VARIATION" ? "VC" : "AR"}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.number}</td>
                    <td style={{ color: "var(--text-primary)" }}>{row.description}</td>
                    <td>
                      <span
                        style={{
                          background: pill.bg,
                          color: pill.fg,
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {row.sorVersion ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{fmtMoney(row.amount)}</td>
                    <td style={{ fontSize: 12 }}>
                      {row.kind === "AGREED_RECORD" ? (
                        <span>
                          <span
                            style={{
                              color: row.workerSigned ? "var(--status-active)" : "var(--text-muted)",
                              marginRight: 6,
                            }}
                            title={row.workerSigned ? "Worker signed" : "Worker not signed"}
                          >
                            {row.workerSigned ? "W" : "w"}
                          </span>
                          <span
                            style={{ color: row.clientRepSigned ? "var(--status-active)" : "var(--text-muted)" }}
                            title={row.clientRepSigned ? "Client rep signed" : "Client rep not signed"}
                          >
                            {row.clientRepSigned ? "C" : "c"}
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Raise-claim picker modal ── */}
      {pickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Raise claim"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--surface-card)",
              borderRadius: 10,
              padding: 28,
              maxWidth: 680,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Raise claim</h2>
              <button
                onClick={() => setPickerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  lineHeight: 1,
                  padding: "0 4px",
                }}
                aria-label="Close"
              >
                x
              </button>
            </div>

            {/* Claim month input */}
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="claim-month"
                style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}
              >
                Claim month
              </label>
              <input
                id="claim-month"
                type="month"
                value={claimMonth.slice(0, 7)}
                onChange={(e) => {
                  const v = e.target.value;
                  setClaimMonth(v ? `${v}-01` : "");
                }}
                style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              />
            </div>

            {/* Eligible / non-eligible picker list */}
            {eligibleLoading && (
              <div style={{ color: "var(--text-secondary)", padding: "12px 0" }}>Loading eligible items...</div>
            )}

            {eligibleError && (
              <div
                style={{
                  background: "color-mix(in srgb, var(--status-danger) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--status-danger) 40%, transparent)",
                  borderRadius: 6,
                  padding: "8px 14px",
                  marginBottom: 16,
                  color: "var(--status-danger)",
                  fontSize: 13,
                }}
              >
                {eligibleError}
              </div>
            )}

            {!eligibleLoading && !eligibleError && register && (
              <>
                {/* Variation Contracts section */}
                {allRegisterIds.variations.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 8,
                        color: "var(--status-info)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Variation Contracts
                    </div>
                    {allRegisterIds.variations.map((v) => {
                      const reason = eligibilityReason(v as RegisterRow, eligibleIds);
                      const isDisabled = reason !== null;
                      const checked = selectedVariationIds.has(v.id);
                      return (
                        <label
                          key={v.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "8px 0",
                            borderBottom: "1px solid var(--border-subtle)",
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.55 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={isDisabled}
                            checked={checked}
                            onChange={(e) => {
                              setSelectedVariationIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(v.id);
                                else next.delete(v.id);
                                return next;
                              });
                            }}
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {v.number} — {v.description}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                              {fmtMoney(v.amount)}
                              {v.sorVersion ? (
                                <span style={{ marginLeft: 8 }}>SoR: {v.sorVersion}</span>
                              ) : null}
                            </div>
                            {isDisabled && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--status-danger)",
                                  marginTop: 2,
                                  fontWeight: 600,
                                }}
                              >
                                {reason}
                              </div>
                            )}
                          </div>
                          <span
                            style={{
                              ...statusPill(v.status),
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {v.status}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Agreed Records section */}
                {allRegisterIds.agreedRecords.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 8,
                        color: "var(--brand-primary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Agreed Records
                    </div>
                    {allRegisterIds.agreedRecords.map((ar) => {
                      const reason = eligibilityReason(ar as RegisterRow, eligibleIds);
                      const isDisabled = reason !== null;
                      const checked = selectedAgreedRecordIds.has(ar.id);
                      return (
                        <label
                          key={ar.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "8px 0",
                            borderBottom: "1px solid var(--border-subtle)",
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.55 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={isDisabled}
                            checked={checked}
                            onChange={(e) => {
                              setSelectedAgreedRecordIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(ar.id);
                                else next.delete(ar.id);
                                return next;
                              });
                            }}
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {ar.number} — {ar.description}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                              {fmtMoney(ar.amount)}
                              {ar.sorVersion ? (
                                <span style={{ marginLeft: 8 }}>SoR: {ar.sorVersion}</span>
                              ) : null}
                              <span style={{ marginLeft: 8 }}>
                                Worker: {ar.workerSigned ? "signed" : "unsigned"} | Client: {ar.clientRepSigned ? "signed" : "unsigned"}
                              </span>
                            </div>
                            {isDisabled && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--status-danger)",
                                  marginTop: 2,
                                  fontWeight: 600,
                                }}
                              >
                                {reason}
                              </div>
                            )}
                          </div>
                          <span
                            style={{
                              ...statusPill(ar.status),
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {ar.status}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {allRegisterIds.variations.length === 0 && allRegisterIds.agreedRecords.length === 0 && (
                  <div style={{ color: "var(--text-secondary)", padding: "8px 0" }}>
                    No items on this register to claim.
                  </div>
                )}
              </>
            )}

            {/* Submit error */}
            {submitError && (
              <div
                style={{
                  background: "color-mix(in srgb, var(--status-danger) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--status-danger) 40%, transparent)",
                  borderRadius: 6,
                  padding: "8px 14px",
                  marginBottom: 16,
                  color: "var(--status-danger)",
                  fontSize: 13,
                }}
              >
                {submitError}
              </div>
            )}

            {/* Submit success */}
            {submitSuccess && (
              <div
                style={{
                  background: "color-mix(in srgb, var(--status-active) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--status-active) 40%, transparent)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  marginBottom: 16,
                  fontSize: 13,
                  color: "var(--status-active)",
                }}
              >
                <strong>Claim raised.</strong> {submitSuccess.linesAdded} line(s) added; total{" "}
                {fmtMoney(submitSuccess.totalClaimed)}.
                {submitSuccess.skipped.length > 0 && (
                  <span style={{ marginLeft: 4, color: "var(--status-warning)" }}>
                    {submitSuccess.skipped.length} item(s) skipped (failed approval filter).
                  </span>
                )}
              </div>
            )}

            {/* Action row */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                className="s7-btn"
                onClick={() => setPickerOpen(false)}
                disabled={submitting}
                style={{
                  background: "var(--border-subtle)",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 18px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
              {!submitSuccess && (
                <button
                  className="s7-btn s7-btn--primary"
                  onClick={() => void raiseClaim()}
                  disabled={
                    submitting ||
                    eligibleLoading ||
                    (selectedVariationIds.size === 0 && selectedAgreedRecordIds.size === 0)
                  }
                  style={{
                    background: "var(--status-info)",
                    color: "var(--text-inverse)",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 18px",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor:
                      submitting ||
                      eligibleLoading ||
                      (selectedVariationIds.size === 0 && selectedAgreedRecordIds.size === 0)
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      submitting ||
                      eligibleLoading ||
                      (selectedVariationIds.size === 0 && selectedAgreedRecordIds.size === 0)
                        ? 0.6
                        : 1,
                  }}
                >
                  {submitting ? "Raising..." : "Raise claim"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
