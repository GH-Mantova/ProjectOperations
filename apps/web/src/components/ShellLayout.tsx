import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
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
  } | null;
};

function getUrgencyPillClass(urgencyLabel?: "Urgent today" | "Due soon" | "Upcoming") {
  if (urgencyLabel === "Urgent today") {
    return "pill pill--red";
  }

  if (urgencyLabel === "Due soon") {
    return "pill pill--amber";
  }

  return "pill pill--blue";
}

export function ShellLayout() {
  const { user, logout, authFetch } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isTenderingOpen, setIsTenderingOpen] = useState(true);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const tenderingActive = location.pathname === "/tenders" || location.pathname.startsWith("/tenders/");
  const tenderingLabels = useMemo(() => readTenderingLabels(), [location.pathname]);

  useEffect(() => {
    const loadSharedFollowUps = async () => {
      const response = await authFetch("/notifications/follow-ups/shared");
      if (!response.ok) {
        setSharedFollowUps([]);
        return;
      }

      setSharedFollowUps(await response.json());
    };

    void loadSharedFollowUps();
  }, [authFetch, location.pathname]);

  const shellActionCenter = useMemo(() => {
    const prompts = sharedFollowUps
      .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP")
      .map((item) => ({
        ...item,
        audienceLabel:
          (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? "Assigned to me" : "Team follow-up",
        urgencyLabel: item.metadata?.urgencyLabel ?? "Upcoming",
        actionTarget: item.metadata?.actionTarget ?? "job"
      }))
      .slice(0, 3);

    return {
      prompts,
      assignedToMe: prompts.filter((item) => item.audienceLabel === "Assigned to me").length,
      urgentToday: prompts.filter((item) => item.urgencyLabel === "Urgent today").length
    };
  }, [sharedFollowUps, user?.id]);

  const openActionCenterTarget = (item: SharedFollowUpItem) => {
    const jobId = item.metadata?.jobId;
    if (!jobId) {
      navigate("/notifications");
      return;
    }

    if (item.metadata?.actionTarget === "documents") {
      navigate("/documents", {
        state: {
          documentFocus: {
            linkedEntityType: "Job",
            linkedEntityId: jobId,
            from: "shell-action-center",
            title: "Focused job documents"
          }
        }
      });
      return;
    }

    navigate("/jobs", {
      state: {
        jobFocus: {
          jobId,
          from: "shell-action-center"
        }
      }
    });
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
        <section className="shell__action-center">
          <AppCard title="Action Center" subtitle="Live coordination prompts surfaced across planning and document continuity">
            <div className="inline-fields">
              <span className="pill pill--blue">{shellActionCenter.prompts.length} live prompts</span>
              <span className="pill pill--green">{shellActionCenter.assignedToMe} assigned to me</span>
              <span className="pill pill--amber">{shellActionCenter.urgentToday} urgent today</span>
            </div>
            <div className="shell__action-list">
              {shellActionCenter.prompts.map((item) => (
                <div key={item.id} className="shell__action-item">
                  <div className="split-header">
                    <strong>{item.title}</strong>
                    <span className={getUrgencyPillClass(item.urgencyLabel)}>{item.urgencyLabel}</span>
                  </div>
                  <p className="muted-text">{item.body}</p>
                  <div className="inline-fields">
                    <span className={`pill ${item.audienceLabel === "Assigned to me" ? "pill--green" : "pill--slate"}`}>
                      {item.audienceLabel}
                    </span>
                    <span className="pill pill--slate">{item.metadata?.nextOwnerLabel ?? "Team owner"}</span>
                    <span
                      className={`pill ${
                        item.metadata?.triageState === "ACKNOWLEDGED"
                          ? "pill--green"
                          : item.metadata?.triageState === "WATCH"
                            ? "pill--amber"
                            : "pill--slate"
                      }`}
                    >
                      {item.metadata?.triageState === "ACKNOWLEDGED"
                        ? "I'm handling it"
                        : item.metadata?.triageState === "WATCH"
                          ? "Watch only"
                          : "Open"}
                    </span>
                  </div>
                  <button type="button" onClick={() => openActionCenterTarget(item)}>
                    Open action
                  </button>
                </div>
              ))}
              {!shellActionCenter.prompts.length ? (
                <p className="muted-text">No live actions are surfacing right now.</p>
              ) : null}
            </div>
          </AppCard>
        </section>
        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
