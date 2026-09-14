import { DISCIPLINE_CODES, DISCIPLINE_LABELS, disciplineColor } from "./utils/card-display";

// PR B1.5 — empty-state for a tender with no scope cards. Four
// quick-start buttons (one per IS discipline) seed the default name +
// discipline. Custom-named cards still happen via the "+" tab once
// any card exists.
//
// Rates-gate slice — adds a "rates-required" variant shown when the tender
// has no rate set. The standard create affordance is absent in this variant;
// the only action is Lock rates, which clears the gate.

type Props = {
  onCreate: (name: string, discipline: string) => Promise<void>;
};

type RatesRequiredProps = {
  /** Called when the user presses Lock rates. */
  onLockRates: () => Promise<void>;
  /** True while the lock call is in flight. */
  locking?: boolean;
};

/** Standard empty state: no cards, rates are locked. */
export function ScopeCardEmptyState({ onCreate }: Props) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 60,
        background: "var(--surface-muted, #F6F6F6)",
        borderRadius: 8,
        border: "1px dashed var(--border, #e5e7eb)"
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18 }}>No scope cards yet</h3>
      <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
        Quick-start with one of the standard disciplines, or use the + tab on the
        right after creating your first card to add custom-named cards.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        {DISCIPLINE_CODES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => void onCreate(DISCIPLINE_LABELS[d], d)}
            style={{
              borderLeft: `4px solid ${disciplineColor(d)}`,
              borderTop: "1px solid var(--border, #e5e7eb)",
              borderRight: "1px solid var(--border, #e5e7eb)",
              borderBottom: "1px solid var(--border, #e5e7eb)",
              padding: "12px 20px",
              background: "var(--surface, #fff)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500
            }}
          >
            + {DISCIPLINE_LABELS[d]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Rates-required empty state: no rate set exists, so no cards can be
 * created. The only action is to lock rates, which creates the snapshot
 * and clears the gate.
 */
export function ScopeCardRatesRequiredEmptyState({ onLockRates, locking }: RatesRequiredProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: 60,
        background: "var(--surface-subtle)",
        borderRadius: 8,
        border: "1px dashed var(--border-subtle)"
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18 }}>Lock rates before pricing</h3>
      <p style={{ color: "var(--text-muted)", marginTop: 8, maxWidth: 420, margin: "8px auto 0" }}>
        Scope cards must be priced against a locked rate snapshot. Without one,
        rates could move under the estimate between now and submission.
      </p>
      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => void onLockRates()}
          disabled={locking}
        >
          {locking ? "Locking…" : "Lock rates"}
        </button>
      </div>
    </div>
  );
}
