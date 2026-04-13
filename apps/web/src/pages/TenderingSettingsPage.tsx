import { useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { defaultTenderingLabels, readTenderingLabels, writeTenderingLabels } from "../tendering-labels";

export function TenderingSettingsPage() {
  const [labels, setLabels] = useState(readTenderingLabels());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const entries = useMemo(() => Object.entries(defaultTenderingLabels), []);

  return (
    <div className="admin-grid">
      <AppCard
        title="Tendering Settings"
        subtitle="Rename visible Tendering labels without changing the underlying data keys or relationships."
      >
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            writeTenderingLabels(labels);
            setSavedAt(new Date().toLocaleTimeString());
          }}
        >
          {entries.map(([key, value]) => (
            <label key={key}>
              <span>{key}</span>
              <input
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
            <button type="submit">Save labels</button>
            <button
              type="button"
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
