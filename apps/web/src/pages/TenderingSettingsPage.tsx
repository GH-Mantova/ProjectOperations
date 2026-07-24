import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import {
  defaultTenderingLabels,
  fetchTenderingLabels,
  readTenderingLabels,
  saveTenderingLabels,
  type TenderingLabelKey,
  type TenderingLabelMap
} from "../tendering-labels";

const KEYS = Object.keys(defaultTenderingLabels) as TenderingLabelKey[];

/**
 * Org-wide Tendering label rename surface. Loads the merged label map from
 * GET /tenders/labels on mount, lets an admin rename any key (or reset a
 * single row back to the default), and persists via PUT /tenders/labels.
 *
 * The page never touches DB keys, enum values, routes or permission codes —
 * only the display text rendered for known keys.
 */
export function TenderingSettingsPage() {
  const { authFetch, user } = useAuth();
  const canEdit = can(user, "tenders.manage");

  const [labels, setLabels] = useState<TenderingLabelMap>(readTenderingLabels());
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchTenderingLabels(authFetch)
      .then((map) => {
        if (!cancelled) {
          setLabels(map);
          setStatus("idle");
        }
      })
      .catch(async (err) => {
        if (cancelled) return;
        const message = (err as Error).message;
        setError(message ?? "Failed to load tendering labels.");
        setStatus("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const customisedCount = useMemo(
    () => KEYS.filter((key) => labels[key] !== defaultTenderingLabels[key]).length,
    [labels]
  );

  async function persist(next: TenderingLabelMap) {
    const overrides = KEYS.map((key) => ({
      key,
      label: next[key] === defaultTenderingLabels[key] ? null : next[key]
    }));
    setStatus("saving");
    setError(null);
    try {
      const merged = await saveTenderingLabels(authFetch, overrides);
      setLabels(merged);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      const message = (err as Error).message;
      setError(message ?? "Failed to save tendering labels.");
    } finally {
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <div className="admin-grid">
      <AppCard
        title="Tendering Settings"
        subtitle="Rename visible Tendering labels for the whole team without changing the underlying data keys or relationships."
      >
        <div className="module-summary-grid">
          <div className="module-summary-card">
            <strong>{KEYS.length}</strong>
            <span>Visible labels</span>
          </div>
          <div className="module-summary-card">
            <strong>{customisedCount}</strong>
            <span>Customised labels</span>
          </div>
          <div className="module-summary-card">
            <strong>{savedAt ?? "Not saved yet"}</strong>
            <span>Last save (this session)</span>
          </div>
        </div>
        <div className="notice-banner">
          <strong>Safe rename surface</strong>
          <p className="muted-text">
            These labels only change what users see in Tendering. They do not alter database keys,
            automation routes, lifecycle states, or cross-module relationships. Changes apply
            org-wide once saved.
          </p>
        </div>
        {error ? (
          <div className="notice-banner notice-banner--danger" role="alert">
            <strong>Could not update labels</strong>
            <p className="muted-text">{error}</p>
          </div>
        ) : null}
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canEdit || busy) return;
            void persist(labels);
          }}
        >
          {KEYS.map((key) => {
            const defaultValue = defaultTenderingLabels[key];
            const current = labels[key];
            const isOverridden = current !== defaultValue;
            return (
              <label key={key} className="estimate-editor__field">
                <span>
                  {key}
                  {isOverridden ? <em className="muted-text"> (renamed)</em> : null}
                </span>
                <div className="inline-fields">
                  <input
                    className="s7-input"
                    value={current}
                    disabled={!canEdit || busy}
                    onChange={(event) =>
                      setLabels((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                    placeholder={defaultValue}
                  />
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost"
                    disabled={!canEdit || busy || !isOverridden}
                    onClick={() => {
                      const next = { ...labels, [key]: defaultValue };
                      setLabels(next);
                      void persist(next);
                    }}
                    title={`Reset "${key}" to the default "${defaultValue}"`}
                  >
                    Reset
                  </button>
                </div>
              </label>
            );
          })}
          <div className="inline-fields">
            <button type="submit" className="s7-btn s7-btn--primary" disabled={!canEdit || busy}>
              {status === "saving" ? "Saving…" : "Save labels"}
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              disabled={!canEdit || busy || customisedCount === 0}
              onClick={() => {
                const next = { ...defaultTenderingLabels };
                setLabels(next);
                void persist(next);
              }}
            >
              Reset all defaults
            </button>
            {!canEdit ? (
              <span className="muted-text">You need the tenders.manage permission to edit labels.</span>
            ) : null}
          </div>
        </form>
      </AppCard>

      <AppCard title="Preview" subtitle="Quick check of the current label set before returning to the module.">
        <div className="detail-list detail-list--single">
          {KEYS.map((key) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{labels[key]}</dd>
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}
