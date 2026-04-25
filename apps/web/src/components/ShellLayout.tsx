import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { CommandPalette } from "./CommandPalette";
import { NewDashboardModal } from "../dashboards/NewDashboardModal";
import { useUserDashboards, useUserDashboardsActions } from "../dashboards/userDashboards";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  match?: (pathname: string) => boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const ICON_DASHBOARD = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
const ICON_JOBS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const ICON_SCHEDULER = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);
const ICON_FORMS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h6" />
  </svg>
);
const ICON_TENDERING = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
  </svg>
);
const ICON_CONTRACTS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);
const ICON_WORKERS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15 20a5 5 0 0 1 6.5-4.5" />
  </svg>
);
const ICON_ASSETS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2l9 5v10l-9 5-9-5V7z" />
    <path d="M12 12l9-5M12 12l-9-5M12 12v10" />
  </svg>
);
const ICON_MAINTENANCE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.6-.4-.4-2.6z" />
  </svg>
);
const ICON_CLIENTS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
  </svg>
);
const ICON_SITES = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2C8 2 5 5 5 9c0 5.5 7 13 7 13s7-7.5 7-13c0-4-3-7-7-7z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);
const ICON_DOCUMENTS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
);
const ICON_ARCHIVE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </svg>
);
const ICON_USERS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
const ICON_ROLES = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" />
  </svg>
);
const ICON_AUDIT = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M16 16l5 5" />
  </svg>
);
const ICON_BELL = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);
const ICON_SEARCH = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M16 16l5 5" />
  </svg>
);
const ICON_COLLAPSE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const ICON_EXPAND = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const NAV_GROUPS: NavGroup[] = [
  {
    id: "commercial",
    label: "Commercial",
    items: [
      {
        to: "/tenders",
        label: "Tendering",
        icon: ICON_TENDERING,
        match: (path) =>
          path === "/tenders" ||
          (path.startsWith("/tenders/") &&
            !path.startsWith("/tenders/dashboard") &&
            !path.startsWith("/tenders/reports"))
      },
      {
        to: "/contracts",
        label: "Contracts",
        icon: ICON_CONTRACTS,
        match: (path) => path === "/contracts" || path.startsWith("/contracts/")
      }
    ]
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        to: "/projects",
        label: "Projects",
        icon: ICON_CONTRACTS,
        match: (path) => path === "/projects" || path.startsWith("/projects/")
      },
      { to: "/jobs", label: "Jobs", icon: ICON_JOBS },
      { to: "/scheduler", label: "Scheduler", icon: ICON_SCHEDULER },
      {
        to: "/sites",
        label: "Sites",
        icon: ICON_SITES,
        match: (path) => path.startsWith("/sites") || path.startsWith("/master-data?tab=sites")
      },
      { to: "/assets", label: "Assets", icon: ICON_ASSETS },
      { to: "/maintenance", label: "Maintenance", icon: ICON_MAINTENANCE },
      { to: "/forms", label: "Forms", icon: ICON_FORMS }
    ]
  },
  {
    id: "directory",
    label: "Directory",
    items: [
      {
        to: "/master-data?tab=clients",
        label: "Clients",
        icon: ICON_CLIENTS,
        match: (path) => path.startsWith("/master-data")
      },
      {
        to: "/directory/subcontractors",
        label: "Subcontractors & Suppliers",
        icon: ICON_CLIENTS,
        match: (path) => path.startsWith("/directory/subcontractors")
      },
      {
        to: "/directory/contacts",
        label: "Contacts",
        icon: ICON_WORKERS,
        match: (path) => path.startsWith("/directory/contacts")
      }
    ]
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: ICON_DASHBOARD,
        match: (path) => path === "/" || path.startsWith("/dashboards/")
      },
      { to: "/documents", label: "Documents", icon: ICON_DOCUMENTS },
      {
        to: "/compliance",
        label: "Compliance",
        icon: ICON_AUDIT,
        match: (path) => path.startsWith("/compliance")
      },
      {
        to: "/safety",
        label: "Safety",
        icon: ICON_AUDIT,
        match: (path) => path.startsWith("/safety")
      },
      { to: "/archive", label: "Archive", icon: ICON_ARCHIVE, match: (path) => path.startsWith("/archive") }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    adminOnly: true,
    items: [
      { to: "/admin/settings", label: "Admin Settings", icon: ICON_AUDIT },
      { to: "/admin/estimate-rates", label: "Rates & Lists", icon: ICON_TENDERING }
    ]
  }
];

