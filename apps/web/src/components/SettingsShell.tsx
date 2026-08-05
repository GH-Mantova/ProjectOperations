import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { can, isAdminUser } from "../auth/permissions";
import { NoAccess } from "./NoAccess";

// SettingsShell — single settings area (feat/settings-shell). Folds the
// scattered /account, /notifications and /admin/* pages into one shell with
// a left sub-nav grouped by audience (Personal, Company, Administration).
// SLICE 3 (settings-restructure): the shell is visible to every authenticated
// user; each item declares its own permission code and hides for users who
// lack it. The Administration section no longer group-gates on the "Admin"
// role — per-item permission-code gates are authoritative, super-user bypass
// in can() remains the escape hatch. FIELD nav is untouched.

type NavItem = {
  to: string;
  label: string;
  // Per-item permission gate (SLICE 3). When set, the item is hidden from
  // users who do not have the permission. Route-level guards remain as
  // defence in depth. Codes are drawn from the SLICE-1 permission map
  // (docs/plans/settings-restructure-permission-map.md); see PR body for
  // the closest-existing-code fallbacks where the plan's target code did
  // not yet exist in the registry.
  requiresPermission?: string;
  // Show the item when the user has ANY of the listed codes. Used by items
  // (e.g. Reference data & Lists, SLICE 6) whose backing page gates on more
  // than one code internally.
  requiresAnyPermission?: string[];
  superUserOnly?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
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
      // company.manage / ai.manage do not yet exist in the permission
      // registry (SLICE-1 map §2). Fall back to platform.admin — the
      // closest existing admin-config gate today (registry:19). SLICE 6/13
      // (Company) and a later slice (AI) can tighten to a dedicated code
      // once it is added to the registry alongside the seed.
      { to: "/settings/company", label: "Company", requiresPermission: "platform.admin" },
      { to: "/settings/ai", label: "AI settings", requiresPermission: "platform.admin" },
      // SLICE 6 (settings-restructure §2): single Company home for the
      // rates/lists reference-data surface. Gate mirrors the page's own
      // check (rates.manage || lists.manage); both codes exist in the
      // permission registry (rates:86, lists:87).
      {
        to: "/settings/reference-data",
        label: "Reference data & Lists",
        requiresAnyPermission: ["rates.manage", "lists.manage"]
      },
      { to: "/settings/data-model", label: "Data model", superUserOnly: true }
    ]
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      // AdminSettingsPage aggregates the AI/notifications/email/integrations
      // tabs; gate on the umbrella platform.admin code that already governs
      // those write paths (registry:19). SLICE 14 dissolves the mega-page.
      { to: "/settings/administration/system", label: "Admin settings", requiresPermission: "platform.admin" },
      { to: "/settings/administration/users", label: "Users", requiresPermission: "users.view" },
      // Roles + Permissions are two separate items today; SLICE 8 folds
      // them into a single "Roles & Permissions" screen gated on the
      // manage/update code. Until then, gate each on its read code.
      { to: "/settings/administration/roles", label: "Roles", requiresPermission: "roles.view" },
      { to: "/settings/administration/permissions", label: "Permissions", requiresPermission: "permissions.view" },
      { to: "/settings/administration/audit", label: "Audit", requiresPermission: "audit.view" },
      // platform.manage is the SLICE-1 target code; it does not exist yet.
      // Fall back to the existing platform.admin (registry:19) — same
      // audience today. SLICE 12 tightens once platform.manage lands.
      { to: "/settings/administration/platform", label: "Platform", requiresPermission: "platform.admin" },
      // Job roles is a scheduler competency bundle (SLICE 15 moves it to
      // /workers/job-roles). resources.manage governs worker competencies
      // and is the closest existing code.
      { to: "/settings/administration/job-roles", label: "Job roles", requiresPermission: "resources.manage" }
    ]
  }
];

export function SettingsShell() {
  const { user } = useAuth();
  const isSuperUser = user?.isSuperUser === true;

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.superUserOnly && !isSuperUser) return false;
      if (item.requiresPermission && !can(user, item.requiresPermission)) return false;
      if (item.requiresAnyPermission && !item.requiresAnyPermission.some((code) => can(user, code))) {
        return false;
      }
      return true;
    })
  })).filter((section) => section.items.length > 0);

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

// Permission-code route/section guard. Renders children iff the user has
// at least one of the supplied codes (super-user bypass via can()). Meant
// to replace <AdminOnly> at App.tsx route wrappers as SLICEs 7-17 land;
// exported here alongside the existing guards so callers migrate one at a
// time without a barrel-file churn.
export function RequirePermissions({
  perms,
  children
}: {
  perms: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user) return null;
  const allowed = perms.some((code) => can(user, code));
  if (!allowed) {
    return (
      <NoAccess required={perms.join(" | ")} title="You don't have access to this section" />
    );
  }
  return <>{children}</>;
}

// Legacy role-name guard. Kept for compatibility with App.tsx route
// wrappers until SLICE 17 replaces them with <RequirePermissions>. The
// Administration section inside this shell no longer relies on it — nav
// visibility is now driven by per-item permission codes.
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
