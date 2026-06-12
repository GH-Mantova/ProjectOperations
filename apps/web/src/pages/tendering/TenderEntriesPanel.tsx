import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { CenteredModal, EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { requiresAssignee, requiresDueDate } from "./addEntryFieldVisibility";
import type { FilterChip, TenderEntryType } from "./tenderEntriesFilters";
import {
  buildCommCreateBody,
  clientEntryCounts,
  commEntriesPath,
  feedSubtitle,
  isCommType,
  mergeFeed,
  performDeleteFeedItem,
  visibleFeed,
  type CommEntry,
  type FeedItem
} from "./activityClientFilter";
import { ClientDetailDrawer, isPrimaryClient, PrimaryTag, type ActivityClient } from "./ClientDetailDrawer";
import { ClientStarRating } from "../../components/ClientStarRating";

export type { TenderEntryType } from "./tenderEntriesFilters";
export type { ActivityClient } from "./ClientDetailDrawer";

export type TenderEntryStatus = "open" | "done" | "cancelled";

export type TenderEntry = {
  id: string;
  tenderId: string;
  type: TenderEntryType;
  subject: string | null;
  body: string;
  dueDate: string | null;
  status: TenderEntryStatus;
  assigneeId: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; firstName: string; lastName: string } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
};

const TYPE_LABEL: Record<TenderEntryType, string> = {
  note: "Note",
  rfi: "RFI",
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  follow_up: "Follow-up",
  self_reminder: "Reminder",
  task: "Task"
};

const TYPE_PALETTE: Record<TenderEntryType, string> = {
  note: "#95A5A6",
  rfi: "#005B61",
  email: "#8E44AD",
  call: "#3498DB",
  meeting: "#F39C12",
  follow_up: "#27AE60",
  self_reminder: "#D35400",
  task: "#C0392B"
};

const COMM_PALETTE: Record<string, string> = {
  note: "#95A5A6",
  email: "#8E44AD",
  call: "#3498DB",
  meeting: "#F39C12",
  response: "#005B61"
};

const COMM_LABEL: Record<string, string> = {
  note: "Note",
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  response: "Response"
};

const TABS_GROUP_ORDER: Array<{ key: FilterChip; label: string }> = [
  { key: "notes", label: "Notes" },
  { key: "correspondence", label: "Correspondence" },
  { key: "followups", label: "Follow-ups" },
  { key: "mytasks", label: "Tasks" }
];

const VIEW_STORAGE_KEY = "tenderEntriesView";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function formatPerson(person: { firstName: string; lastName: string } | null): string {
  if (!person) return "";
  return `${person.firstName} ${person.lastName}`.trim();
}

function readStoredView(): "feed" | "tabs" {
  if (typeof window === "undefined") return "feed";
  const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return raw === "tabs" ? "tabs" : "feed";
}

type AssignableUser = { id: string; firstName: string; lastName: string };

type DraftEntry = {
  type: TenderEntryType;
  subject: string;
  body: string;
  dueDate: string;
  assigneeId: string;
  clientId: string;
};

const EMPTY_DRAFT: DraftEntry = {
  type: "note",
  subject: "",
  body: "",
  dueDate: "",
  assigneeId: "",
  clientId: ""
};

