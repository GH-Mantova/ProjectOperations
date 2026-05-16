import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { ScopeCard } from "./useScopeCards";
import { disciplineColor, formatCardCode } from "./utils/card-display";

// PR B1.5 — single tab in the cards-as-tabs row. Inline-rename on
// double-click. Delete X visible on hover, only when itemCount === 0.

type Props = {
  card: ScopeCard;
  active: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isDragging?: boolean;
};

export function ScopeCardTab({ card, active, onSelect, onRename, onDelete, isDragging }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(card.name);
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);

  // Keep draft in sync if the card name updates from the server.
  useEffect(() => {
    if (!editing) setDraftName(card.name);
  }, [card.name, editing]);

  const commit = async () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== card.name) {
      setRenaming(true);
      try {
        await onRename(trimmed);
      } finally {
        setRenaming(false);
      }
    } else {
      setDraftName(card.name);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(card.name);
    setEditing(false);
  };

  const containerStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderLeft: `3px solid ${disciplineColor(card.discipline)}`,
    borderTop: "1px solid var(--border, #e5e7eb)",
    borderRight: "1px solid var(--border, #e5e7eb)",
    borderBottom: active ? `3px solid #005B61` : "1px solid var(--border, #e5e7eb)",
    borderRadius: "6px 6px 0 0",
    background: active ? "var(--surface, #fff)" : "var(--surface-muted, #F6F6F6)",
    cursor: isDragging ? "grabbing" : "pointer",
    opacity: isDragging ? 0.5 : 1,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? "#005B61" : "var(--text)",
    userSelect: "none"
  };

  return (
    <div
      style={containerStyle}
      onClick={() => {
        if (!editing) onSelect();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11,
          color: "var(--text-muted)",
          fontWeight: 500
        }}
      >
        {formatCardCode(card.discipline, card.cardNumber)}
      </span>
      {editing ? (
        <input
          autoFocus
          value={draftName}
          disabled={renaming}
          onChange={(e) => setDraftName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") cancel();
          }}
          style={{ fontSize: 13, padding: "2px 4px", border: "1px solid #005B61", minWidth: 100 }}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {card.name}
        </span>
      )}
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({card.itemCount})</span>
      {hovered && !editing && card.itemCount === 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onDelete();
          }}
          aria-label={`Delete card ${card.name}`}
          title="Delete empty card"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "0 4px",
            fontSize: 14,
            lineHeight: 1
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
