import { useCallback, useEffect, useMemo, useState } from "react";
import "./ProcessStageBar.css";

// Reusable D365-style stage bar. The engine is entity-agnostic, but the
// component takes the API endpoint as a prop so a page can pin the same
// UI to any entity that has a flow wired on the server.
//
// Props:
//   endpoint    — base URL, e.g. "/tenders/{id}/process-flow". GET returns
//                 { flow, instance }; POST /advance takes { targetStageId }.
//   authFetch   — the caller's authenticated fetch (from AuthContext).
//   canAdvance  — false to render read-only (no click-to-advance, no button).
//   onAdvanced  — optional callback fired after a successful advance, so
//                 the parent can reload the record (required fields on the
//                 next stage may have changed the source of truth).

type Stage = {
  id: string;
  name: string;
  order: number;
  requiredFields: string[];
};

type Flow = {
  id: string;
  entityType: string;
  name: string;
  active: boolean;
  stages: Stage[];
};

type Instance = {
  id: string;
  flowId: string;
  currentStageId: string;
  currentStage: Stage;
} | null;

type FlowPayload = { flow: Flow; instance: Instance };

type Props = {
  endpoint: string;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  canAdvance: boolean;
  onAdvanced?: () => void;
};

export function ProcessStageBar({ endpoint, authFetch, canAdvance, onAdvanced }: Props) {
  const [payload, setPayload] = useState<FlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(endpoint);
      if (!res.ok) {
        // A 404 here means "no flow for this entity" — degrade silently.
        if (res.status === 404) {
          setPayload(null);
          return;
        }
        throw new Error(`Failed to load process flow (${res.status})`);
      }
      const body = (await res.json()) as FlowPayload;
      setPayload(body);
      setSelectedStageId(body.instance?.currentStageId ?? body.flow.stages[0]?.id ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentStage = payload?.instance?.currentStage ?? null;
  const stages = payload?.flow.stages ?? [];
  const selectedStage = useMemo(
    () => stages.find((s) => s.id === selectedStageId) ?? null,
    [stages, selectedStageId]
  );

  const advance = useCallback(async () => {
    if (!selectedStageId) return;
    setAdvancing(true);
    setAdvanceError(null);
    try {
      const res = await authFetch(`${endpoint}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStageId: selectedStageId })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ message: "Advance failed" }))) as {
          message?: string;
        };
        throw new Error(body.message ?? `Advance failed (${res.status})`);
      }
      await load();
      onAdvanced?.();
    } catch (err) {
      setAdvanceError((err as Error).message);
    } finally {
      setAdvancing(false);
    }
  }, [authFetch, endpoint, load, onAdvanced, selectedStageId]);

  if (loading) return <div className="process-stage-bar process-stage-bar--placeholder" />;
  if (error) {
    return (
      <div className="process-stage-bar process-stage-bar--error" role="alert">
        {error}
      </div>
    );
  }
  if (!payload) return null;

  const canAdvanceToSelected =
    canAdvance &&
    selectedStageId !== null &&
    selectedStageId !== currentStage?.id;

  return (
    <div className="process-stage-bar" aria-label={`Process flow: ${payload.flow.name}`}>
      <ol className="process-stage-bar__stages" role="tablist">
        {stages.map((stage) => {
          const isCurrent = stage.id === currentStage?.id;
          const isSelected = stage.id === selectedStageId;
          const isPast = currentStage !== null && stage.order < currentStage.order;
          const className = [
            "process-stage-bar__stage",
            isCurrent ? "process-stage-bar__stage--current" : "",
            isSelected && !isCurrent ? "process-stage-bar__stage--selected" : "",
            isPast ? "process-stage-bar__stage--past" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={stage.id} className={className}>
              <button
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedStageId(stage.id)}
                className="process-stage-bar__stage-button"
              >
                <span className="process-stage-bar__stage-index">{stage.order + 1}</span>
                <span className="process-stage-bar__stage-name">{stage.name}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {selectedStage ? (
        <div className="process-stage-bar__details">
          <div className="process-stage-bar__details-header">
            <span className="s7-type-label">{selectedStage.name}</span>
            {selectedStage.id === currentStage?.id ? (
              <span className="process-stage-bar__badge process-stage-bar__badge--current">
                Current stage
              </span>
            ) : null}
          </div>
          {selectedStage.requiredFields.length > 0 ? (
            <div className="process-stage-bar__required">
              <span className="s7-type-label">Required to leave this stage</span>
              <ul>
                {selectedStage.requiredFields.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="process-stage-bar__required-empty">No required fields.</p>
          )}
          {canAdvance ? (
            <div className="process-stage-bar__actions">
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                disabled={!canAdvanceToSelected || advancing}
                onClick={() => void advance()}
              >
                {advancing ? "Advancing…" : `Move to ${selectedStage.name}`}
              </button>
              {advanceError ? (
                <span className="process-stage-bar__error" role="alert">
                  {advanceError}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
