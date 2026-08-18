import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { NoAccess } from "../components/NoAccess";

// ── Types ─────────────────────────────────────────────────────────────────────

type SorCategory = "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
type Tier = "ORDINARY" | "ONE_AND_HALF" | "DOUBLE";
type ArStatus =
  | "SUBMITTED"
  | "OFFICE_REVIEW"
  | "PRICED"
  | "APPROVED"
  | "SENT_BACK"
  | "VOID"
  | "DRAFT";

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

type PricingLine = {
  id: string;
  agreedRecordLineId: string;
  snapshotRateId: string | null;
  tier: string;
  rate: string;
  lineAmount: string;
  pricedById: string | null;
  pricedAt: string;
};

type ArLine = {
  id: string;
  category: SorCategory;
  resourceName: string;
  class: string | null;
  unit: string | null;
  quantity: string;
  tier: string;
  notes: string | null;
  sortOrder: number;
  pricing: PricingLine | null;
};

type AgreedRecord = {
  id: string;
  recordNumber: string;
  description: string;
  workDate: string;
  status: ArStatus;
  jobSorSnapshotId: string | null;
  totalPricedAmount: string | null;
  sentBackReason: string | null;
  reviewerId: string | null;
  approvedById: string | null;
  submittedAt: string | null;
  lines: ArLine[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<Tier, string> = {
  ORDINARY: "Ordinary",
  ONE_AND_HALF: "1.5x",
  DOUBLE: "2x",
};

const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: "ORDINARY", label: "Ordinary" },
  { value: "ONE_AND_HALF", label: "1.5x" },
  { value: "DOUBLE", label: "2x" },
];

const CATEGORY_LABELS: Record<SorCategory, string> = {
  LABOUR: "Labour",
  PLANT: "Plant",
  WASTE: "Waste",
  SUBCONTRACTOR: "Subcontractor",
};

const STATUS_PILL: Record<ArStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: "#E0F2F1", fg: "#005B61" },
  SUBMITTED: { bg: "#FEF9C3", fg: "#713F12" },
  OFFICE_REVIEW: { bg: "#FEF3C7", fg: "#92400E" },
  PRICED: { bg: "#EDE9FE", fg: "#5B21B6" },
  APPROVED: { bg: "#DCFCE7", fg: "#166534" },
  SENT_BACK: { bg: "#FEE2E2", fg: "#991B1B" },
  VOID: { bg: "#F3F4F6", fg: "#6B7280" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU");
}

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

function resolveTierRate(rate: SnapshotRate, tier: Tier): string | null {
  if (tier === "ONE_AND_HALF") return rate.oneAndHalf;
  if (tier === "DOUBLE") return rate.double;
  return rate.ordinary;
}

function computeLineAmount(rate: string, quantity: string): string {
  const r = Number(rate);
  const q = Number(quantity);
  if (Number.isNaN(r) || Number.isNaN(q)) return "0.00";
  return (r * q).toFixed(2);
}

// ── Main page ─────────────────────────────────────────────────────────────────

/**
 * AgreedRecordOfficeReviewPage — SoR S8 office queue + detail.
 *
 * Office (WHS&CC / Ops Manager) views, prices, approves, or sends back
 * Agreed Records submitted by field crews. Reads the FROZEN job SoR snapshot
 * for pricing — never the live SorRate table.
 *
 * Permission: rates.manage (same as SoR rate-book; enforced here and at the API).
 */
export function AgreedRecordOfficeReviewPage() {
  const { user, accessToken } = useAuth();

  if (!can(user, "rates.manage")) {
    return <NoAccess required="rates.manage" />;
  }

  return <AgreedRecordOfficeReviewInner token={accessToken!} userId={user?.id ?? ""} />;
}

