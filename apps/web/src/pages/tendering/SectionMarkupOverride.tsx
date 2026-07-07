// Per-section markup override control for the waste + cutting
// subtables. Mirrors CardMarkupOverride from ScopeCardsTab — same
// input style, same × reset — but keyed to the section's cost stream
// on the ScopeCard record (wasteMarkupOverride / cuttingMarkupOverride).

export function SectionMarkupOverride({
  label,
  value,
  tenderMarkup,
  onSave,
  disabled
}: {
  label: string;
  value: number | null | undefined;
  tenderMarkup: number;
  onSave: (next: number | null) => Promise<void> | void;
  disabled?: boolean;
}) {
  const hasOverride = value != null;
  return (
    <label
      style={{
        fontSize: 12,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }}
    >
      {label}
      <input
        type="number"
        min={0}
        max={100}
        step="0.01"
        placeholder={String(tenderMarkup)}
        defaultValue={value ?? ""}
        key={`section-markup-${value ?? "inherit"}-${tenderMarkup}`}
        disabled={disabled}
        onBlur={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            if (hasOverride) void onSave(null);
            return;
          }
          const n = Math.max(0, Math.min(100, Number(raw)));
          if (!Number.isFinite(n)) return;
          if (n !== value) void onSave(n);
        }}
        style={{
          width: 70,
          padding: "2px 6px",
          borderColor: hasOverride ? "var(--brand-accent, #FEAA6D)" : undefined,
          borderStyle: hasOverride ? "solid" : undefined,
          borderWidth: hasOverride ? 1 : undefined
        }}
        aria-label={`${label} percent`}
        title={hasOverride ? "Override active — click × to clear" : `Inherits tender markup (${tenderMarkup}%)`}
      />
      %
      {hasOverride && !disabled ? (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()} override`}
          title="Clear override (inherit tender markup)"
          onClick={() => void onSave(null)}
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            border: "1px solid var(--border-default, #e5e7eb)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 11,
            lineHeight: 1,
            padding: 0
          }}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}

export function computeWithMarkup(subtotal: number, override: number | null | undefined, tenderMarkup: number): number {
  const rate = override != null ? override : tenderMarkup;
  return subtotal * (1 + rate / 100);
}
