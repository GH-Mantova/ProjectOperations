/**
 * RATE_S4_EMPTY_FIRST_STEP — guided first step for a table with zero columns.
 *
 * Shown instead of the grid when the selected table has no columns. Two
 * questions in plain words — no database vocabulary — lead to a VALUE column
 * that satisfies the server's assertStructure rule.
 *
 * Design ref: mock-up states 1 and 2.
 */
import { useState } from "react";

const MUTED = "var(--text-muted)";
const BRAND = "var(--brand-primary)";

export type EmptyTableFirstStepProps = {
  /**
   * Called when the user submits both fields. The parent wires this to
   * `handleAddColumn` with role "VALUE" and dataType "CURRENCY".
   */
  onCreate: (args: { name: string; unit: string }) => Promise<void>;
};

export function EmptyTableFirstStep({ onCreate }: EmptyTableFirstStepProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && unit.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), unit: unit.trim() });
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
        gap: 0
      }}
    >
      {/* One empty cell in the grid area — matches the mock-up state 1 visual */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          border: "1px dashed var(--border-default, #d1d5db)",
          borderRadius: 8,
          padding: "32px 28px",
          background: "var(--surface-subtle, rgba(0,91,97,0.03))"
        }}
      >
        <h4
          style={{
            margin: "0 0 24px",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)"
          }}
        >
          Let's build this table
        </h4>

        {/* Q1: name */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 16
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            What are you charging for?
          </span>
          <input
            className="s7-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rate"
            autoFocus
            data-testid="empty-first-step-name"
          />
        </label>

        {/* Q2: unit */}
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 24
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>$ per what?</span>
          <input
            className="s7-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="m / hr / tonne / day / hole"
            data-testid="empty-first-step-unit"
          />
        </label>

        <button
          type="button"
          className="s7-btn s7-btn--primary"
          disabled={!canSubmit || busy}
          onClick={() => void handleSubmit()}
          style={{ minHeight: 40, width: "100%", borderColor: BRAND }}
          data-testid="empty-first-step-submit"
        >
          {busy ? "Creating…" : "Create the table"}
        </button>

        <p
          style={{
            margin: "12px 0 0",
            fontSize: 12,
            color: MUTED,
            textAlign: "center"
          }}
        >
          You can add everything else after.
        </p>
      </div>
    </div>
  );
}
