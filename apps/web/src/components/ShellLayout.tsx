import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  { to: "/archive", label: "📦 Archive" },
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

export function ShellLayout() {
  const { user, logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isTenderingOpen, setIsTenderingOpen] = useState(true);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const tenderingActive = location.pathname === "/tenders" || location.pathname.startsWith("/tenders/");
  const tenderingLabels = useMemo(() => readTenderingLabels(), [location.pathname]);

  const loadSharedFollowUps = async () => {
    const response = await authFetch("/notifications/follow-ups/shared");
    if (!response.ok) {
      setSharedFollowUps([]);
      return;
    }

    setSharedFollowUps(await response.json());
  };

  useEffect(() => {
    void loadSharedFollowUps();
  }, [authFetch, location.pathname]);

  const shellActionSummary = useMemo(() => {
    const prompts = sharedFollowUps.filter(
      (item) => item.metadata?.kind === "LIVE_FOLLOW_UP" || item.metadata?.kind === "MANUAL_FOLLOW_UP"
    );
    const assignedToMe = prompts.filter((item) => (item.metadata?.nextOwnerId ?? item.userId) === user?.id).length;
    const urgentToday = prompts.filter((item) => item.metadata?.urgencyLabel === "Urgent today").length;

    return {
      total: prompts.length,
      assignedToMe,
      urgentToday
    };
  }, [sharedFollowUps, user?.id]);

  const openNotifications = () => {
    navigate("/notifications");
  };

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
              <span>{item.label}</span>
              {item.to === "/notifications" && shellActionSummary.total ? (
                <span className="shell__nav-badge" aria-label={`${shellActionSummary.total} live prompts`}>
                  {shellActionSummary.total}
                </span>
              ) : null}
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
          <div className="shell__header-actions">
            <button
              className="shell__header-action shell__header-action--secondary shell__header-action--button"
              onClick={openNotifications}
            >
              Action Center
              {shellActionSummary.total ? (
                <span className="shell__header-action-count">
                  {shellActionSummary.total}
                  {shellActionSummary.urgentToday ? ` / ${shellActionSummary.urgentToday} urgent` : ""}
                </span>
              ) : null}
            </button>
            <button className="shell__header-action shell__header-action--button" onClick={logout}>
              Logout
            </button>
          </div>
        </header>
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
