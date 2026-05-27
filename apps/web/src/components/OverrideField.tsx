import { useState, type CSSProperties, type ReactNode } from "react";

type Props = {
  isOverridden: boolean;
  onRevert: () => void;
  children: ReactNode;
  style?: CSSProperties;
};

export function OverrideField({ isOverridden, onRevert, children, style }: Props) {
  const [hovered, setHovered] = useState(false);

  if (!isOverridden) {
    return <div style={style}>{children}</div>;
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