type SharedFollowUpItem = {
  id: string;
  title: string;
  body: string;
  userId: string;
  metadata?: {
    kind?: string;
    promptKey?: string;
    jobId?: string;
    actionTarget?: "job" | "documents";
    nextOwnerId?: string | null;
    nextOwnerLabel?: string;
    audienceLabel?: "Assigned to me" | "Team follow-up";
    urgencyLabel?: "Urgent today" | "Due soon" | "Upcoming";
    triageState?: "OPEN" | "ACKNOWLEDGED" | "WATCH";
    manualType?: "HANDOFF" | "ESCALATION";
    reasonCode?: string;
    assignmentMode?: "DERIVED" | "MANUAL";
    assignedByLabel?: string | null;
    assignedAt?: string | null;
  } | null;
};

const BREADCRUMBS: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/timesheets/approval": "Timesheets",
  "/jobs": "Jobs",
  "/scheduler": "Scheduler",
  "/forms": "Forms",
  "/tenders": "Tendering",
  "/tenders/dashboard": "Tender Dashboard",
  "/tenders/reports": "Tender Reports",
  "/workers": "Workers",
  "/resources": "Workers (legacy)",
  "/assets": "Assets",
  "/maintenance": "Maintenance",
  "/master-data": "Master Data",
  "/documents": "Documents",
  "/archive": "Archive",
  "/account": "My account",
  "/notifications": "Notifications",
  "/dashboards": "Dashboards",
  "/admin/users": "Users",
  "/admin/roles": "Roles",
  "/admin/estimate-rates": "Estimate Rates",
  "/admin/permissions": "Permissions",
  "/admin/audit": "Audit",
  "/admin/platform": "Platform",
  "/admin/settings": "Admin Settings",
  "/contracts": "Contracts"
};

function initialsOf(firstName?: string, lastName?: string, email?: string): string {
  if (firstName || lastName) {
    return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  }
  return email?.slice(0, 2).toUpperCase() ?? "?";
}

function resolveBreadcrumb(pathname: string): string {
  if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname];
  const prefixes = Object.keys(BREADCRUMBS).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (prefix !== "/" && pathname.startsWith(prefix + "/")) return BREADCRUMBS[prefix];
  }
  return "Workspace";
}

