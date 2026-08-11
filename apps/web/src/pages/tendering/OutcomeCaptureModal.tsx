import { useMemo, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import {
  OutcomeCapturePayload,
  TENDER_OUTCOME_REASONS,
  TENDER_OUTCOME_REASON_LABEL,
  TENDER_OUTCOME_RESULTS,
  TENDER_OUTCOME_RESULT_LABEL,
  TenderOutcomeReason,
  TenderOutcomeResult
} from "./outcomeApi";

// Map tender lifecycle status → default outcome result. Terminal-but-not-lost
// (AWARDED / CONTRACT_ISSUED / CONVERTED) is a WON; LOST is LOST; WITHDRAWN
// pre-selects NO_BID because a withdrawal is usually "we chose not to bid" —
// the user can override before saving.
function inferDefaultResult(status: string | null | undefined): TenderOutcomeResult | "" {
  if (!status) return "";
  if (status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED") return "WON";
  if (status === "LOST") return "LOST";
  if (status === "WITHDRAWN") return "NO_BID";
  return "";
}

export interface OutcomeCaptureTender {
  id: string;
  tenderNumber: string;
  title: string;
  estimatedValue?: string | null;
  status?: string | null;
}

export interface OutcomeCaptureModalProps {
  tender: OutcomeCaptureTender;
  // When present, pre-fills the result and locks nothing — the user can still
  // override. Set by the kanban drop handler; omitted by the "needs outcome"
  // backfill flow so the user picks freely.
  contextStatus?: string | null;
  onSave: (payload: OutcomeCapturePayload) => Promise<void>;
  // Skip is intentionally symmetric with Save — closes the modal, records
  // nothing. Capture is skippable-at-close by design (Marco 2026-08-10).
  onSkip: () => void;
}

/**
 * WL-1b — Prompted-but-SKIPPABLE outcome capture form.
 *
 * Save and Skip are EQUALLY weighted (matching s7-btn--ghost pattern used
 * elsewhere for "close without acting"). The reason `<select>` only renders
 * for LOST/NO_BID — WON has no bounded reason enum. No field is required by
 * the UI; the API accepts an empty payload without validation errors.
 */
export function OutcomeCaptureModal({
  tender,
  contextStatus,
  onSave,
  onSkip
}: OutcomeCaptureModalProps) {
  const defaultResult = useMemo(
    () => inferDefaultResult(contextStatus ?? tender.status ?? null),
    [contextStatus, tender.status]
  );

  const [resultType, setResultType] = useState<TenderOutcomeResult | "">(defaultResult);
  const [reason, setReason] = useState<TenderOutcomeReason | "">("");
  const [tenderValue, setTenderValue] = useState<string>(tender.estimatedValue ?? "");
  const [ourPrice, setOurPrice] = useState<string>("");
  const [competitorOrWinner, setCompetitorOrWinner] = useState<string>("");
  const [scopeSummary, setScopeSummary] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showReason = resultType === "LOST" || resultType === "NO_BID";

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: OutcomeCapturePayload = {};
      if (resultType) payload.resultType = resultType;
      if (showReason && reason) payload.reason = reason;
      if (tenderValue.trim()) payload.tenderValue = tenderValue.trim();
      if (ourPrice.trim()) payload.ourPrice = ourPrice.trim();
      if (competitorOrWinner.trim()) payload.competitorOrWinner = competitorOrWinner.trim();
      if (scopeSummary.trim()) payload.scopeSummary = scopeSummary.trim();
      if (notes.trim()) payload.notes = notes.trim();
      await onSave(payload);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CenteredModal
      title="Record tender outcome"
      subtitle={`${tender.tenderNumber} — ${tender.title}`}
      onClose={onSkip}
      busy={submitting}
      maxWidth={560}
      footer={
        <>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={onSkip}
            disabled={submitting}
          >
            Skip
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0, color: "var(--text-muted)", fontSize: 13 }}>
        Capture is optional — Skip closes without recording. Anything you enter
        is appended as a new outcome; prior outcomes are never overwritten.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Result</span>
          <select
            className="s7-input"
            value={resultType}
            onChange={(e) => {
              const next = e.target.value as TenderOutcomeResult | "";
              setResultType(next);
              if (next === "WON") setReason("");
            }}
            disabled={submitting}
          >
            <option value="">— Not recorded —</option>
            {TENDER_OUTCOME_RESULTS.map((r) => (
              <option key={r} value={r}>
                {TENDER_OUTCOME_RESULT_LABEL[r]}
              </option>
            ))}
          </select>
        </label>

        {showReason ? (
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Reason</span>
            <select
              className="s7-input"
              value={reason}
              onChange={(e) => setReason(e.target.value as TenderOutcomeReason | "")}
              disabled={submitting}
            >
              <option value="">— Select a reason —</option>
              {TENDER_OUTCOME_REASONS.map((r) => (
                <option key={r} value={r}>
                  {TENDER_OUTCOME_REASON_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Tender value</span>
            <input
              className="s7-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={tenderValue}
              onChange={(e) => setTenderValue(e.target.value)}
              disabled={submitting}
              placeholder="0.00"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Our price</span>
            <input
              className="s7-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={ourPrice}
              onChange={(e) => setOurPrice(e.target.value)}
              disabled={submitting}
              placeholder="0.00"
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Competitor or winner</span>
          <input
            className="s7-input"
            type="text"
            value={competitorOrWinner}
            onChange={(e) => setCompetitorOrWinner(e.target.value)}
            disabled={submitting}
            placeholder="e.g. Acme Contracting"
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Scope summary</span>
          <input
            className="s7-input"
            type="text"
            value={scopeSummary}
            onChange={(e) => setScopeSummary(e.target.value)}
            disabled={submitting}
            placeholder="What was actually asked for"
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Notes</span>
          <textarea
            className="s7-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            placeholder="Anything else worth knowing"
          />
        </label>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            background: "#FCEBEB",
            color: "#A32D2D",
            padding: "10px 12px",
            borderRadius: 6,
            marginTop: 12,
            fontSize: 13
          }}
        >
          {error}
        </div>
      ) : null}
    </CenteredModal>
  );
}
