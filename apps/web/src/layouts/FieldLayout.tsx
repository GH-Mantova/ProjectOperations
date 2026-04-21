// FieldLayout is optimised for slow mobile connections. Keep components in this layout
// lightweight. True offline/PWA support is a separate PR.
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const BG = "#F6F6F6";
const BOTTOM_NAV_BG = "#000000";
const TEAL = "#005B61";
const ORANGE = "#FEAA6D";

const NAV_ITEMS: Array<{ to: string; label: string; icon: string }> = [
  { to: "/field/allocations", label: "Home", icon: "🏠" },
  { to: "/field/pre-start", label: "Pre-Start", icon: "✅" },
  { to: "/field/timesheet", label: "Timesheet", icon: "⏱" },
  { to: "/field/documents", label: "Documents", icon: "📄" },
  { to: "/field/safety", label: "Safety", icon: "⚠️" }
];

const PAGE_TITLES: Record<string, string> = {
  "/field/allocations": "My Jobs",
  "/field/pre-start": "Pre-Start",
  "/field/timesheet": "Timesheet",
  "/field/documents": "Documents",
  "/field/safety": "Safety"
};

export function FieldLayout() {
  const location = useLocation();
  const { logout } = useAuth();
  const title =
    PAGE_TITLES[location.pathname] ??
    Object.entries(PAGE_TITLES).find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ??
    "Field";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        paddingBottom: 72,
        fontFamily: "Outfit, system-ui, sans-serif"
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#fff",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #E5E5E5"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              background: TEAL,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14
            }}
          >
            IS
          </span>
          <h1 style={{ margin: 0, fontSize: 16, fontFamily: "Syne, Outfit, sans-serif" }}>{title}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            to="/notifications"
            aria-label="Notifications"
            style={{
              width: 44,
              height: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              color: "#1F2937",
              textDecoration: "none",
              fontSize: 20
            }}
          >
            🔔
          </Link>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            style={{
              width: 44,
              height: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              color: "#1F2937",
              fontSize: 18,
              cursor: "pointer"
            }}
          >
            ⎋
          </button>
        </div>
      </header>

      <main style={{ padding: 16 }}>
        <Outlet />
      </main>

      <nav
        aria-label="Field navigation"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: BOTTOM_NAV_BG,
          display: "grid",
          gridTemplateColumns: `repeat(${NAV_ITEMS.length}, 1fr)`,
          height: 64,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.12)"
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              minHeight: 44,
              color: isActive ? TEAL : "#fff",
              textDecoration: "none",
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              borderTop: isActive ? `3px solid ${TEAL}` : "3px solid transparent"
            })}
          >
            <span aria-hidden style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <style>{`
        .field-btn {
          background: ${ORANGE};
          color: #1F2937;
          border: none;
          border-radius: 8px;
          padding: 12px 16px;
          font-weight: 600;
          font-size: 15px;
          min-height: 44px;
          cursor: pointer;
        }
        .field-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .field-btn--ghost { background: transparent; color: ${TEAL}; }
        .field-btn--teal { background: ${TEAL}; color: #fff; }
        .field-card {
          background: #fff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
          margin-bottom: 12px;
        }
        .field-pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
        }
        .field-input {
          width: 100%;
          min-height: 44px;
          padding: 10px 12px;
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          font-size: 15px;
          background: #fff;
        }
        .field-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          display: block;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}
