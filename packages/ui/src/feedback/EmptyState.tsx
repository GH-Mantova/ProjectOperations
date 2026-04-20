import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  heading: string;
  subtext?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, heading, subtext, action }: EmptyStateProps) {
  return (
    <div
      className="empty-state"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
        color: "var(--text-secondary, #6B7280)"
      }}
    >
      <div
        aria-hidden
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--border-subtle, #F3F4F6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          fontSize: 32,
          color: "var(--text-secondary, #6B7280)"
        }}
      >
        {icon ?? "∅"}
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary, #0F1117)",
          margin: 0,
          marginBottom: 6
        }}
      >
        {heading}
      </h3>
      {subtext ? (
        <p style={{ fontSize: 14, color: "var(--text-secondary, #6B7280)", margin: 0, maxWidth: 420 }}>
          {subtext}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}
