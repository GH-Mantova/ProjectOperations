import { useState } from "react";
import { NewCardModal } from "./NewCardModal";

// PR 5A — trailing "+" tab. Click opens a discipline-picker modal
// instead of the old inline text input, so estimators choose a
// discipline upfront before the card is created.

type Props = {
  onCreate: (name: string, discipline: string) => Promise<void>;
};

export function ScopeCardCreateTab({ onCreate }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add card"
        title="Add card"
        style={{
          padding: "8px 14px",
          fontSize: 13,
          border: "1px dashed var(--border-default, #e5e7eb)",
          borderRadius: "6px 6px 0 0",
          background: "transparent",
          cursor: "pointer",
          color: "var(--text-muted)"
        }}
      >
        + Add card
      </button>
      {open && (
        <NewCardModal
          onConfirm={async (name, discipline) => {
            await onCreate(name, discipline);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
