import { useMemo, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { readTenderingLabels } from "../tendering-labels";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/jobs", label: "Jobs" },
  { to: "/scheduler", label: "Scheduler" },
  { to: "/resources", label: "Resources" },
  { to: "/assets", label: "Assets" },
  { to: "/maintenance", label: "Maintenance" },
  { to: "/forms", label: "Forms" },
  { to: "/documents", label: "Documents" },
  { to: "/master-data", label: "Master Data" },
  { to: "/notifications", label: "Notifications" },
  { to: "/dashboards", label: "Dashboards" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/roles", label: "Roles" },
  { to: "/admin/permissions", label: "Permissions" },
  { to: "/admin/audit", label: "Audit" },
  { to: "/admin/platform", label: "Platform" }
];

const tenderingItems = [
  { to: "/tenders/pipeline", labelKey: "nav.pipeline" },
  { to: "/tenders/create", labelKey: "nav.createTender" },
  { to: "/tenders/clients", labelKey: "nav.clients" },
  { to: "/tenders/contacts", labelKey: "nav.contacts" },
  { to: "/tenders/settings", labelKey: "nav.settings" }
] as const;

export function ShellLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isTenderingOpen, setIsTenderingOpen] = useState(true);
  const tenderingActive = location.pathname === "/tenders" || location.pathname.startsWith("/tenders/");
  const tenderingLabels = useMemo(() => readTenderingLabels(), [location.pathname]);

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <p>Project Operations</p>
          <span>Platform Foundation</span>
        </div>
        <nav className="shell__nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }: { isActive: boolean }) =>
                isActive ? "shell__nav-link shell__nav-link--active" : "shell__nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="shell__nav-group">
            <div className={tenderingActive ? "shell__nav-parent shell__nav-parent--active" : "shell__nav-parent"}>
              <NavLink
                to="/tenders"
                className={({ isActive }: { isActive: boolean }) =>
                  isActive
                    ? "shell__nav-link shell__nav-link--active shell__nav-parent-link"
                    : "shell__nav-link shell__nav-parent-link"
                }
              >
                {tenderingLabels["nav.tendering"]}
              </NavLink>
              <button
                type="button"
                className="shell__nav-parent-toggle"
                aria-label={isTenderingOpen ? "Collapse Tendering menu" : "Expand Tendering menu"}
                aria-expanded={isTenderingOpen}
                onClick={() => setIsTenderingOpen((current) => !current)}
              >
                {isTenderingOpen ? "-" : "+"}
              </button>
            </div>
            {isTenderingOpen ? (
              <div className="shell__subnav">
                {tenderingItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }: { isActive: boolean }) =>
                      isActive ? "shell__subnav-link shell__subnav-link--active" : "shell__subnav-link"
                    }
                  >
                    {tenderingLabels[item.labelKey]}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        </nav>
      </aside>
      <div className="shell__main">
        <header className="shell__header">
          <div>
            <div className="shell__title-row">
              <h1>Operational Workspace</h1>
              <span className="shell__version">Version {__APP_VERSION__}</span>
            </div>
            <p>
              Signed in as {user?.firstName} {user?.lastName}. Local auth and admin controls are now active.
            </p>
          </div>
          <button className="shell__header-action shell__header-action--button" onClick={logout}>
            Logout
          </button>
        </header>
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