export function ShellLayout() {
  const { user, logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifBadge, setNotifBadge] = useState(0);
  const [newDashboardOpen, setNewDashboardOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement | null>(null);

  const { data: allDashboards } = useUserDashboards();
  const { remove: removeDashboard } = useUserDashboardsActions();
  const customDashboards = useMemo(
    () => (allDashboards ?? []).filter((d) => !d.isSystem),
    [allDashboards]
  );

  const isAdmin = useMemo(() => {
    const roleNames = user?.roles?.map((role) => role.name) ?? [];
    return roleNames.includes("Admin");
  }, [user?.roles]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await authFetch("/notifications/follow-ups/shared");
      if (!response.ok) {
        if (!cancelled) setSharedFollowUps([]);
        return;
      }
      if (!cancelled) setSharedFollowUps(await response.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, location.pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await authFetch("/notifications/me");
      if (!response.ok) return;
      const data = (await response.json()) as Array<{ status?: string }>;
      if (cancelled) return;
      setNotifBadge(data.filter((item) => item.status === "UNREAD").length);
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const followUpFallbackCount = useMemo(
    () =>
      sharedFollowUps.filter(
        (item) => item.metadata?.kind === "LIVE_FOLLOW_UP" || item.metadata?.kind === "MANUAL_FOLLOW_UP"
      ).length,
    [sharedFollowUps]
  );

  const badgeCount = notifBadge || followUpFallbackCount;

  const breadcrumb = resolveBreadcrumb(location.pathname);
  const initials = initialsOf(user?.firstName, user?.lastName, user?.email);
  const primaryRole = user?.roles?.[0]?.name ?? "Member";

  const filteredGroups = NAV_GROUPS.filter((group) => !group.adminOnly || isAdmin);

  return (
    <div className={`shell${collapsed ? " shell--collapsed" : ""}`}>
      <aside className="shell__sidebar" aria-label="Primary">
        <div className="shell__brand">
          <span className="shell__brand-logo" aria-hidden>PO</span>
          <span className="shell__brand-name">Project Ops</span>
          <button
            type="button"
            className="shell__collapse-toggle"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? ICON_EXPAND : ICON_COLLAPSE}
          </button>
        </div>

        <nav className="shell__nav" aria-label="Main navigation">
          <div className="shell__nav-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 6px" }}>
              <p className="shell__nav-group-label" style={{ margin: 0 }}>Dashboards</p>
              <button
                type="button"
                onClick={() => setNewDashboardOpen(true)}
                title="New dashboard"
                aria-label="New dashboard"
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}
              >
                +
              </button>
            </div>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "shell__nav-link shell__nav-link--active" : "shell__nav-link")}
              title={collapsed ? "Operations" : undefined}
            >
              <span className="shell__nav-icon">{ICON_DASHBOARD}</span>
              <span className="shell__nav-label">Operations</span>
            </NavLink>
            <NavLink
              to="/tenders/dashboard"
              className={location.pathname.startsWith("/tenders/dashboard") ? "shell__nav-link shell__nav-link--active" : "shell__nav-link"}
              title={collapsed ? "Tendering" : undefined}
            >
              <span className="shell__nav-icon">{ICON_DASHBOARD}</span>
              <span className="shell__nav-label">Tendering</span>
            </NavLink>
            {customDashboards.map((d) => {
              const to = `/dashboards/${d.id}`;
              const isActive = location.pathname === to;
              return (
                <div key={d.id} className="shell__nav-link-wrap">
                  <NavLink
                    to={to}
                    className={isActive ? "shell__nav-link shell__nav-link--active" : "shell__nav-link"}
                    title={collapsed ? d.name : undefined}
                  >
                    <span className="shell__nav-icon">{ICON_DASHBOARD}</span>
                    <span className="shell__nav-label">{d.name}</span>
                  </NavLink>
                  <button
                    type="button"
                    className="shell__nav-remove"
                    aria-label={`Remove ${d.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!window.confirm(`Remove "${d.name}"?`)) return;
                      void removeDashboard(d.id).then(() => {
                        if (isActive) navigate("/");
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {filteredGroups.map((group) => (
            <div key={group.id} className="shell__nav-group">
              <p className="shell__nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const isActive = item.match ? item.match(location.pathname) : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <NavLink
                    key={`${group.id}-${item.to}-${item.label}`}
                    to={item.to}
                    className={isActive ? "shell__nav-link shell__nav-link--active" : "shell__nav-link"}
                    title={collapsed ? item.label : undefined}
                    end={item.to === "/"}
                  >
                    <span className="shell__nav-icon">{item.icon}</span>
                    <span className="shell__nav-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shell__sidebar-footer">
          <div className="shell__sidebar-user" title={collapsed ? user?.email ?? "" : undefined}>
            <span className="shell__sidebar-user-avatar">{initials}</span>
            <div className="shell__sidebar-user-meta">
              <span className="shell__sidebar-user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="shell__sidebar-user-role">{primaryRole}</span>
            </div>
          </div>
          <button type="button" className="shell__sidebar-logout" onClick={logout} aria-label="Logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 17l5-5-5-5M20 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
            </svg>
            <span className="shell__sidebar-logout-label">Logout</span>
          </button>
        </div>
      </aside>

      <nav className="shell__tab-bar" aria-label="Mobile navigation">
        {filteredGroups.flatMap((group) =>
          group.items.slice(0, 1).map((item) => {
            const isActive = item.match ? item.match(location.pathname) : location.pathname === item.to;
            return (
              <NavLink
                key={`tab-${group.id}`}
                to={item.to}
                className={isActive ? "shell__tab shell__tab--active" : "shell__tab"}
                aria-label={group.label}
              >
                <span className="shell__tab-icon">{item.icon}</span>
                <span className="shell__tab-label">{group.label}</span>
              </NavLink>
            );
          })
        )}
      </nav>

      <div className="shell__main">
        <header className="shell__topbar">
          <div className="shell__breadcrumb">
            <span className="shell__breadcrumb-root">Project Ops</span>
            <span className="shell__breadcrumb-sep">/</span>
            <span className="shell__breadcrumb-current">{breadcrumb}</span>
          </div>
          <div className="shell__topbar-actions">
            <div className="shell__topbar-bell-wrap">
              <button
                ref={bellRef}
                type="button"
                className="shell__topbar-action"
                onClick={() => setNotifOpen((current) => !current)}
                aria-label={`Notifications${badgeCount ? `, ${badgeCount} unread` : ""}`}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
              >
                {ICON_BELL}
                {badgeCount ? <span className="shell__topbar-badge">{badgeCount}</span> : null}
              </button>
              <NotificationsDropdown
                anchorRef={bellRef}
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                onUnreadCountChange={setNotifBadge}
              />
            </div>
            <button
              type="button"
              className="shell__topbar-action"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search (Cmd/Ctrl+K)"
              title="Search (Cmd/Ctrl+K)"
            >
              {ICON_SEARCH}
            </button>
            <button
              type="button"
              className="shell__topbar-avatar"
              onClick={() => navigate("/account")}
              aria-label={`Account — signed in as ${user?.firstName} ${user?.lastName}`}
              title="My account"
            >
              {initials}
            </button>
          </div>
        </header>
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {newDashboardOpen ? (
        <NewDashboardModal
          slug="custom"
          existingDashboards={customDashboards}
          onClose={() => setNewDashboardOpen(false)}
          onCreated={() => setNewDashboardOpen(false)}
        />
      ) : null}
    </div>
  );
}
