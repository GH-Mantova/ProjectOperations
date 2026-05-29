import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

export type TenderEntryType =
  | "note"
  | "rfi"
  | "email"
  | "call"
  | "meeting"
  | "follow_up"
  | "self_reminder"
  | "task";

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

type FilterChip = "all" | "notes" | "correspondence" | "followups" | "mytasks";

const CORRESPONDENCE_TYPES: ReadonlySet<TenderEntryType> = new Set([
  "rfi",
  "email",
  "call",
  "meeting"
]);
const FOLLOWUP_TYPES: ReadonlySet<TenderEntryType> = new Set([
  "follow_up",
  "self_reminder"
]);

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

function matchesChip(entry: TenderEntry, chip: FilterChip, currentUserId: string | null): boolean {
  switch (chip) {
    case "all":
      return true;
    case "notes":
      return entry.type === "note";
    case "correspondence":
      return CORRESPONDENCE_TYPES.has(entry.type);
    case "followups":
      return FOLLOWUP_TYPES.has(entry.type);
    case "mytasks":
      return entry.type === "task" && !!currentUserId && entry.assigneeId === currentUserId;
    default:
      return true;
  }
}

function readStoredView(): "feed" | "tabs" {
  if (typeof window === "undefined") return "feed";
  const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return raw === "tabs" ? "tabs" : "feed";
}

export function TenderEntriesPanel({ tenderId }: { tenderId: string }) {
  const { authFetch, user } = useAuth();
  const [entries, setEntries] = useState<TenderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chip, setChip] = useState<FilterChip>("all");
  const [view, setView] = useState<"feed" | "tabs">(() => readStoredView());
  const [tabsActive, setTabsActive] = useState<FilterChip>("notes");
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/entries`);
      if (!response.ok) throw new Error(await response.text());
      setEntries((await response.json()) as TenderEntry[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const currentUserId = user?.id ?? null;

  const filteredFeed = useMemo(
    () => entries.filter((entry) => matchesChip(entry, chip, currentUserId)),
    [entries, chip, currentUserId]
  );

  const tabsEntries = useMemo(
    () => entries.filter((entry) => matchesChip(entry, tabsActive, currentUserId)),
    [entries, tabsActive, currentUserId]
  );

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
            disabled
            title="Coming in Phase 6"
          >
            + Add entry
          </button>
        </div>
      </div>

      {error ? (
        <p style={{ color: "#C0392B", marginTop: 12 }}>{error}</p>
      ) : null}

      {view === "feed" ? (
        <>
          <FilterChips active={chip} onChange={setChip} />
          {renderList({
            loading,
            entries: filteredFeed,
            statusBusyId,
            onToggleStatus: toggleStatus
          })}
        </>
      ) : (
        <>
          <TabStrip active={tabsActive} onChange={setTabsActive} />
          {renderList({
            loading,
            entries: tabsEntries,
            statusBusyId,
            onToggleStatus: toggleStatus
          })}
        </>
      )}
    </section>
  );
}

function renderList({
  loading,
  entries,
  statusBusyId,
  onToggleStatus
}: {
  loading: boolean;
  entries: TenderEntry[];
  statusBusyId: string | null;
  onToggleStatus: (entry: TenderEntry) => void;
}) {
  if (loading) {
    return <p style={{ marginTop: 12, color: "#6B7280" }}>Loading…</p>;
  }
  if (entries.length === 0) {
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
        margin: "12px 0 0",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      {entries.map((entry) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          busy={statusBusyId === entry.id}
          onToggleStatus={() => onToggleStatus(entry)}
        />
      ))}
    </ul>
  );
}

function EntryRow({
  entry,
  busy,
  onToggleStatus
}: {
  entry: TenderEntry;
  busy: boolean;
  onToggleStatus: () => void;
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
        <span style={{ fontSize: 12, color: "#6B7280" }}>{formatDateTime(entry.createdAt)}</span>
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
