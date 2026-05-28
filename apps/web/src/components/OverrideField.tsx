import { useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  isOverridden: boolean;
  onRevert: () => void;
  children: ReactNode;
  style?: CSSProperties;
  affordance?: boolean;
};

export function OverrideField({ isOverridden, onRevert, children, style, affordance }: Props) {
  const [hovered, setHovered] = useState(false);

  if (!isOverridden) {
    return (
      <div
        className={affordance ? "card-header-editable" : undefined}
        title={affordance ? "Click to edit" : undefined}
        style={{ padding: affordance ? "2px 6px" : undefined, ...style }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        background: "var(--surface-override, #FDD387)",
        borderRadius: "var(--radius-sm, 4px)",
        padding: "0 2px",
        ...style
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRevert(); }}
          aria-label="Revert to auto-derived value"
          title="Revert to auto-derived value"
          className="override-revert-btn"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "1px solid var(--border-default, #e5e7eb)",
            background: "var(--surface-card, #fff)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            lineHeight: 1,
            padding: 0,
            color: "var(--text-secondary, #374151)",
            zIndex: 2
          }}
        >↺</button>
      )}
    </div>
  );
}
