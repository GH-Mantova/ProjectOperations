import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ADMINISTRATION_ITEMS, filterSettingsNavItems } from "../../components/SettingsShell";
import { NoAccess } from "../../components/NoAccess";

// SLICE 16 (settings-restructure §3): a direct hit on /settings/administration
// used to 404 because only administration/* children were registered. This hub
// lists the Administration destinations the caller can access, gated on the
// same permission codes SettingsShell uses for its sub-nav.
export function AdministrationLandingPage() {
  const { user } = useAuth();
  const visibleItems = filterSettingsNavItems(ADMINISTRATION_ITEMS, user);

  if (visibleItems.length === 0) {
    const codes = ADMINISTRATION_ITEMS.map((item) => item.requiresPermission ?? "").filter(Boolean);
    return <NoAccess required={codes} title="You don't have access to Administration" />;
  }

  return (
    <div data-testid="administration-landing" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h2 className="s7-type-page-heading" style={{ margin: 0 }}>
          Administration
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
          Manage system settings, users, roles, audit history, platform, and automations.
        </p>
      </header>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))"
        }}
      >
        {visibleItems.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              data-testid={`administration-landing-link-${item.to.split("/").pop()}`}
              style={{
                display: "block",
                padding: 16,
                borderRadius: 8,
                border: "1px solid var(--border, #e5e7eb)",
                background: "var(--surface, #fff)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontWeight: 600
              }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
