import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isAdminUser } from "../auth/permissions";
import { NoAccess } from "./NoAccess";

// SettingsShell — single settings area (feat/settings-shell). Folds the
// scattered /account, /notifications and /admin/* pages into one shell with
// a left sub-nav grouped by audience (Personal, Company, Administration).
// The Administration group is role-gated at the nav level and at each
// admin sub-route via <AdminOnly>. FIELD nav is untouched — this only
// consolidates desktop settings.

type NavItem = {
  to: string;
  label: string;
  superUserOnly?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const SECTIONS: NavSection[] = [
  {
    id: "personal",
    label: "Personal",
    items: [
      { to: "/settings/account", label: "Account" },
      { to: "/settings/notifications", label: "Notifications" },
      { to: "/settings/calendar-sync", label: "Calendar sync" }
    ]
  },
  {
    id: "company",
    label: "Company",
    items: [
      { to: "/settings/company", label: "Company" },
      { to: "/settings/ai", label: "AI settings" },
      { to: "/settings/data-model", label: "Data model", superUserOnly: true }
    ]
  },
  {
    id: "administration",
    label: "Administration",
    adminOnly: true,
    items: [
      { to: "/settings/administration/system", label: "Admin settings" },
      { to: "/settings/administration/users", label: "Users" },
      { to: "/settings/administration/roles", label: "Roles" },
      { to: "/settings/administration/permissions", label: "Permissions" },
      { to: "/settings/administration/audit", label: "Audit" },
      { to: "/settings/administration/platform", label: "Platform" },
      { to: "/settings/administration/job-roles", label: "Job roles" }
    ]
  }
];

export function SettingsShell() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const isSuperUser = user?.isSuperUser === true;

  const visibleSections = SECTIONS.filter((section) => !section.adminOnly || isAdmin).map(
    (section) => ({
      ...section,
      items: section.items.filter((item) => !item.superUserOnly || isSuperUser)
    })
  );

  return (
    <div className="settings-shell">
      <header className="settings-shell__header">
        <h1 className="s7-type-page-heading" style={{ margin: 0 }}>
          Settings
        </h1>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
          Personal preferences, company configuration and administration in one place.
        </p>
      </header>

      <div className="settings-shell__layout">
        <nav className="settings-shell__nav" aria-label="Settings sections">
          {visibleSections.map((section) => (
            <div key={section.id} className="settings-shell__nav-group">
              <p className="s7-type-label settings-shell__nav-group-label">{section.label}</p>
              <ul className="settings-shell__nav-list">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        isActive
                          ? "settings-shell__nav-link settings-shell__nav-link--active"
                          : "settings-shell__nav-link"
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="settings-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Guard for the Administration sub-routes. Non-admin users hitting an
// admin sub-route (via direct URL or a stale link) see NoAccess instead
// of the target page. The nav itself hides the group so this is a
// belt-and-braces defence.
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!isAdminUser(user)) {
    return <NoAccess required="role:Admin" title="Administration requires the Admin role" />;
  }
  return <>{children}</>;
}

// Guard for super-user only sub-routes (Data model).
export function SuperUserOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.isSuperUser !== true) {
    return (
      <NoAccess required="super-user" title="This section is restricted to super users" />
    );
  }
  return <>{children}</>;
}