export function TenderEntriesPanel({
  tenderId,
  clients = [],
  canManage = false,
  canRemoveClients = false,
  onAddClient,
  onScoreChange,
  onRemoveClient
}: {
  tenderId: string;
  clients?: ActivityClient[];
  canManage?: boolean;
  canRemoveClients?: boolean;
  onAddClient?: () => void;
  onScoreChange?: (clientId: string, score: number) => void;
  onRemoveClient?: (clientId: string) => void;
}) {
  const { authFetch, user } = useAuth();
  const [entries, setEntries] = useState<TenderEntry[]>([]);
  const [comms, setComms] = useState<CommEntry[]>([]);
  const [filteredComms, setFilteredComms] = useState<CommEntry[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [drawerClientId, setDrawerClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chip, setChip] = useState<FilterChip>("all");
  const [view, setView] = useState<"feed" | "tabs">(() => readStoredView());
  const [tabsActive, setTabsActive] = useState<FilterChip>("notes");
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<DraftEntry>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FeedItem<TenderEntry> | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesRes, commsRes] = await Promise.all([
        authFetch(`/tenders/${tenderId}/entries`),
        authFetch(commEntriesPath(tenderId))
      ]);
      if (!entriesRes.ok) throw new Error(await entriesRes.text());
      if (!commsRes.ok) throw new Error(await commsRes.text());
      setEntries((await entriesRes.json()) as TenderEntry[]);
      setComms((await commsRes.json()) as CommEntry[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Server-side client filter (PR-63a): refetch comm entries scoped to the
  // selected client rather than filtering the already-loaded list.
  useEffect(() => {
    if (selectedClientId === null) {
      setFilteredComms([]);
      return;
    }
    let cancelled = false;
    setFilterLoading(true);
    (async () => {
      try {
        const response = await authFetch(commEntriesPath(tenderId, selectedClientId));
        if (!response.ok) throw new Error(await response.text());
        const body = (await response.json()) as CommEntry[];
        if (!cancelled) setFilteredComms(body);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setFilterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, tenderId, selectedClientId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const currentUserId = user?.id ?? null;
  const activeChip = view === "feed" ? chip : tabsActive;

  const feed = useMemo(
    () =>
      selectedClientId === null
        ? mergeFeed(entries, comms)
        : mergeFeed([] as TenderEntry[], filteredComms),
    [entries, comms, filteredComms, selectedClientId]
  );

  const visible = useMemo(
    () => visibleFeed(feed, { chip: activeChip, currentUserId, selectedClientId }),
    [feed, activeChip, currentUserId, selectedClientId]
  );

  const counts = useMemo(() => clientEntryCounts(comms), [comms]);
  const allCount = entries.length + comms.length;
  const selectedClient = clients.find((c) => c.clientId === selectedClientId) ?? null;
  const drawerClient = clients.find((c) => c.clientId === drawerClientId) ?? null;

  const ensureUsersLoaded = useCallback(async () => {
    if (usersLoaded) return;
    try {
      const response = await authFetch("/users?page=1&pageSize=100");
      if (!response.ok) return;
      const body = (await response.json()) as {
        items: Array<{ id: string; firstName: string; lastName: string; isActive: boolean }>;
      };
      setUsers(
        body.items
          .filter((u) => u.isActive)
          .map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName }))
      );
      setUsersLoaded(true);
    } catch {
      // Non-fatal — assignee picker just stays empty until reopened.
    }
  }, [authFetch, usersLoaded]);

  const openAdd = useCallback(
    (preselectedClientId?: string) => {
      setDraft({ ...EMPTY_DRAFT, clientId: preselectedClientId ?? "" });
      setAddOpen(true);
      void ensureUsersLoaded();
    },
    [ensureUsersLoaded]
  );

  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setDraft(EMPTY_DRAFT);
  }, []);

  const submitAdd = useCallback(async () => {
    if (!draft.body.trim()) {
      setError("Body is required.");
      return;
    }

    // Client-linked entries are stored as comm entries (clarification notes)
    // so the sidebar's per-client filter and counts pick them up.
    if (draft.clientId && isCommType(draft.type)) {
      setSubmitting(true);
      setError(null);
      try {
        const response = await authFetch(commEntriesPath(tenderId), {
          method: "POST",
          body: JSON.stringify(
            buildCommCreateBody({
              type: draft.type,
              subject: draft.subject,
              body: draft.body,
              clientId: draft.clientId
            })
          )
        });
        if (!response.ok) throw new Error(await response.text());
        const created = (await response.json()) as CommEntry;
        setComms((current) => [created, ...current]);
        if (selectedClientId === draft.clientId) {
          setFilteredComms((current) => [created, ...current]);
        }
        closeAdd();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (requiresDueDate(draft.type) && !draft.dueDate) {
      setError("This entry type needs a due date.");
      return;
    }
    if (requiresAssignee(draft.type) && !draft.assigneeId) {
      setError("Tasks must be assigned to a user.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: TenderEntry = {
      id: optimisticId,
      tenderId,
      type: draft.type,
      subject: draft.subject.trim() || null,
      body: draft.body.trim(),
      dueDate: draft.dueDate || null,
      status: "open",
      assigneeId: draft.assigneeId || null,
      authorId: user?.id ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: user
        ? { id: user.id, firstName: user.firstName, lastName: user.lastName }
        : null,
      assignee:
        draft.assigneeId && users.find((u) => u.id === draft.assigneeId)
          ? (users.find((u) => u.id === draft.assigneeId) as AssignableUser)
          : null
    };
    setEntries((current) => [optimistic, ...current]);
    try {
      const response = await authFetch(`/tenders/${tenderId}/entries`, {
        method: "POST",
        body: JSON.stringify({
          type: draft.type,
          subject: draft.subject.trim() || undefined,
          body: draft.body.trim(),
          dueDate: draft.dueDate || undefined,
          assigneeId: draft.assigneeId || undefined
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const created = (await response.json()) as TenderEntry;
      setEntries((current) => current.map((row) => (row.id === optimisticId ? created : row)));
      closeAdd();
    } catch (err) {
      setEntries((current) => current.filter((row) => row.id !== optimisticId));
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [authFetch, closeAdd, draft, selectedClientId, tenderId, user, users]);

  const toggleStatus = useCallback(
    async (entry: TenderEntry) => {
      const nextStatus: TenderEntryStatus = entry.status === "open" ? "done" : "open";
      setStatusBusyId(entry.id);
      try {
        const response = await authFetch(`/tenders/${tenderId}/entries/${entry.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus })
        });
        if (!response.ok) throw new Error(await response.text());
        const updated = (await response.json()) as TenderEntry;
        setEntries((current) =>
          current.map((row) => (row.id === entry.id ? { ...row, ...updated } : row))
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setStatusBusyId(null);
      }
    },
    [authFetch, tenderId]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    // Optimistic removal — restore on failure.
    if (target.kind === "comm") {
      setComms((current) => current.filter((c) => c.id !== target.id));
      setFilteredComms((current) => current.filter((c) => c.id !== target.id));
    } else {
      setEntries((current) => current.filter((e) => e.id !== target.id));
    }
    setDeleteTarget(null);
    try {
      await performDeleteFeedItem(authFetch, tenderId, target);
      showToast("Entry deleted.");
    } catch (err) {
      if (target.kind === "comm") {
        setComms((current) => [target.comm, ...current]);
        if (selectedClientId && target.comm.clientId === selectedClientId) {
          setFilteredComms((current) => [target.comm, ...current]);
        }
      } else {
        setEntries((current) => [target.entry, ...current]);
      }
      showToast(`Delete failed: ${(err as Error).message}`);
    } finally {
      setDeleteBusy(false);
    }
  }, [authFetch, deleteTarget, selectedClientId, showToast, tenderId]);

  const deleteLabel =
    deleteTarget?.kind === "comm"
      ? (COMM_LABEL[deleteTarget.comm.noteType] ?? "comm").toLowerCase()
      : deleteTarget
        ? TYPE_LABEL[deleteTarget.entry.type].toLowerCase()
        : "";

  const list = (items: Array<FeedItem<TenderEntry>>) =>
    renderList({
      loading: loading || filterLoading,
      items,
      clients,
      statusBusyId,
      canManage,
      onToggleStatus: toggleStatus,
      onDelete: (item) => setDeleteTarget(item)
    });

  return (
    <section className="s7-card" data-testid="tender-entries-panel">
      <div
        className="tender-detail__section-head"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Activity &amp; communications
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ViewToggle view={view} onChange={setView} />
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => openAdd(selectedClientId ?? undefined)}
          >
            + Add entry
          </button>
        </div>
      </div>

      {error ? (
        <p style={{ color: "#C0392B", marginTop: 12 }}>{error}</p>
      ) : null}

      {view === "feed" ? (
        <FilterChips active={chip} onChange={setChip} />
      ) : (
        <TabStrip active={tabsActive} onChange={setTabsActive} />
      )}

      <div
        className="tender-entries__layout"
        style={{
          display: "grid",
          gridTemplateColumns: "200px minmax(0, 1fr)",
          gap: 16,
          marginTop: 12,
          alignItems: "start"
        }}
      >
        <ClientFilterSidebar
          clients={clients}
          counts={counts}
          allCount={allCount}
          selectedClientId={selectedClientId}
          canManage={canManage}
          onSelect={setSelectedClientId}
          onInfo={setDrawerClientId}
          onAddClient={onAddClient}
        />
        <div>
          <p
            data-testid="tender-entries-subtitle"
            style={{ margin: "0 0 8px", fontSize: 12, color: "#6B7280" }}
          >
            {feedSubtitle(visible.length, selectedClient?.name ?? null)}
          </p>
          {list(visible)}
        </div>
      </div>

      {addOpen ? (
        <AddEntryModal
          draft={draft}
          users={users}
          clients={clients}
          submitting={submitting}
          onChange={setDraft}
          onCancel={closeAdd}
          onSubmit={submitAdd}
        />
      ) : null}

      {deleteTarget ? (
        <CenteredModal
          title="Delete entry"
          subtitle={`Delete this ${deleteLabel} entry? This cannot be undone.`}
          onClose={() => setDeleteTarget(null)}
          busy={deleteBusy}
          dataTestId="delete-entry-confirm"
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                style={{ background: "var(--status-danger, #C0392B)" }}
                onClick={() => void confirmDelete()}
                disabled={deleteBusy}
              >
                Delete
              </button>
            </>
          }
        >
          <span />
        </CenteredModal>
      ) : null}

      {drawerClient ? (
        <ClientDetailDrawer
          client={drawerClient}
          canManage={canManage}
          canRemove={canRemoveClients}
          onClose={() => setDrawerClientId(null)}
          onScoreChange={(score) => onScoreChange?.(drawerClient.clientId, score)}
          onLogInteraction={() => {
            setDrawerClientId(null);
            openAdd(drawerClient.clientId);
          }}
          onRemove={() => {
            setDrawerClientId(null);
            onRemoveClient?.(drawerClient.clientId);
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1F2937",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 1100,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)"
          }}
        >
          {toast}
        </div>
      ) : null}
    </section>
  );
}

function ClientFilterSidebar({
  clients,
  counts,
  allCount,
  selectedClientId,
  canManage,
  onSelect,
  onInfo,
  onAddClient
}: {
  clients: ActivityClient[];
  counts: Record<string, number>;
  allCount: number;
  selectedClientId: string | null;
  canManage: boolean;
  onSelect: (clientId: string | null) => void;
  onInfo: (clientId: string) => void;
  onAddClient?: () => void;
}) {
  return (
    <aside data-testid="client-filter-sidebar">
      <p className="s7-type-label" style={{ margin: "0 0 6px", textTransform: "uppercase", fontSize: 11 }}>
        Filter by client
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-pressed={selectedClientId === null}
            style={sidebarRowStyle(selectedClientId === null)}
          >
            <ListIcon />
            <span style={{ flex: 1, textAlign: "left" }}>All clients</span>
            <CountBadge count={allCount} />
          </button>
        </li>
        {clients.map((client) => {
          const isSelected = selectedClientId === client.clientId;
          return (
            <li key={client.clientId} style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
              <button
                type="button"
                onClick={() => onSelect(client.clientId)}
                aria-pressed={isSelected}
                title={client.name}
                style={{ ...sidebarRowStyle(isSelected), flex: 1, minWidth: 0 }}
              >
                {isPrimaryClient(client) ? <PrimaryTag /> : null}
                <ClientStarRating
                  score={client.preferenceScore}
                  readOnly
                  size="sm"
                  ariaLabel={`${client.name} preference`}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {client.name}
                </span>
                <CountBadge count={counts[client.clientId] ?? 0} />
              </button>
              <button
                type="button"
                aria-label={`${client.name} details`}
                title={`${client.name} details`}
                onClick={(event) => {
                  event.stopPropagation();
                  onInfo(client.clientId);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#6B7280",
                  padding: "0 4px",
                  display: "flex",
                  alignItems: "center",
                  minWidth: 24
                }}
              >
                <InfoIcon />
              </button>
            </li>
          );
        })}
      </ul>
      {canManage && onAddClient ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onAddClient}
          style={{ marginTop: 8, fontSize: 12 }}
        >
          + Add client
        </button>
      ) : null}
    </aside>
  );
}

function sidebarRowStyle(selected: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
    border: selected ? "1px solid #2563EB" : "1px solid transparent",
    background: selected ? "#fff" : "var(--surface-secondary, #F3F4F6)",
    color: selected ? "var(--text-primary, #111827)" : "#6B7280",
    fontWeight: selected ? 500 : 400
  };
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        background: "#E5E7EB",
        color: "#374151",
        borderRadius: 999,
        padding: "0 6px",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: "16px"
      }}
    >
      {count}
    </span>
  );
}

function ListIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12" y2="8.01" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "#9CA3AF",
        padding: 4,
        display: "flex",
        alignItems: "center"
      }}
    >
      <TrashIcon />
    </button>
  );
}

function renderList({
  loading,
  items,
  clients,
  statusBusyId,
  canManage,
  onToggleStatus,
  onDelete
}: {
  loading: boolean;
  items: Array<FeedItem<TenderEntry>>;
  clients: ActivityClient[];
  statusBusyId: string | null;
  canManage: boolean;
  onToggleStatus: (entry: TenderEntry) => void;
  onDelete: (item: FeedItem<TenderEntry>) => void;
}) {
  if (loading) {
    return <p style={{ marginTop: 12, color: "#6B7280" }}>Loading…</p>;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        heading="No entries"
        subtext="Nothing matches the current filter yet."
      />
    );
  }
  return (
    <ul
      className="tender-entries"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      {items.map((item) =>
        item.kind === "entry" ? (
          <EntryRow
            key={`entry-${item.id}`}
            entry={item.entry}
            busy={statusBusyId === item.id}
            canDelete={canManage}
            onToggleStatus={() => onToggleStatus(item.entry)}
            onDelete={() => onDelete(item)}
          />
        ) : (
          <CommRow
            key={`comm-${item.id}`}
            comm={item.comm}
            clientName={clients.find((c) => c.clientId === item.comm.clientId)?.name ?? null}
            canDelete={canManage}
            onDelete={() => onDelete(item)}
          />
        )
      )}
    </ul>
  );
}

function EntryRow({
  entry,
  busy,
  canDelete,
  onToggleStatus,
  onDelete
}: {
  entry: TenderEntry;
  busy: boolean;
  canDelete: boolean;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const palette = TYPE_PALETTE[entry.type];
  const hasStatusControls = entry.type === "task" || entry.type === "follow_up" || entry.type === "self_reminder";
  return (
    <li
      className="tender-entries__item"
      data-testid="tender-entry-row"
      style={{
        borderLeft: `4px solid ${palette}`,
        background: "var(--surface-card, #fff)",
        padding: "10px 12px",
        borderRadius: 6,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              background: palette,
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em"
            }}
          >
            {TYPE_LABEL[entry.type]}
          </span>
          {entry.subject ? <strong style={{ fontSize: 14 }}>{entry.subject}</strong> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>{formatDateTime(entry.createdAt)}</span>
          {canDelete ? <DeleteButton label="Delete entry" onClick={onDelete} /> : null}
        </div>
      </div>
      <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{entry.body}</p>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          fontSize: 12,
          color: "#6B7280"
        }}
      >
        {entry.author ? <span>— {formatPerson(entry.author)}</span> : null}
        {entry.assignee ? (
          <span
            style={{
              background: "#EEF2FF",
              color: "#3730A3",
              padding: "2px 8px",
              borderRadius: 999
            }}
          >
            → {formatPerson(entry.assignee)}
          </span>
        ) : null}
        {entry.dueDate ? (
          <span
            style={{
              background: "#FEF3C7",
              color: "#92400E",
              padding: "2px 8px",
              borderRadius: 999
            }}
          >
            Due {formatDate(entry.dueDate)}
          </span>
        ) : null}
        {hasStatusControls ? (
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={busy || entry.status === "cancelled"}
            style={{
              border: "none",
              cursor: busy ? "wait" : "pointer",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 12,
              background: entry.status === "done" ? "#D1FAE5" : "#E0E7FF",
              color: entry.status === "done" ? "#065F46" : "#3730A3"
            }}
          >
            {entry.status === "done" ? "Done" : entry.status === "cancelled" ? "Cancelled" : "Open"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function CommRow({
  comm,
  clientName,
  canDelete,
  onDelete
}: {
  comm: CommEntry;
  clientName: string | null;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const palette = COMM_PALETTE[comm.noteType] ?? "#95A5A6";
  return (
    <li
      className="tender-entries__item"
      data-testid="tender-comm-row"
      style={{
        borderLeft: `4px solid ${palette}`,
        background: "var(--surface-card, #fff)",
        padding: "10px 12px",
        borderRadius: 6,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              background: palette,
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em"
            }}
          >
            {COMM_LABEL[comm.noteType] ?? comm.noteType}
          </span>
          {clientName ? (
            <span
              style={{
                background: "#DBEAFE",
                color: "#1E40AF",
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 11
              }}
            >
              {clientName}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>{formatDateTime(comm.occurredAt)}</span>
          {canDelete ? <DeleteButton label="Delete entry" onClick={onDelete} /> : null}
        </div>
      </div>
      <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{comm.text}</p>
      <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280", display: "flex", gap: 8 }}>
        {comm.createdBy ? <span>— {formatPerson(comm.createdBy)}</span> : null}
        <span style={{ textTransform: "capitalize" }}>{comm.direction}</span>
      </div>
    </li>
  );
}

function FilterChips({
  active,
  onChange
}: {
  active: FilterChip;
  onChange: (next: FilterChip) => void;
}) {
  const chips: Array<{ key: FilterChip; label: string }> = [
    { key: "all", label: "All" },
    { key: "notes", label: "Notes" },
    { key: "correspondence", label: "Correspondence" },
    { key: "followups", label: "Follow-ups" },
    { key: "mytasks", label: "My Tasks" }
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter entries"
      style={{
        display: "flex",
        gap: 6,
        marginTop: 12,
        flexWrap: "wrap"
      }}
    >
      {chips.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(c.key)}
            style={{
              border: `1px solid ${isActive ? "#005B61" : "#D1D5DB"}`,
              background: isActive ? "#005B61" : "transparent",
              color: isActive ? "#fff" : "#374151",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function TabStrip({
  active,
  onChange
}: {
  active: FilterChip;
  onChange: (next: FilterChip) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Entry tabs"
      style={{
        display: "flex",
        gap: 0,
        marginTop: 12,
        borderBottom: "1px solid #E5E7EB"
      }}
    >
      {TABS_GROUP_ORDER.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            style={{
              border: "none",
              background: "transparent",
              padding: "8px 14px",
              borderBottom: `2px solid ${isActive ? "#005B61" : "transparent"}`,
              color: isActive ? "#005B61" : "#374151",
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer"
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function AddEntryModal({
  draft,
  users,
  clients,
  submitting,
  onChange,
  onCancel,
  onSubmit
}: {
  draft: DraftEntry;
  users: AssignableUser[];
  clients: ActivityClient[];
  submitting: boolean;
  onChange: (next: DraftEntry) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const clientLinked = !!draft.clientId && isCommType(draft.type);
  const needsDueDate = !clientLinked && requiresDueDate(draft.type);
  const needsAssignee = !clientLinked && requiresAssignee(draft.type);
  const bodyValid = draft.body.trim().length > 0;
  const dueDateValid = !needsDueDate || !!draft.dueDate;
  const assigneeValid = !needsAssignee || !!draft.assigneeId;
  const canSubmit = !submitting && bodyValid && dueDateValid && assigneeValid;

  return (
    <CenteredModal
      title="New entry"
      onClose={onCancel}
      busy={submitting}
      maxWidth={520}
      footer={
        <>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            disabled={!canSubmit}
            onClick={() => {
              if (canSubmit) onSubmit();
            }}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span>Type</span>
          <select
            className="s7-select"
            value={draft.type}
            onChange={(event) => {
              const nextType = event.target.value as TenderEntryType;
              onChange({
                ...draft,
                type: nextType,
                dueDate: requiresDueDate(nextType) ? draft.dueDate : "",
                assigneeId: requiresAssignee(nextType) ? draft.assigneeId : "",
                clientId: isCommType(nextType) ? draft.clientId : ""
              });
            }}
          >
            <option value="note">Note</option>
            <option value="rfi">RFI</option>
            <option value="email">Email</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="follow_up">Follow-up</option>
            <option value="self_reminder">Self-reminder</option>
            <option value="task">Task</option>
          </select>
        </label>

        {isCommType(draft.type) && clients.length > 0 ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span>Client (optional)</span>
            <select
              className="s7-select"
              value={draft.clientId}
              onChange={(event) => onChange({ ...draft, clientId: event.target.value })}
            >
              <option value="">No client link</option>
              {clients.map((client) => (
                <option key={client.clientId} value={client.clientId}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span>Subject (optional)</span>
          <input
            className="s7-input"
            value={draft.subject}
            onChange={(event) => onChange({ ...draft, subject: event.target.value })}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span>Body</span>
          <textarea
            className="s7-input"
            rows={4}
            required
            value={draft.body}
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
          />
        </label>

        {needsDueDate ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span>Due date</span>
            <input
              className="s7-input"
              type="date"
              required
              value={draft.dueDate}
              onChange={(event) => onChange({ ...draft, dueDate: event.target.value })}
            />
          </label>
        ) : null}

        {needsAssignee ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span>Assignee</span>
            <select
              className="s7-select"
              required
              value={draft.assigneeId}
              onChange={(event) => onChange({ ...draft, assigneeId: event.target.value })}
            >
              <option value="">Select a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </form>
    </CenteredModal>
  );
}

function ViewToggle({
  view,
  onChange
}: {
  view: "feed" | "tabs";
  onChange: (next: "feed" | "tabs") => void;
}) {
  const options: Array<{ key: "feed" | "tabs"; label: string }> = [
    { key: "feed", label: "Feed" },
    { key: "tabs", label: "Tabs" }
  ];
  return (
    <div
      role="group"
      aria-label="View"
      style={{
        display: "inline-flex",
        border: "1px solid #D1D5DB",
        borderRadius: 999,
        overflow: "hidden"
      }}
    >
      {options.map((o) => {
        const isActive = view === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            style={{
              border: "none",
              padding: "4px 12px",
              fontSize: 12,
              cursor: "pointer",
              background: isActive ? "#005B61" : "transparent",
              color: isActive ? "#fff" : "#374151"
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
