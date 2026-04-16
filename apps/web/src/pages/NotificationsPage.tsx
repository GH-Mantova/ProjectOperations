import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  severity: string;
  status: string;
  linkUrl?: string | null;
};

type FollowUpPrompt = {
  id: string;
  jobId: string;
  title: string;
  body: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  tone: "red" | "amber" | "blue";
  actionLabel: string;
  actionTarget: "job" | "documents";
  nextOwnerId?: string | null;
  nextOwnerLabel: string;
  ownerRole: string;
  audienceLabel: "Assigned to me" | "Team follow-up";
  urgencyLabel: "Urgent today" | "Due soon" | "Upcoming";
  assignmentMode: "DERIVED" | "MANUAL";
};

type FollowUpPromptState = "OPEN" | "ACKNOWLEDGED" | "WATCH";
type FollowUpScope = "ALL" | "MINE" | "TEAM" | "MANUAL";

type SharedFollowUpItem = {
  id: string;
  title: string;
  body: string;
  severity: string;
  linkUrl?: string | null;
  userId: string;
  metadata?: {
    kind?: string;
    promptKey?: string;
    jobId?: string;
    actionTarget?: "job" | "documents";
    nextOwnerId?: string | null;
    nextOwnerLabel?: string;
    ownerRole?: string;
    audienceLabel?: "Assigned to me" | "Team follow-up";
    urgencyLabel?: "Urgent today" | "Due soon" | "Upcoming";
    triageState?: FollowUpPromptState;
    triagedById?: string | null;
    triagedByLabel?: string | null;
    triagedAt?: string | null;
    assignmentMode?: "DERIVED" | "MANUAL";
    assignedById?: string | null;
    assignedByLabel?: string | null;
    assignedAt?: string | null;
  } | null;
};

type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

function getSeverityPill(severity: string) {
  if (severity.includes("HIGH") || severity.includes("RED")) {
    return "pill pill--red";
  }

  if (severity.includes("MEDIUM") || severity.includes("AMBER")) {
    return "pill pill--amber";
  }

  return "pill pill--blue";
}

function getUrgencyPillClass(urgencyLabel: FollowUpPrompt["urgencyLabel"]) {
  if (urgencyLabel === "Urgent today") {
    return "pill pill--red";
  }

  if (urgencyLabel === "Due soon") {
    return "pill pill--amber";
  }

  return "pill pill--blue";
}

function getOwnerRolePillClass(ownerRole: string) {
  if (ownerRole === "Shift lead") {
    return "pill pill--green";
  }

  if (ownerRole === "Activity owner") {
    return "pill pill--blue";
  }

  if (ownerRole === "Document owner") {
    return "pill pill--amber";
  }

  return "pill pill--slate";
}

