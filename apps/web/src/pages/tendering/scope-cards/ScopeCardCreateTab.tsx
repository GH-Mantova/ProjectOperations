import { useState } from "react";

// PR B1.5 — trailing "+" tab. Click → inline input. Enter creates a card
// with default discipline "Other"; the user can change discipline via the
// card body's dropdown afterwards. Submitting an empty name closes the
// input without creating anything.

type Props = {
  onCreate: (name: string, discipline: string) => Promise<void>;
};

export function ScopeCardCreateTab({ onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await onCreate(trimmed, "Other");
      setName("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    return (
      <input
        autoFocus
        placeholder="Card name…"
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void submit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") {
            setName("");
            setOpen(false);
          }
        }}
        style={{
          padding: "8px 12px",
          fontSize: 13,
          border: "1px solid #005B61",
          borderRadius: "6px 6px 0 0",
          minWidth: 140
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Add card"
      title="Add card"
      style={{
        padding: "8px 14px",
        fontSize: 13,
        border: "1px dashed var(--border, #e5e7eb)",
        borderRadius: "6px 6px 0 0",
        background: "transparent",
        cursor: "pointer",
        color: "var(--text-muted)"
      }}
    >
      + Add card
    </button>
  );
}
