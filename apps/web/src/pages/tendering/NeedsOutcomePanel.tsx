import { useMemo, useState } from "react";
import { OutcomeCaptureModal, OutcomeCaptureTender } from "./OutcomeCaptureModal";
import { OutcomeCapturePayload, recordOutcome } from "./outcomeApi";

// A tender is "closed" for the purposes of outcome capture when it is in a
// terminal lifecycle status. CONVERTED is included even though the kanban
// board doesn't render a CONVERTED column — a tender that was converted to
// a project skipped the kanban outcome prompt and still deserves capture.
const TERMINAL_STATUSES = new Set([
  "AWARDED",
  "CONTRACT_ISSUED",
  "CONVERTED",
  "LOST",
  "WITHDRAWN"
]);

// Minimum shape needed to detect "needs outcome". The /tenders list already
// includes outcomes (tenderInclude.outcomes = true) so no extra fetch is
// needed — the panel filters purely client-side.
export interface NeedsOutcomeCandidate {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  estimatedValue?: string | null;
  updatedAt: string;
  outcomes?: Array<{ id: string; recordedAt?: string | null }>;
}

export interface NeedsOutcomePanelProps {
  tenders: NeedsOutcomeCandidate[];
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onRecorded?: () => void;
}

function formatValue(raw?: string | null): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const value = Number(raw);
  if (Number.isNaN(value)) return String(raw);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * WL-1b — Safety net for skippable capture. Lists closed tenders with zero
 * recorded outcomes and offers a "Record outcome" action that opens the
 * same capture modal used at close, but wired to the backfill endpoint.
 *
 * Rendered as a collapsible section inside the Tenders page (no new route,
 * no new nav entry).
 */
export function NeedsOutcomePanel({ tenders, authFetch, onRecorded }: NeedsOutcomePanelProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<OutcomeCaptureTender | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const needing = useMemo(() => {
    return tenders
      .filter((t) => TERMINAL_STATUSES.has(t.status))
      .filter((t) => !t.outcomes || t.outcomes.length === 0)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [tenders]);

  if (needing.length === 0) return null;

  async function handleSave(payload: OutcomeCapturePayload) {
    if (!target) return;
    await recordOutcome(authFetch, target.id, payload);
    setTarget(null);
    setToast(`Outcome recorded for ${target.tenderNumber}`);
    onRecorded?.();
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <section
      aria-label="Tenders needing outcome"
      style={{
        border: "1px solid #FED7AA",
        background: "#FFF7ED",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 12
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          color: "#9A3412"
        }}
      >
        <span>
          {needing.length} closed tender{needing.length === 1 ? "" : "s"} without a recorded outcome
        </span>
        <span aria-hidden="true" style={{ fontSize: 12 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <ul
          style={{
            listStyle: "none",
            margin: "10px 0 0",
            padding: 0,
            display: "grid",
            gap: 6
          }}
        >
          {needing.map((t) => (
            <li
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: 12,
                padding: "6px 8px",
                background: "white",
                borderRadius: 6,
                fontSize: 13
              }}
            >
              <span>
                <strong>{t.tenderNumber}</strong> — {t.title}
              </span>
              <span style={{ color: "var(--text-muted)" }}>{t.status}</span>
              <span style={{ color: "var(--text-muted)" }}>{formatValue(t.estimatedValue)}</span>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                style={{ padding: "4px 10px", fontSize: 13 }}
                onClick={() =>
                  setTarget({
                    id: t.id,
                    tenderNumber: t.tenderNumber,
                    title: t.title,
                    estimatedValue: t.estimatedValue ?? null,
                    status: t.status
                  })
                }
              >
                Record outcome
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {target ? (
        <OutcomeCaptureModal
          tender={target}
          contextStatus={target.status ?? null}
          onSave={handleSave}
          onSkip={() => setTarget(null)}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            marginTop: 8,
            padding: "6px 10px",
            background: "#DCFCE7",
            color: "#166534",
            borderRadius: 6,
            fontSize: 13
          }}
        >
          {toast}
        </div>
      ) : null}
    </section>
  );
}
