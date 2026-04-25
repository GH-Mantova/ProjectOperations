import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePortalAuth } from "./PortalAuthContext";

const NAV_ITEMS = [
  { to: "/portal", label: "Dashboard", end: true },
  { to: "/portal/projects", label: "Projects" },
  { to: "/portal/jobs", label: "Jobs" },
  { to: "/portal/quotes", label: "Quotes" },
  { to: "/portal/documents", label: "Documents" },
  { to: "/portal/account", label: "Account" }
];

export function PortalLayout() {
  const { user, logout } = usePortalAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-app, #f5f5f4)" }}>
      <header
        style={{
          background: "#005B61",
          color: "#fff",
          padding: "14px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <strong style={{ fontSize: 18 }}>Initial Services — Client Portal</strong>
          {user ? (
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{user.client.name}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {user ? (
            <span style={{ fontSize: 13 }}>
              {user.firstName} {user.lastName}
            </span>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate("/portal/login");
            }}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 4,
              padding: "4px 12px",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <nav
        style={{
          background: "#fff",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          padding: "0 28px",
          display: "flex",
          gap: 4,
          overflowX: "auto"
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              padding: "12px 16px",
              fontSize: 14,
              color: isActive ? "#005B61" : "var(--text-default, #242424)",
              textDecoration: "none",
              borderBottom: isActive ? "2px solid #005B61" : "2px solid transparent",
              fontWeight: isActive ? 600 : 400
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1280, width: "100%", margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
