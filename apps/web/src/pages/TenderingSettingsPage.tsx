import { useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { defaultTenderingLabels, readTenderingLabels, writeTenderingLabels } from "../tendering-labels";

export function TenderingSettingsPage() {
  const [labels, setLabels] = useState(readTenderingLabels());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const entries = useMemo(() => Object.entries(defaultTenderingLabels), []);
  const customisedCount = entries.filter(([key, value]) => labels[key as keyof typeof labels] !== value).length;

  return (
    <div className="admin-grid">
      <AppCard
        title="Tendering Settings"
        subtitle="Rename visible Tendering labels without changing the underlying data keys or relationships."
      >
        <div className="module-summary-grid">
          <div className="module-summary-card">
            <strong>{entries.length}</strong>
            <span>Visible labels</span>
          </div>
          <div className="module-summary-card">
            <strong>{customisedCount}</strong>
            <span>Customised labels</span>
          </div>
          <div className="module-summary-card">
            <strong>{savedAt ?? "Not saved yet"}</strong>
            <span>Last local save</span>
          </div>
        </div>
        <div className="notice-banner">
          <strong>Safe rename surface</strong>
          <p className="muted-text">
            These labels only change what users see in Tendering. They do not alter database keys, automation routes, lifecycle states, or cross-module relationships.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            writeTenderingLabels(labels);
            setSavedAt(new Date().toLocaleTimeString());
          }}
          style={{ display: "grid", gap: 14 }}
        >
          {entries.map(([key, value]) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{key}</span>
              <input
                className="s7-input"
                value={labels[key as keyof typeof labels]}
                onChange={(event) =>
                  setLabels((current) => ({
                    ...current,
                    [key]: event.target.value
                  }))
                }
                placeholder={value}
              />
            </label>
          ))}
          <div className="inline-fields">
            <button type="submit" className="s7-btn s7-btn--primary" style={{ minHeight: 40 }}>
              Save labels
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              style={{ minHeight: 40 }}
              onClick={() => {
                setLabels(defaultTenderingLabels);
                writeTenderingLabels(defaultTenderingLabels);
                setSavedAt(new Date().toLocaleTimeString());
              }}
            >
              Reset defaults
            </button>
          </div>
        </form>
      </AppCard>

      <AppCard title="Preview" subtitle="Quick check of the current label set before returning to the module.">
        <div className="detail-list detail-list--single">
          {entries.map(([key]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{labels[key as keyof typeof labels]}</dd>
            </div>
          ))}
        </div>
        {savedAt ? <p className="muted-text">Saved at {savedAt}</p> : null}
      </AppCard>
    </div>
  );
}