function formatRelativeDateTime(dateValue?: string | null) {
  if (!dateValue) {
    return null;
  }

  const targetDate = new Date(dateValue);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  const diffMs = Date.now() - targetDate.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.round(diffMs / minuteMs));
    return `${minutes}m ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.round(diffMs / hourMs));
    return `${hours}h ago`;
  }

  const days = Math.max(1, Math.round(diffMs / dayMs));
  return `${days}d ago`;
}

export function NotificationsPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [followUpScope, setFollowUpScope] = useState<FollowUpScope>("ALL");

  const load = async () => {
    const [notificationsResponse, sharedFollowUpsResponse, usersResponse] = await Promise.all([
      authFetch("/notifications/me"),
      authFetch("/notifications/follow-ups/shared"),
      authFetch("/users?page=1&pageSize=100")
    ]);

    if (!notificationsResponse.ok) {
      setItems([]);
    } else {
      setItems(await notificationsResponse.json());
    }

    if (!sharedFollowUpsResponse.ok) {
      setSharedFollowUps([]);
    } else {
      setSharedFollowUps(await sharedFollowUpsResponse.json());
    }

    if (!usersResponse.ok) {
      setAssignableUsers([]);
    } else {
      const usersData = await usersResponse.json();
      setAssignableUsers(usersData.items.filter((item: AssignableUser) => item.isActive));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await authFetch(`/notifications/${id}/read`, {
      method: "PATCH"
    });
    await load();
  };

  const sharedFollowUpsByPrompt = useMemo(
    () =>
      new Map(
        sharedFollowUps
          .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP" && item.metadata?.promptKey)
          .map((item) => [item.metadata?.promptKey as string, item])
      ),
    [sharedFollowUps]
  );

  const followUpPrompts = useMemo(() => {
    const prompts = sharedFollowUps
      .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP")
      .map((item) => ({
        id: item.metadata?.promptKey ?? item.id,
        jobId: item.metadata?.jobId ?? "",
        title: item.title,
        body: item.body,
        severity:
          item.severity === "HIGH" || item.severity === "MEDIUM" ? item.severity : "LOW",
        tone:
          item.severity === "HIGH"
            ? "red"
            : item.severity === "MEDIUM"
              ? "amber"
              : "blue",
        actionLabel: item.metadata?.actionTarget === "documents" ? "Open job documents" : "Open blocked job",
        actionTarget: item.metadata?.actionTarget === "documents" ? "documents" : "job",
        nextOwnerId: item.metadata?.nextOwnerId ?? item.userId,
        nextOwnerLabel: item.metadata?.nextOwnerLabel ?? "Team owner",
        ownerRole: item.metadata?.ownerRole ?? "Follow-up owner",
        audienceLabel:
          item.metadata?.audienceLabel ??
          (item.userId === user?.id ? "Assigned to me" : "Team follow-up"),
        urgencyLabel: item.metadata?.urgencyLabel ?? "Upcoming",
        assignmentMode: item.metadata?.assignmentMode ?? "DERIVED"
      }))
      .sort((left, right) => {
        const triageRank = (prompt: { id: string }) => {
          const triageState = sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.triageState ?? "OPEN";
          if (triageState === "OPEN") return 0;
          if (triageState === "ACKNOWLEDGED") return 1;
          return 2;
        };
        const urgencyRank = (label: FollowUpPrompt["urgencyLabel"]) =>
          label === "Urgent today" ? 0 : label === "Due soon" ? 1 : 2;
        const severityRank = (severity: string) =>
          severity === "HIGH" ? 0 : severity === "MEDIUM" ? 1 : 2;
        const audienceRank = (label: FollowUpPrompt["audienceLabel"]) =>
          label === "Assigned to me" ? 0 : 1;

        return (
          triageRank(left) - triageRank(right) ||
          audienceRank(left.audienceLabel) - audienceRank(right.audienceLabel) ||
          urgencyRank(left.urgencyLabel) - urgencyRank(right.urgencyLabel) ||
          severityRank(left.severity) - severityRank(right.severity)
        );
      });

    if (followUpScope === "MINE") {
      return prompts.filter((prompt) => prompt.audienceLabel === "Assigned to me");
    }

    if (followUpScope === "TEAM") {
      return prompts.filter((prompt) => prompt.audienceLabel === "Team follow-up");
    }

    if (followUpScope === "MANUAL") {
      return prompts.filter((prompt) => prompt.assignmentMode === "MANUAL");
    }

    return prompts;
  }, [followUpScope, sharedFollowUps, sharedFollowUpsByPrompt, user?.id]);

  const promptsByOwner = useMemo(() => {
    const grouped = new Map<string, number>();

    followUpPrompts.forEach((prompt) => {
      grouped.set(prompt.nextOwnerLabel, (grouped.get(prompt.nextOwnerLabel) ?? 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([owner, count]) => ({ owner, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 3);
  }, [followUpPrompts]);

  useEffect(() => {
    setAssignmentDrafts((current) => {
      const next = { ...current };
      for (const item of sharedFollowUps) {
        const promptKey = item.metadata?.promptKey;
        if (promptKey && !next[promptKey]) {
          next[promptKey] = item.metadata?.nextOwnerId ?? item.userId;
        }
      }
      return next;
    });
  }, [sharedFollowUps]);

  const recentTriagedPrompts = useMemo(
    () =>
      sharedFollowUps
        .filter((item) => item.metadata?.triageState && item.metadata.triageState !== "OPEN" && item.metadata?.triagedAt)
        .sort((left, right) => {
          const leftTime = new Date(left.metadata?.triagedAt ?? 0).getTime();
          const rightTime = new Date(right.metadata?.triagedAt ?? 0).getTime();
          return rightTime - leftTime;
        })
        .slice(0, 4),
    [sharedFollowUps]
  );

  const assignedToMeCount = followUpPrompts.filter((prompt) => prompt.audienceLabel === "Assigned to me").length;
  const teamFollowUpCount = followUpPrompts.filter((prompt) => prompt.audienceLabel === "Team follow-up").length;
  const urgentTodayCount = followUpPrompts.filter((prompt) => prompt.urgencyLabel === "Urgent today").length;
  const dueSoonCount = followUpPrompts.filter((prompt) => prompt.urgencyLabel === "Due soon").length;
  const acknowledgedCount = followUpPrompts.filter((prompt) => {
    const item = sharedFollowUpsByPrompt.get(prompt.id);
    return item?.metadata?.triageState === "ACKNOWLEDGED";
  }).length;
  const watchCount = followUpPrompts.filter((prompt) => {
    const item = sharedFollowUpsByPrompt.get(prompt.id);
    return item?.metadata?.triageState === "WATCH";
  }).length;
  const manualAssignmentCount = sharedFollowUps.filter((item) => item.metadata?.assignmentMode === "MANUAL").length;
  const shiftLeadCount = followUpPrompts.filter((prompt) => prompt.ownerRole === "Shift lead").length;
  const activityOwnerCount = followUpPrompts.filter((prompt) => prompt.ownerRole === "Activity owner").length;
  const triagedTodayCount = sharedFollowUps.filter((item) => {
    const triagedAt = item.metadata?.triagedAt;
    if (!triagedAt) return false;
    const triagedDate = new Date(triagedAt);
    const now = new Date();
    return triagedDate.toDateString() === now.toDateString();
  }).length;

  const updatePromptState = async (promptId: string, nextState: FollowUpPromptState) => {
    const sharedItem = sharedFollowUpsByPrompt.get(promptId);
    if (!sharedItem) {
      return;
    }

    await authFetch(`/notifications/follow-ups/${sharedItem.id}/triage`, {
      method: "PATCH",
      body: JSON.stringify({
        triageState: nextState
      })
    });

    const sharedFollowUpsResponse = await authFetch("/notifications/follow-ups/shared");
    if (sharedFollowUpsResponse.ok) {
      setSharedFollowUps(await sharedFollowUpsResponse.json());
    }
  };

  const updatePromptAssignment = async (promptId: string) => {
    const sharedItem = sharedFollowUpsByPrompt.get(promptId);
    const targetUserId = assignmentDrafts[promptId];

    if (!sharedItem || !targetUserId) {
      return;
    }

    const assignee = assignableUsers.find((item) => item.id === targetUserId);
    await authFetch(`/notifications/follow-ups/${sharedItem.id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({
        userId: targetUserId,
        userLabel: assignee ? `${assignee.firstName} ${assignee.lastName}` : undefined
      })
    });

    const sharedFollowUpsResponse = await authFetch("/notifications/follow-ups/shared");
    if (sharedFollowUpsResponse.ok) {
      setSharedFollowUps(await sharedFollowUpsResponse.json());
    }
  };

  const getPromptState = (promptId: string): FollowUpPromptState =>
    sharedFollowUpsByPrompt.get(promptId)?.metadata?.triageState ?? "OPEN";

  const openJob = (jobId: string) => {
    navigate("/jobs", {
      state: {
        jobFocus: {
          jobId,
          from: "notifications"
        }
      }
    });
  };

  const openDocuments = (jobId: string) => {
    navigate("/documents", {
      state: {
        documentFocus: {
          linkedEntityType: "Job",
          linkedEntityId: jobId,
          from: "notifications",
          title: "Focused job documents"
        }
      }
    });
  };

  const unreadCount = items.filter((item) => item.status !== "READ").length;

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title="Operational Follow-ups" subtitle="Live planning prompts surfaced from current job and scheduler state">
          <div className="tab-row">
            {[
              { id: "ALL", label: "All prompts" },
              { id: "MINE", label: "Assigned to me" },
              { id: "TEAM", label: "Team follow-up" },
              { id: "MANUAL", label: "Manual assignments" }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={followUpScope === tab.id ? "tab-button tab-button--active" : "tab-button"}
                onClick={() => setFollowUpScope(tab.id as FollowUpScope)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="tendering-focus-list tendering-focus-list--activity">
            <div className="tendering-focus-list__item">
              <strong>{followUpPrompts.filter((item) => item.severity === "HIGH").length}</strong>
              <span>Blocked prompts</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{followUpPrompts.filter((item) => item.severity === "MEDIUM").length}</strong>
              <span>Warning prompts</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{followUpPrompts.filter((item) => item.severity === "LOW").length}</strong>
              <span>Low-friction prompts</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{assignedToMeCount}</strong>
              <span>Assigned to me</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{teamFollowUpCount}</strong>
              <span>Team follow-up</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{urgentTodayCount}</strong>
              <span>Urgent today</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{dueSoonCount}</strong>
              <span>Due soon</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{acknowledgedCount}</strong>
              <span>I'm handling it</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{watchCount}</strong>
              <span>Watch only</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{manualAssignmentCount}</strong>
              <span>Manual assignments</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{shiftLeadCount}</strong>
              <span>Shift-lead prompts</span>
            </div>
            <div className="tendering-focus-list__item">
              <strong>{activityOwnerCount}</strong>
              <span>Activity-owner prompts</span>
            </div>
          </div>
          <div className="inline-fields">
            {promptsByOwner.map((item) => (
              <span key={item.owner} className="pill pill--slate">
                {item.owner}: {item.count}
              </span>
            ))}
          </div>
          <div className="inline-fields">
            <span className="pill pill--slate">{triagedTodayCount} triaged today</span>
          </div>
          <div className="dashboard-list dashboard-list--capped">
            {followUpPrompts.map((prompt) => (
              <div key={prompt.id} className="tendering-focus-list__item">
                <div className="split-header">
                  <strong>{prompt.title}</strong>
                  <span className={`pill pill--${prompt.tone}`}>{prompt.severity}</span>
                </div>
                <p className="muted-text">{prompt.body}</p>
                <div className="inline-fields">
                  <span className={getUrgencyPillClass(prompt.urgencyLabel)}>{prompt.urgencyLabel}</span>
                  <span className={`pill ${prompt.audienceLabel === "Assigned to me" ? "pill--green" : "pill--slate"}`}>
                    {prompt.audienceLabel}
                  </span>
                  <span className={getOwnerRolePillClass(prompt.ownerRole)}>{prompt.ownerRole}</span>
                  <span className="pill pill--blue">{prompt.nextOwnerLabel}</span>
                  <span
                    className={`pill ${
                      getPromptState(prompt.id) === "ACKNOWLEDGED"
                        ? "pill--green"
                        : getPromptState(prompt.id) === "WATCH"
                          ? "pill--amber"
                          : "pill--slate"
                    }`}
                  >
                    {getPromptState(prompt.id) === "ACKNOWLEDGED"
                      ? "I'm handling it"
                      : getPromptState(prompt.id) === "WATCH"
                        ? "Watch only"
                        : "Open"}
                  </span>
                </div>
                {sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.triageState &&
                sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.triageState !== "OPEN" ? (
                  <p className="muted-text">
                    {sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.triagedByLabel ?? "A team member"}{" "}
                    marked this as{" "}
                    {sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.triageState === "ACKNOWLEDGED"
                      ? "handled"
                      : "watch only"}{" "}
                    {formatRelativeDateTime(sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.triagedAt) ?? "recently"}.
                  </p>
                ) : null}
                {sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.assignmentMode === "MANUAL" ? (
                  <p className="muted-text">
                    Manually assigned to {sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.nextOwnerLabel ?? "team owner"}
                    {sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.assignedByLabel
                      ? ` by ${sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.assignedByLabel}`
                      : ""}
                    {sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.assignedAt
                      ? ` ${formatRelativeDateTime(sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.assignedAt) ?? ""}`
                      : ""}.
                  </p>
                ) : (
                  <p className="muted-text">
                    Routed to the current {prompt.ownerRole.toLowerCase()} so the execution owner can pick this up without a separate handoff.
                  </p>
                )}
                <div className="inline-fields">
                  <button
                    type="button"
                    onClick={() =>
                      prompt.actionTarget === "documents" ? openDocuments(prompt.jobId) : openJob(prompt.jobId)
                    }
                  >
                    {prompt.actionLabel}
                  </button>
                  <button type="button" onClick={() => updatePromptState(prompt.id, "ACKNOWLEDGED")}>
                    I'm handling this
                  </button>
                  <button type="button" onClick={() => updatePromptState(prompt.id, "WATCH")}>
                    Watch only
                  </button>
                  {getPromptState(prompt.id) !== "OPEN" ? (
                    <button type="button" onClick={() => updatePromptState(prompt.id, "OPEN")}>
                      Reset
                    </button>
                  ) : null}
                </div>
                <div className="inline-fields">
                  <select
                    value={assignmentDrafts[prompt.id] ?? sharedFollowUpsByPrompt.get(prompt.id)?.metadata?.nextOwnerId ?? ""}
                    onChange={(event) =>
                      setAssignmentDrafts((current) => ({
                        ...current,
                        [prompt.id]: event.target.value
                      }))
                    }
                  >
                    {assignableUsers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => updatePromptAssignment(prompt.id)}>
                    Reassign owner
                  </button>
                </div>
              </div>
            ))}
            {!followUpPrompts.length ? (
              <p className="muted-text">No live planning prompts are surfacing right now.</p>
            ) : null}
          </div>
          {recentTriagedPrompts.length ? (
            <div className="subsection">
              <h4>Recent triage activity</h4>
              <div className="dashboard-list dashboard-list--capped">
                {recentTriagedPrompts.map((item) => (
                  <div key={item.id} className="tendering-focus-list__item">
                    <strong>{item.title}</strong>
                    <p className="muted-text">
                      {(item.metadata?.triagedByLabel ?? "A team member")} set this to{" "}
                      {item.metadata?.triageState === "ACKNOWLEDGED" ? "I'm handling it" : "Watch only"}{" "}
                      {formatRelativeDateTime(item.metadata?.triagedAt) ?? "recently"}.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Notification Inbox" subtitle="Platform notifications plus shared read-state handling">
          <div className="subsection">
            <div className="inline-fields">
              <span className="pill pill--blue">{items.length} total notifications</span>
              <span className={`pill ${unreadCount ? "pill--amber" : "pill--green"}`}>
                {unreadCount} unread
              </span>
            </div>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Body</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => markRead(item.id)}>
                    <td>{item.title}</td>
                    <td>{item.body}</td>
                    <td>
                      <span className={getSeverityPill(item.severity)}>{item.severity}</span>
                    </td>
                    <td>
                      <span className={item.status === "READ" ? "pill pill--green" : "pill pill--amber"}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length ? (
              <p className="muted-text">No platform notifications yet. Live planning prompts are still available in the follow-up rail.</p>
            ) : null}
          </div>
        </AppCard>
      </div>
    </div>
  );
}
