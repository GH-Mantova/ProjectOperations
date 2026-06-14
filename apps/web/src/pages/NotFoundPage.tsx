import { Link, useLocation } from "react-router-dom";

/**
 * Catch-all route renderer when no other route matches.
 *
 * Replaces the silent `<Navigate to="/" />` redirect that previously
 * masked broken routes (e.g. /admin/ai-settings appearing as a
 * navigate-to-overview bug during PR #120 smoke).
 */
export function NotFoundPage() {
  const location = useLocation();
  return (
    <div
      role="main"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: 32,
        textAlign: "center",
        gap: 16
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
          fontSize: 24,
          fontWeight: 700,
          color: "var(--text-secondary, #6B7280)"
        }}
      >
        404
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
        Page not found
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary, #6B7280)", maxWidth: 480, margin: 0 }}>
        We couldn't find <code>{location.pathname}</code>. Check the URL, or head back to the
        dashboard.
      </p>
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 16px",
          background: "var(--brand-primary)",
          color: "#fff",
          borderRadius: "var(--radius-md)",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 500,
          minWidth: 44,
          minHeight: 44
        }}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