function AgreedRecordOfficeReviewInner({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const [queue, setQueue] = useState<AgreedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgreedRecord | null>(null);
  const [snapshotRates, setSnapshotRates] = useState<SnapshotRate[]>([]);
  const [sendBackReason, setSendBackReason] = useState("");
  const [showSendBack, setShowSendBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Per-line pricing state: lineId -> { snapshotRateId, tier, manualRate }
  const [lineEdits, setLineEdits] = useState<
    Record<string, { snapshotRateId: string | null; tier: Tier; manualRate: string }>
  >({});

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  // ── Load queue ──────────────────────────────────────────────────────────

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agreed-records/review-queue", { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AgreedRecord[];
      setQueue(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  // ── Open detail ──────────────────────────────────────────────────────────

  const openDetail = useCallback(
    async (ar: AgreedRecord) => {
      setSelectedId(ar.id);
      setDetail(ar);
      setShowSendBack(false);
      setSendBackReason("");
      setStatusMsg(null);

      // Initialize line edit state from current pricing
      const edits: typeof lineEdits = {};
      for (const line of ar.lines) {
        edits[line.id] = {
          snapshotRateId: line.pricing?.snapshotRateId ?? null,
          tier: (line.pricing?.tier as Tier) ?? "ORDINARY",
          manualRate: line.pricing ? line.pricing.rate : "",
        };
      }
      setLineEdits(edits);

      // Load snapshot rates if we have a snapshot
      if (ar.jobSorSnapshotId) {
        try {
          const res = await fetch(`/api/job-sor-snapshots/${ar.jobSorSnapshotId}`, {
            headers: headers(),
          });
          if (res.ok) {
            const snap = (await res.json()) as { rates: SnapshotRate[] };
            setSnapshotRates(snap.rates ?? []);
          }
        } catch {
          setSnapshotRates([]);
        }
      } else {
        setSnapshotRates([]);
      }
    },
    [headers],
  );

  // ── API actions ──────────────────────────────────────────────────────────

  async function apiPost(path: string, body?: unknown) {
    const res = await fetch(`/api/agreed-records/${path}`, {
      method: "POST",
      headers: headers(),
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(txt);
    }
    return res.json() as Promise<AgreedRecord>;
  }

  async function apiPatch(path: string, body: unknown) {
    const res = await fetch(`/api/agreed-records/${path}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(txt);
    }
    return res.json() as Promise<unknown>;
  }

  function refreshDetail(updated: AgreedRecord) {
    setDetail(updated);
    setQueue((prev) => prev.map((ar) => (ar.id === updated.id ? updated : ar)));
  }

  async function handleTakeReview() {
    if (!detail) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const updated = await apiPost(`${detail.id}/take-review`);
      refreshDetail(updated);
      setStatusMsg("Taken into review.");
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePriceLine(lineId: string) {
    if (!detail) return;
    const edit = lineEdits[lineId];
    if (!edit) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const body: Record<string, unknown> = { tier: edit.tier };
      if (edit.snapshotRateId) {
        body.snapshotRateId = edit.snapshotRateId;
      } else {
        body.snapshotRateId = null;
        body.rate = Number(edit.manualRate);
      }
      await apiPost(`${detail.id}/lines/${lineId}/price`, body);
      // Refresh detail
      const res = await fetch(`/api/agreed-records/review-queue`, { headers: headers() });
      if (res.ok) {
        const q = (await res.json()) as AgreedRecord[];
        const fresh = q.find((ar) => ar.id === detail.id);
        if (fresh) {
          setDetail(fresh);
          setQueue(q);
        }
      }
      setStatusMsg(`Line priced.`);
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalisePricing() {
    if (!detail) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const updated = await apiPost(`${detail.id}/finalise-pricing`);
      refreshDetail(updated);
      setStatusMsg("Pricing finalised. Ops Manager notified.");
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!detail) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const updated = await apiPost(`${detail.id}/approve`);
      refreshDetail(updated);
      setStatusMsg("Approved.");
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendBack() {
    if (!detail || !sendBackReason.trim()) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const updated = await apiPost(`${detail.id}/send-back`, { reason: sendBackReason.trim() });
      refreshDetail(updated);
      setShowSendBack(false);
      setSendBackReason("");
      setStatusMsg("Sent back to worker.");
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "sans-serif" }}>
      {/* ── Queue list panel ── */}
      <div
        style={{
          width: 320,
          borderRight: "1px solid #E5E7EB",
          overflowY: "auto",
          background: "#F9FAFB",
          padding: "16px 0",
        }}
      >
        <div style={{ padding: "0 16px 12px", fontWeight: 600, fontSize: 15 }}>
          Office Review Queue
        </div>
        {loading && (
          <div style={{ padding: "12px 16px", color: "#6B7280" }}>Loading…</div>
        )}
        {error && (
          <div style={{ padding: "12px 16px", color: "#991B1B" }}>Error: {error}</div>
        )}
        {!loading && !error && queue.length === 0 && (
          <div style={{ padding: "12px 16px", color: "#6B7280" }}>
            No ARs awaiting office review.
          </div>
        )}
        {queue.map((ar) => {
          const pill = STATUS_PILL[ar.status] ?? STATUS_PILL.VOID;
          const isSelected = ar.id === selectedId;
          return (
            <div
              key={ar.id}
              onClick={() => void openDetail(ar)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                background: isSelected ? "#EFF6FF" : "transparent",
                borderLeft: isSelected ? "3px solid #2563EB" : "3px solid transparent",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ar.recordNumber}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {ar.description}
              </div>
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    background: pill.bg,
                    color: pill.fg,
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {ar.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                Submitted: {fmtDate(ar.submittedAt)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail panel ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {!detail && (
          <div style={{ color: "#6B7280", marginTop: 40, textAlign: "center" }}>
            Select an Agreed Record to review.
          </div>
        )}

        {detail && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                {detail.recordNumber}
              </h2>
              <span
                style={{
                  background: STATUS_PILL[detail.status]?.bg ?? "#F3F4F6",
                  color: STATUS_PILL[detail.status]?.fg ?? "#374151",
                  borderRadius: 4,
                  padding: "2px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {detail.status}
              </span>
            </div>
            <p style={{ color: "#6B7280", marginTop: 4 }}>{detail.description}</p>

            {detail.totalPricedAmount != null && (
              <div
                style={{
                  background: "#EDE9FE",
                  border: "1px solid #C4B5FD",
                  borderRadius: 6,
                  padding: "10px 16px",
                  marginBottom: 16,
                  display: "inline-block",
                }}
              >
                <span style={{ fontWeight: 600, color: "#5B21B6" }}>Total priced: </span>
                <span style={{ fontWeight: 700, color: "#5B21B6" }}>
                  {fmtMoney(detail.totalPricedAmount)}
                </span>
              </div>
            )}

            {detail.sentBackReason && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 6,
                  padding: "10px 16px",
                  marginBottom: 16,
                }}
              >
                <strong style={{ color: "#991B1B" }}>Sent back: </strong>
                <span style={{ color: "#7F1D1D" }}>{detail.sentBackReason}</span>
              </div>
            )}

            {/* Status message */}
            {statusMsg && (
              <div
                style={{
                  background: statusMsg.startsWith("Error") ? "#FEF2F2" : "#F0FDF4",
                  border: `1px solid ${statusMsg.startsWith("Error") ? "#FCA5A5" : "#BBF7D0"}`,
                  borderRadius: 6,
                  padding: "8px 14px",
                  marginBottom: 16,
                  color: statusMsg.startsWith("Error") ? "#991B1B" : "#166534",
                  fontSize: 13,
                }}
              >
                {statusMsg}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
              {detail.status === "SUBMITTED" && (
                <ActionButton onClick={() => void handleTakeReview()} busy={busy}>
                  Take into review
                </ActionButton>
              )}
              {detail.status === "OFFICE_REVIEW" && (
                <ActionButton
                  onClick={() => void handleFinalisePricing()}
                  busy={busy}
                  color="#7C3AED"
                >
                  Finalise pricing
                </ActionButton>
              )}
              {detail.status === "PRICED" && (
                <ActionButton
                  onClick={() => void handleApprove()}
                  busy={busy}
                  color="#059669"
                >
                  Approve
                </ActionButton>
              )}
              {(detail.status === "OFFICE_REVIEW" || detail.status === "PRICED") && (
                <ActionButton
                  onClick={() => setShowSendBack((v) => !v)}
                  busy={busy}
                  color="#DC2626"
                >
                  Send back
                </ActionButton>
              )}
            </div>

            {/* Send-back reason form */}
            {showSendBack && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 6,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <label
                  htmlFor="sendback-reason"
                  style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#991B1B" }}
                >
                  Reason for sending back (required)
                </label>
                <textarea
                  id="sendback-reason"
                  value={sendBackReason}
                  onChange={(e) => setSendBackReason(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    border: "1px solid #FCA5A5",
                    borderRadius: 4,
                    padding: "6px 8px",
                    fontSize: 13,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                  placeholder="Describe what the worker needs to correct…"
                />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <ActionButton
                    onClick={() => void handleSendBack()}
                    busy={busy}
                    color="#DC2626"
                    disabled={!sendBackReason.trim()}
                  >
                    Confirm send back
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      setShowSendBack(false);
                      setSendBackReason("");
                    }}
                    busy={false}
                    color="#6B7280"
                  >
                    Cancel
                  </ActionButton>
                </div>
              </div>
            )}

            {/* Lines table */}
            <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Lines</h3>
            {detail.lines.length === 0 && (
              <div style={{ color: "#6B7280" }}>No lines on this record.</div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  minWidth: 700,
                }}
              >
                <thead>
                  <tr style={{ background: "#F3F4F6" }}>
                    {["Category", "Resource", "Class", "Unit", "Qty", "Tier", "Snapshot Rate", "Rate", "Line Total", ""].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 10px",
                            textAlign: "left",
                            fontWeight: 600,
                            borderBottom: "1px solid #E5E7EB",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((line) => {
                    const edit = lineEdits[line.id] ?? {
                      snapshotRateId: null,
                      tier: "ORDINARY" as Tier,
                      manualRate: "",
                    };
                    const canPrice = detail.status === "OFFICE_REVIEW";
                    const selectedRate = snapshotRates.find((r) => r.id === edit.snapshotRateId);
                    const previewRate = selectedRate
                      ? resolveTierRate(selectedRate, edit.tier)
                      : edit.manualRate || null;
                    const previewAmount =
                      previewRate != null
                        ? computeLineAmount(previewRate, line.quantity)
                        : null;

                    return (
                      <tr
                        key={line.id}
                        style={{ borderBottom: "1px solid #F3F4F6" }}
                      >
                        <td style={{ padding: "8px 10px" }}>
                          {CATEGORY_LABELS[line.category] ?? line.category}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{line.resourceName}</td>
                        <td style={{ padding: "8px 10px", color: "#6B7280" }}>
                          {line.class ?? "—"}
                        </td>
                        <td style={{ padding: "8px 10px", color: "#6B7280" }}>
                          {line.unit ?? "—"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>{line.quantity}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {canPrice ? (
                            <select
                              value={edit.tier}
                              onChange={(e) =>
                                setLineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: { ...edit, tier: e.target.value as Tier },
                                }))
                              }
                              style={{ fontSize: 12, padding: "2px 4px" }}
                            >
                              {TIER_OPTIONS.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            TIER_LABEL[line.pricing?.tier as Tier] ?? line.tier
                          )}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {canPrice ? (
                            <select
                              value={edit.snapshotRateId ?? ""}
                              onChange={(e) =>
                                setLineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: {
                                    ...edit,
                                    snapshotRateId: e.target.value || null,
                                    manualRate: e.target.value ? "" : edit.manualRate,
                                  },
                                }))
                              }
                              style={{ fontSize: 12, padding: "2px 4px", maxWidth: 180 }}
                            >
                              <option value="">-- manual override --</option>
                              {snapshotRates.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                  {r.class ? ` (${r.class})` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ color: "#6B7280" }}>
                              {line.pricing?.snapshotRateId
                                ? snapshotRates.find((r) => r.id === line.pricing!.snapshotRateId)
                                    ?.name ?? "—"
                                : "Manual"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {canPrice && !edit.snapshotRateId ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={edit.manualRate}
                              onChange={(e) =>
                                setLineEdits((prev) => ({
                                  ...prev,
                                  [line.id]: { ...edit, manualRate: e.target.value },
                                }))
                              }
                              style={{
                                width: 80,
                                fontSize: 12,
                                padding: "2px 4px",
                                border: "1px solid #D1D5DB",
                                borderRadius: 3,
                              }}
                              placeholder="0.00"
                            />
                          ) : (
                            <span>
                              {line.pricing
                                ? fmtMoney(line.pricing.rate)
                                : previewRate != null
                                  ? fmtMoney(previewRate)
                                  : "—"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                          {line.pricing
                            ? fmtMoney(line.pricing.lineAmount)
                            : previewAmount != null
                              ? fmtMoney(previewAmount)
                              : "—"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {canPrice && (
                            <button
                              onClick={() => void handlePriceLine(line.id)}
                              disabled={busy || (!edit.snapshotRateId && !edit.manualRate)}
                              style={{
                                background: "#7C3AED",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                padding: "4px 10px",
                                cursor: busy ? "not-allowed" : "pointer",
                                fontSize: 12,
                                opacity: busy || (!edit.snapshotRateId && !edit.manualRate) ? 0.5 : 1,
                              }}
                            >
                              Price
                            </button>
                          )}
                          {!canPrice && line.pricing && (
                            <span style={{ fontSize: 11, color: "#6B7280" }}>Priced</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helper component ──────────────────────────────────────────────────────────

function ActionButton({
  children,
  onClick,
  busy,
  color = "#2563EB",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      style={{
        background: color,
        color: "#fff",
        border: "none",
        borderRadius: 6,
        padding: "8px 18px",
        fontWeight: 600,
        fontSize: 13,
        cursor: busy || disabled ? "not-allowed" : "pointer",
        opacity: busy || disabled ? 0.6 : 1,
      }}
    >
      {busy ? "Working…" : children}
    </button>
  );
}
