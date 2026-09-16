/**
 * EmptyTableFirstStep — guided first step for a brand-new rate table.
 *
 * Shown when the selected table has zero columns. Replaces the database-word
 * instruction ("No fields yet — add KEY, VALUE, and INFO columns below") with
 * two plain questions: what are you charging for (the column name) and the
 * price unit. On submit it calls `handleAddColumn` with a VALUE/CURRENCY
 * column — the mandatory column the server requires before any row can be
 * added (assertStructure §3).
 *
 * Design ref: https://claude.ai/code/artifact/b589c915-c92a-491e-80a5-3fe9c55a3bb6
 * (states 1 and 2).
 */
import { useState } from "react";

const BRAND = "var(--brand-primary)";
const MUTED = "var(--text-muted)";
const BORDER = "var(--border-subtle, #E5E7EB)";

export type EmptyTableFirstStepProps = {
  /**
   * Called when the user submits the two-question form. The parent calls
   * `handleAddColumn` with the result — the component does not fetch.
   */
  onCreateFirstColumn: (payload: { name: string; unit: string }) => Promise<void>;
};

export function EmptyTableFirstStep({ onCreateFirstColumn }: EmptyTableFirstStepProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && unit.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onCreateFirstColumn({ name: name.trim(), unit: unit.trim() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center"
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 24
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text)"
            }}
          >
            Start with the price
          </p>
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>
            Two questions, then you can add everything else.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>What are you charging for?</span>
            <input
              className="s7-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rate"
              autoFocus
              data-testid="empty-step-name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) void handleSubmit();
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>$ per what?</span>
            <input
              className="s7-input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="m / hr / tonne / day / hole"
              data-testid="empty-step-unit"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) void handleSubmit();
              }}
            />
          </label>
        </div>

        {error ? (
          <div style={{ fontSize: 12, color: "var(--status-danger)" }}>{error}</div>
        ) : null}

        <button
          type="button"
          className="s7-btn s7-btn--primary"
          disabled={!canSubmit || busy}
          onClick={() => void handleSubmit()}
          style={{ minHeight: 44 }}
          data-testid="empty-step-submit"
        >
          {busy ? "Creating…" : "Create the table"}
        </button>

        <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
          You can add everything else after.
        </p>
      </div>

      {/* Single empty-cell visual cue so the grid area is not completely blank */}
      <div
        aria-hidden
        style={{
          marginTop: 32,
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 13,
          color: MUTED,
          display: "inline-block",
          background: "var(--surface-subtle, rgba(0,0,0,0.02))"
        }}
      >
        <span style={{ color: BRAND, fontWeight: 600 }}>Rate</span>
        {" "}
        <span style={{ fontSize: 11 }}>(price)</span>
      </div>
    </div>
  );
}
