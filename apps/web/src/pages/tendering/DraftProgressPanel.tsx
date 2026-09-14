/**
 * DraftPanel S2 -- "Finish this draft" panel.
 *
 * Rendered as the first section of the Overview tab, only while
 * tender.status === "DRAFT". Shows a 7-segment meter (5 checkable + 2
 * hatched), one row per wizard step, and a primary CTA that flips to
 * "Move to Estimating" when all 5 checkable steps are ready.
 *
 * No percentage, no ring -- the mock-up's "Deliberately not drawn" list
 * is binding.
 */
import type { DraftCompleteness, WizardStepKey } from "./newTenderWizard.helpers";
import { WIZARD_STEP_LABELS } from "./newTenderWizard.helpers";

// The action label for each row's button.
const STEP_ACTION_LABEL: Record<WizardStepKey, string> = {
  project: "Open",
  builders: "Fix builder",
  packages: "Open",
  documents: "Upload",
  rates: "Lock rates",
  ai: "Open",
  review: "Review"
};

export type DraftPanelResumePayload = {
  step: WizardStepKey;
};

export type DraftProgressPanelProps = {
  completeness: DraftCompleteness;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdByName?: string | null;
  /** Called when the user clicks a row action or the Resume wizard button. */
  onResume: (payload: DraftPanelResumePayload) => void;
  /** Called when the user clicks "Move to Estimating" (all 5 ready). */
  onMoveToEstimating: () => void;
  /** Called when the user clicks "Discard draft". */
  onDiscard: () => void;
  /** Whether status change is in progress (disables the CTA). */
  busy?: boolean;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function DraftProgressPanel({
  completeness,
  createdAt,
  updatedAt,
  createdByName,
  onResume,
  onMoveToEstimating,
  onDiscard,
  busy = false
}: DraftProgressPanelProps) {
  const { steps, readyCount, checkableCount } = completeness;
  const allReady = readyCount === checkableCount;

  return (
    <section
      className="s7-card"
      data-testid="draft-progress-panel"
      aria-label="Finish this draft"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16
        }}
      >
        <div>
          <h3
            className="s7-type-section-heading"
            style={{ margin: 0 }}
            data-testid="draft-panel-heading"
          >
            {allReady ? "Ready to move on" : "Finish this draft"}
          </h3>
          <p
            className="s7-type-label"
            style={{ margin: "4px 0 0", color: "var(--text-muted)" }}
            data-testid="draft-panel-meter-label"
          >
            {readyCount} of {checkableCount} checkable steps ready
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={onDiscard}
            disabled={busy}
            data-testid="draft-panel-discard"
          >
            Discard draft
          </button>
          <button
            type="button"
            className={`s7-btn s7-btn--sm ${allReady ? "s7-btn--primary" : "s7-btn--secondary"}`}
            onClick={allReady ? onMoveToEstimating : () => onResume({ step: "project" })}
            disabled={busy}
            data-testid={allReady ? "draft-panel-move-to-estimating" : "draft-panel-resume-wizard"}
          >
            {allReady ? "Move to Estimating" : "Resume wizard"}
          </button>
        </div>
      </div>

      {/* Step meter -- 7 segments, 2 hatched */}
      <MeterBar steps={steps} />

      {/* Step rows */}
      <ul
        style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}
        data-testid="draft-panel-rows"
      >
        {steps.map((entry, idx) => {
          const isNotCheckable = entry.state === "not-checkable";
          const isReady = entry.state === "ready";

          return (
            <li
              key={entry.step}
              data-testid={`draft-panel-row-${entry.step}`}
              style={{
                display: "flex",
                alignItems: isReady ? "center" : "flex-start",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 6,
                background: isReady
                  ? "var(--surface-subtle, rgba(0,0,0,0.02))"
                  : "transparent",
                opacity: isNotCheckable ? 0.5 : 1
              }}
            >
              {/* Index disc */}
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  background: stateBackground(entry.state),
                  color: stateColor(entry.state)
                }}
              >
                {idx + 1}
              </span>

              {/* Step name + why */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="s7-type-label" style={{ display: "block" }}>
                  {WIZARD_STEP_LABELS[entry.step]}
                </span>
                {!isReady ? (
                  <span
                    style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 1 }}
                    data-testid={`draft-panel-row-${entry.step}-why`}
                  >
                    {entry.why}
                  </span>
                ) : null}
              </div>

              {/* State badge */}
              <span
                className="s7-badge"
                data-testid={`draft-panel-row-${entry.step}-badge`}
                style={{
                  background: stateBadgeBackground(entry.state),
                  color: stateBadgeColor(entry.state),
                  flexShrink: 0
                }}
              >
                {stateBadgeLabel(entry.state)}
              </span>

              {/* Row action */}
              {!isNotCheckable ? (
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  style={{ flexShrink: 0 }}
                  disabled={isNotCheckable}
                  data-testid={`draft-panel-action-${entry.step}`}
                  onClick={() => onResume({ step: entry.step })}
                >
                  {STEP_ACTION_LABEL[entry.step]}
                </button>
              ) : (
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  style={{ flexShrink: 0 }}
                  disabled
                  data-testid={`draft-panel-action-${entry.step}`}
                  aria-disabled="true"
                >
                  {STEP_ACTION_LABEL[entry.step]}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <p
        style={{ fontSize: 12, color: "var(--text-muted)", margin: "12px 0 0" }}
        data-testid="draft-panel-footer"
      >
        {createdByName ? `Created by ${createdByName}` : ""}
        {createdAt ? ` on ${formatDate(createdAt)}` : ""}
        {updatedAt ? ` -- last updated ${formatDate(updatedAt)}` : ""}
        {" "}
        This panel is only visible while the tender is in Draft status.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Meter bar -- 7 segments
// ---------------------------------------------------------------------------

function MeterBar({ steps }: { steps: DraftCompleteness["steps"] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        height: 8,
        borderRadius: 4,
        overflow: "hidden"
      }}
      data-testid="draft-panel-meter"
      aria-hidden
    >
      {steps.map((entry) => (
        <div
          key={entry.step}
          data-testid={`draft-panel-meter-segment-${entry.step}`}
          style={{
            flex: 1,
            background: segmentBackground(entry.state),
            borderRadius: 2
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style helpers (token-based, no new colours)
// ---------------------------------------------------------------------------

type State = DraftCompleteness["steps"][number]["state"];

function stateBackground(state: State): string {
  switch (state) {
    case "ready": return "#D1FAE5"; // green-100 analogue
    case "partial": return "#FED7AA"; // amber-200 analogue
    case "outstanding": return "var(--surface-border)";
    case "not-checkable": return "var(--surface-border)";
  }
}

function stateColor(state: State): string {
  switch (state) {
    case "ready": return "#065F46";
    case "partial": return "#3E2A00";
    case "outstanding": return "var(--text-muted)";
    case "not-checkable": return "var(--text-muted)";
  }
}

function stateBadgeBackground(state: State): string {
  switch (state) {
    case "ready": return "#D1FAE5";
    case "partial": return "#FEF3C7";
    case "outstanding": return "color-mix(in srgb, var(--status-danger, #DC2626) 12%, transparent)";
    case "not-checkable": return "var(--surface-subtle, rgba(0,0,0,0.05))";
  }
}

function stateBadgeColor(state: State): string {
  switch (state) {
    case "ready": return "#065F46";
    case "partial": return "#78350F";
    case "outstanding": return "var(--status-danger, #DC2626)";
    case "not-checkable": return "var(--text-muted)";
  }
}

function stateBadgeLabel(state: State): string {
  switch (state) {
    case "ready": return "Ready";
    case "partial": return "Partial";
    case "outstanding": return "Outstanding";
    case "not-checkable": return "N/A";
  }
}

function segmentBackground(state: State): string {
  switch (state) {
    case "ready": return "#34D399"; // emerald
    case "partial": return "#FCD34D"; // amber
    case "outstanding": return "var(--surface-border)";
    case "not-checkable":
      // hatched appearance via repeating-linear-gradient
      return "repeating-linear-gradient(45deg, var(--surface-border) 0 3px, var(--surface-subtle, rgba(0,0,0,0.05)) 3px 6px)";
  }
}
