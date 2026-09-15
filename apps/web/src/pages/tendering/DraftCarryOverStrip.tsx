/**
 * DraftPanel S3 -- Carry-over strip (DRAFTPANEL_S3_V1).
 *
 * Renders on Overview in the panel slot ONLY when ALL of:
 *   - tender.status === "IN_PROGRESS"
 *   - draftCarryOver?.dismissedAt is absent
 *   - the live row set is non-empty
 *
 * Row set rules:
 *   If tender.draftCarryOver?.rows exists: start from snapshotted rows, then
 *   re-check builders and documents live via deriveDraftCompleteness (with
 *   empty packages/matrix and null rate set), and drop rows the estimator has
 *   since fixed. packages/project rows stay as snapshotted.
 *
 *   If no snapshot: selectCarryOverRows(liveCompleteness, "light").
 *
 * ZERO extra network requests -- no fetch beyond what TenderDetailPage already
 * has. The tenderClients and tenderDocuments arrays passed in are the ones
 * already loaded with the tender.
 */

export const DRAFTPANEL_S3_V1 = "draftpanel-s3";

import {
  deriveDraftCompleteness,
  selectCarryOverRows,
  type WizardStepKey
} from "./newTenderWizard.helpers";

type CarryOverSnapshot = {
  capturedAt?: string;
  rows?: Array<{ step: string; text: string }>;
  dismissedAt?: string;
};

type TenderForStrip = {
  id: string;
  status: string;
  draftCarryOver?: CarryOverSnapshot | null;
};

type TenderClientForStrip = {
  id: string;
  client: { id: string; name: string };
  contact?: { id: string } | null;
  primaryContactId?: string | null;
  submissionDate?: string | null;
};

type TenderDocumentForStrip = {
  id: string;
};

export type DraftCarryOverStripProps = {
  tender: TenderForStrip;
  tenderClients: ReadonlyArray<TenderClientForStrip>;
  tenderDocuments: ReadonlyArray<TenderDocumentForStrip>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onDismissed: () => void;
};

/** Steps that have an Overview anchor the strip can scroll to. */
const STEPS_WITH_LINK = new Set<string>(["builders", "documents"]);

/** Map step key -> anchor id. */
const STEP_ANCHOR: Partial<Record<string, string>> = {
  builders: "tender-builders",
  documents: "tender-documents"
};

/** Human label for the link button. */
const STEP_LINK_LABEL: Partial<Record<string, string>> = {
  builders: "Builders ->",
  documents: "Documents ->"
};

export function DraftCarryOverStrip({
  tender,
  tenderClients,
  tenderDocuments,
  authFetch,
  onDismissed
}: DraftCarryOverStripProps) {
  // Guard 1: wrong status
  if (tender.status !== "IN_PROGRESS") return null;

  const snapshot = tender.draftCarryOver;

  // Guard 2: already dismissed
  if (snapshot?.dismissedAt) return null;

  // Derive the live completeness for builders and documents re-check.
  // We pass empty packages/matrix and null rateSet because those are
  // DRAFT-only and not loaded for IN_PROGRESS tenders. The derivation
  // still correctly evaluates builders and documents.
  const liveCompleteness = deriveDraftCompleteness(
    // tender project fields aren't needed for the re-check but are required
    { title: null, siteId: null, estimatorUserId: null },
    tenderClients.map((tc) => ({
      clientId: tc.client.id,
      clientName: tc.client.name,
      contactId: tc.primaryContactId ?? tc.contact?.id ?? null,
      submissionDate: tc.submissionDate ?? null
    })),
    [], // packages: not loaded for IN_PROGRESS
    [], // matrix: not loaded for IN_PROGRESS
    tenderDocuments.map((d) => ({ id: d.id })),
    null // rateSet: not loaded for IN_PROGRESS
  );

  let rows: Array<{ step: string; text: string }>;

  if (snapshot?.rows && snapshot.rows.length > 0) {
    // Start from snapshotted rows, re-check builders and documents live.
    const liveStepMap = new Map<string, typeof liveCompleteness.steps[number]>(liveCompleteness.steps.map((s) => [s.step as string, s]));
    rows = snapshot.rows.filter((row) => {
      const liveStep = liveStepMap.get(row.step);
      if (!liveStep) {
        // packages / project steps: keep as snapshotted (no live check)
        return true;
      }
      // builders and documents: keep only if still not ready
      return liveStep.state !== "ready";
    });
  } else {
    // No snapshot: use light carry-over from live completeness
    rows = selectCarryOverRows(liveCompleteness, "light");
  }

  // Guard 3: nothing to show
  if (rows.length === 0) return null;

  const handleDismiss = async () => {
    try {
      await authFetch(`/tenders/${tender.id}/draft-carry-over/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      onDismissed();
    } catch {
      // best-effort -- the user can reload to re-try
    }
  };

  const scrollTo = (anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ block: "start" });
  };

  return (
    <div
      data-testid="draft-carry-over"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 16px",
        borderRadius: 8,
        border: "1px solid color-mix(in srgb, var(--status-warning) 35%, transparent)",
        background: "color-mix(in srgb, var(--status-warning) 8%, transparent)",
        marginBottom: 8
      }}
    >
      {/* Header line */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            background: "color-mix(in srgb, var(--status-warning) 25%, transparent)",
            color: "var(--status-warning)"
          }}
        >
          !
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="s7-type-label" style={{ margin: 0 }}>
            {rows.length} {rows.length === 1 ? "thing was" : "things were"} left unfinished when this tender left Draft.
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 12,
              color: "var(--text-muted)"
            }}
          >
            {rows.map((r) => r.text).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => void handleDismiss()}
          data-testid="draft-carry-over-dismiss"
          style={{ flexShrink: 0 }}
        >
          Dismiss
        </button>
      </div>

      {/* Row-level actions and muted advice */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingLeft: 32 }}>
        {rows.map((row) => {
          const stepKey = row.step as WizardStepKey;
          const anchor = STEP_ANCHOR[stepKey];
          const label = STEP_LINK_LABEL[stepKey];
          if (STEPS_WITH_LINK.has(stepKey) && anchor && label) {
            return (
              <button
                key={row.step}
                type="button"
                className="s7-btn s7-btn--secondary s7-btn--sm"
                onClick={() => scrollTo(anchor)}
                data-testid={`draft-carry-over-link-${row.step}`}
              >
                <span data-testid={`draft-carry-over-row-${row.step}`}>{label}</span>
              </button>
            );
          }
          // packages / project: plain text label
          return (
            <span
              key={row.step}
              className="s7-type-label"
              data-testid={`draft-carry-over-row-${row.step}`}
              style={{ color: "var(--text-muted)", fontSize: 12 }}
            >
              {row.step}
            </span>
          );
        })}
        <span
          style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}
        >
          Fix them where they live -- the wizard is for building a tender, not maintaining one.
        </span>
      </div>
    </div>
  );
}
