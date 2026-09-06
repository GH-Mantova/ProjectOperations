import { NavLink, Outlet } from "react-router-dom";
import { useAuth, type SafeUser } from "../auth/AuthContext";
import { can, isAdminUser } from "../auth/permissions";
import { NoAccess } from "./NoAccess";
import {
  PERSONAL_ITEMS,
  COMPANY_ITEMS,
  ADMINISTRATION_ITEMS as ADMINISTRATION_ITEMS_DATA,
  EXTERNAL_ITEMS
} from "./settings-nav-items";

// SettingsShell — single settings area (feat/settings-shell). Folds the
// scattered /account, /notifications and /admin/* pages into one shell with
// a left sub-nav grouped by audience (Personal, Company, Administration).
// SLICE 3 (settings-restructure): the shell is visible to every authenticated
// user; each item declares its own permission code and hides for users who
// lack it. The Administration section no longer group-gates on the "Admin"
// role — per-item permission-code gates are authoritative, super-user bypass
// in can() remains the escape hatch. FIELD nav is untouched.

export type SettingsNavItem = {
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
  // SLICE 1 (settings-home-plan.md): plain-English description of the page,
  // used by the Settings Home card grid and the search surface.
  // Required — the TypeScript compiler flags any item missing one.
  description: string;
  // SLICE 1: tabs declared by the page.  Empty array = page has no tabs.
  // Tab ids must match the identifiers the page uses internally so SLICE 3
  // can deep-link via ?tab=<id>.
  tabs?: { id: string; label: string; description: string }[];
  // SETTINGS_HOME_S1: true for the settings pages that live outside
  // /settings (Schedule of Rates, Job roles).  Marco decided 2026-09-01 to
  // link them in place, so this flag NEVER changes how the link is built —
  // it only drives styling (an "Elsewhere" badge on the home card) and
  // grouping (they sit in their own section), and it keeps them out of the
  // SettingsShell sub-nav, which navigates within the shell.
  external?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

// SLICE 16: Administration nav items exported so the AdministrationLandingPage
// hub (/settings/administration) lists exactly the same destinations the shell
// sub-nav shows, gated on the exact same codes.
// SLICE 1 (settings-home-plan.md): item data (including description + tabs)
// now lives in settings-nav-items.ts; re-exported here so callers that import
// ADMINISTRATION_ITEMS from SettingsShell continue to work unchanged.
export const ADMINISTRATION_ITEMS: SettingsNavItem[] = ADMINISTRATION_ITEMS_DATA;

export function filterSettingsNavItems(items: SettingsNavItem[], user: SafeUser | null): SettingsNavItem[] {
  const isSuperUser = user?.isSuperUser === true;
  return items.filter((item) => {
    if (item.superUserOnly && !isSuperUser) return false;
    if (item.requiresPermission && !can(user, item.requiresPermission)) return false;
    if (item.requiresAnyPermission && !item.requiresAnyPermission.some((code) => can(user, code))) {
      return false;
    }
    return true;
  });
}

// SLICE 1 (settings-home-plan.md): partition function for the Settings Home
// page.  Unlike filterSettingsNavItems (which removes locked items), this
// returns both accessible and inaccessible items so the Home page can render
// locked cards greyed with a Request access button (D45/D46).
//
// The gating logic is identical to filterSettingsNavItems — do NOT modify
// filterSettingsNavItems.  AdministrationLandingPage depends on the current
// hide-locked behaviour and must not be affected.
export function partitionSettingsNavItems(
  items: SettingsNavItem[],
  user: SafeUser | null
): { open: SettingsNavItem[]; locked: SettingsNavItem[] } {
  const isSuperUser = user?.isSuperUser === true;
  const open: SettingsNavItem[] = [];
  const locked: SettingsNavItem[] = [];
  for (const item of items) {
    let accessible = true;
    if (item.superUserOnly && !isSuperUser) accessible = false;
    else if (item.requiresPermission && !can(user, item.requiresPermission)) accessible = false;
    else if (
      item.requiresAnyPermission &&
      !item.requiresAnyPermission.some((code) => can(user, code))
    ) {
      accessible = false;
    }
    if (accessible) {
      open.push(item);
    } else {
      locked.push(item);
    }
  }
  return { open, locked };
}

// SLICE 1 (settings-home-plan.md): item data (descriptions + tabs) now lives
// in settings-nav-items.ts.  The section structure is preserved exactly so
// SettingsShell's rendering logic and any callers that reference SECTIONS
// indirectly are unaffected.
// Exported so the Settings Home page and coverage tests can iterate all items.
export const SECTIONS: NavSection[] = [
  {
    id: "personal",
    label: "Personal",
    items: PERSONAL_ITEMS
  },
  {
    id: "company",
    label: "Company",
    items: COMPANY_ITEMS
  },
  {
    id: "administration",
    label: "Administration",
    items: ADMINISTRATION_ITEMS
  },
  // SETTINGS_HOME_S1: the two settings pages that live outside /settings.
  // They are in SECTIONS so the Settings Home cards, the counts line and
  // settings-search all see them without settings-search.ts changing.
  {
    id: "elsewhere",
    label: "Elsewhere",
    items: EXTERNAL_ITEMS
  }
];

export function SettingsShell() {
  const { user } = useAuth();

  // The shell sub-nav navigates WITHIN the settings shell, so the external
  // items are excluded here — following one would unmount the very nav that
  // rendered it.  They are surfaced on the Settings Home card grid instead.
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: filterSettingsNavItems(
      section.items.filter((item) => item.external !== true),
      user
    )
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
