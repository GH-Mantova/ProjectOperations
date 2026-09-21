import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { readApiErrorMessage } from "../../lib/api-errors";
import { entityLabel, sortThreadsByActivity } from "./comms-inbox.helpers";
import { AnchorPicker, buildCreateThreadBody, mapTypeToServer, type PickerSelection } from "./AnchorPicker";
import { CommsInboxTriage } from "./CommsInboxTriage";
import "./crm.css";

/**
 * CRM_PARITY_THREADS_V1 (crmvis-s8): Threads tab, To-dos tab and the rail
 * rebuilt on the s7 kit. Every hex literal replaced with CSS custom properties
 * via crm-thread-row / crm-todo-row classes (crm.css) and s7-badge / s7-btn
 * kit classes. RAIL_INK and the STATUS_COLOUR-derived palette are removed.
 */
export const CRM_PARITY_THREADS_V1 = "crmvis-s8";

/**
 * CRM_COMMS_RAIL_V1 (2026-09-04): the unanchored Threads screen is two
 * columns, not one — the thread list on the left, a 400px right rail on the
 * right holding "Add a to-do" and a tickable "My to-dos". Before this slice a
 * to-do could only be created from inside an anchored thread (createTask
 * returns early unless `anchored`), the To-dos rows were read-only status
 * badges, and a thread row carried a subject and a date and nothing that said
 * what the conversation was about.
 *
 * The rail belongs to the Threads tab only. The Inbox tab stays full width
 * (the mock-up's Intake artboard is a full-width list with no rail).
 */

/**
 * CRM UIFIX S1 (2026-09-01): the unanchored inbox's tab is CONTROLLED from
 * the outer CommsPage (?tab=inbox|threads|todos). This is the single source of
 * truth for which tab renders — CommsInboxPage no longer keeps its own state
 * or draws its own tab buttons. Two tab bars (outer nav shell + inner) used to
 * render on /crm/comms; the outer advertised an S10-empty-state stub while S10
 * was already shipped in the inner. One tab bar per page.
 */
export type CommsInnerTab = "inbox" | "threads" | "tasks";

export type CommsHubPageProps = {
  /**
   * Which unanchored inbox tab is active. Ignored in anchored mode (entityType
   * + entityId query string). Optional so existing callers stay working.
   */
  activeInnerTab?: CommsInnerTab;
};

// CRM-4: Comms hub surface — internal threads + To-Do.
// Anchored to a CRM record via ?entityType=ACCOUNT|TENDER|JOB|CONTRACT&entityId=…
// The decoupled sub-module surfaces two tabs (threads + tasks) so it can
// later lift into its own product without a UI rewrite. Email integration
// is CRM-5 and lives out-of-scope for this slice.
//
// CRM-4 / NAV-4 reconciliation: ShellLayout wires /crm/comms with no query
// string; this page now renders an unanchored inbox when entityId is absent.
// The anchored path (from a record detail page) is unchanged.

type ActorLite = { id: string; firstName: string; lastName: string };

type Thread = {
  id: string;
  entityType: string;
  entityId: string;
  subject: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  createdBy: ActorLite | null;
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  author: ActorLite | null;
  mentions: string[] | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  entityType: string;
  entityId: string;
  assignee: ActorLite | null;
  createdBy: ActorLite | null;
};

type ThreadDetail = Thread & { messages: Message[]; tasks: Task[] };

const ENTITY_LABEL: Record<string, string> = {
  ACCOUNT: "Account",
  TENDER: "Tender",
  JOB: "Job",
  CONTRACT: "Contract"
};

const STATUS_LABEL: Record<Task["status"], string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

/**
 * CRM_COMMS_RAIL_V1 layout contract, taken straight from the approved
 * mock-up's `Comms.dc.html` artboard ("Comms hub · Threads"):
 * `display: grid; grid-template-columns: 1fr 400px; gap: 16px`.
 * Exported so the unit suite can pin the rail width without a DOM.
 */
export const CRM_COMMS_RAIL_V1 = {
  /** Thread list takes the free column; the rail is a fixed 400px. */
  GRID_TEMPLATE: "1fr 400px",
  /** Gap between the two columns, and between the rail's two cards. */
  GAP: 16,
  /** A to-do inside this many days reads as "Due in N days" rather than a date. */
  DUE_SOON_DAYS: 7
} as const;

// Layout-only inline styles — no colour values.
const layout: Record<string, React.CSSProperties> = {
  railGrid: {
    display: "grid",
    gridTemplateColumns: CRM_COMMS_RAIL_V1.GRID_TEMPLATE,
    gap: CRM_COMMS_RAIL_V1.GAP,
    alignItems: "start"
  },
  rail: { display: "flex", flexDirection: "column", gap: CRM_COMMS_RAIL_V1.GAP },
  composerFields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  composerActions: { display: "flex", justifyContent: "flex-end", marginTop: 10 },
  cardHeadRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  paginationRow: { display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ── CRM_COMMS_RAIL_V1 row builders (pure — testable without a DOM) ────────────

/** The task fields a rail / To-dos row needs. */
export type TodoRowInput = {
  status: Task["status"];
  dueAt: string | null;
};

/** What a to-do row renders under its title. */
export type TodoRowView = {
  /** True only for a still-actionable task whose due date has passed. */
  overdue: boolean;
  /** "Overdue by 3 days" · "Due in 2 days" · "Due 9 Sep" · "No due date". */
  dueLabel: string;
};

function fmtDueDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

/**
 * Turns a to-do row plus a clock into its sub-line.
 *
 * A task only counts as overdue while it is still actionable — a DONE or
 * CANCELLED task with a due date in the past is finished business, not a
 * problem, so it renders its date and never the overdue treatment.
 */
export function buildTodoRowView(task: TodoRowInput, nowMs: number): TodoRowView {
  if (!task.dueAt) return { overdue: false, dueLabel: "No due date" };
  const dueMs = new Date(task.dueAt).getTime();
  if (Number.isNaN(dueMs)) return { overdue: false, dueLabel: "No due date" };

  const actionable = task.status === "OPEN" || task.status === "IN_PROGRESS";
  const diffMs = dueMs - nowMs;

  if (diffMs < 0) {
    if (!actionable) return { overdue: false, dueLabel: `Due ${fmtDueDate(task.dueAt)}` };
    const days = Math.floor(-diffMs / DAY_MS);
    if (days < 1) return { overdue: true, dueLabel: "Overdue today" };
    return { overdue: true, dueLabel: `Overdue by ${days} day${days === 1 ? "" : "s"}` };
  }

  const days = Math.floor(diffMs / DAY_MS);
  if (days < 1) return { overdue: false, dueLabel: "Due today" };
  if (days <= CRM_COMMS_RAIL_V1.DUE_SOON_DAYS) {
    return { overdue: false, dueLabel: `Due in ${days} day${days === 1 ? "" : "s"}` };
  }
  return { overdue: false, dueLabel: `Due ${fmtDueDate(task.dueAt)}` };
}

/**
 * The "N overdue" chip on the My to-dos card header. Derived from the rows
 * already in state — no second request, and zero renders nothing.
 */
export function countOverdueTodos(tasks: TodoRowInput[], nowMs: number): number {
  return tasks.reduce((n, task) => (buildTodoRowView(task, nowMs).overdue ? n + 1 : n), 0);
}

/** The thread fields a Threads-tab row needs. */
export type ThreadRowInput = {
  subject: string | null;
  entityType: string;
  entityId: string;
  updatedAt: string;
  createdBy: { firstName: string; lastName: string } | null;
};

/** What a thread row renders, field by field. */
export type ThreadRowView = {
  /** Author initials for the avatar circle; "—" when the author is unknown. */
  initials: string;
  subject: string;
  /** The anchor chip — entityLabel() over the thread's (type, id) pair. */
  anchorLabel: string;
  /** Relative age of the last activity, e.g. "6 days ago". */
  ageLabel: string;
};

function initialsOf(person: { firstName: string; lastName: string } | null): string {
  if (!person) return "—";
  const first = person.firstName.trim();
  const last = person.lastName.trim();
  const letters = `${first.slice(0, 1)}${last.slice(0, 1)}`.trim();
  return letters === "" ? "—" : letters.toUpperCase();
}

function relativeAge(iso: string, nowMs: number): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const days = Math.floor((nowMs - ms) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 90) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Turns a thread row into everything the Threads list renders.
 *
 * GAP (see the PR body): the mock-up's row also carries the last message
 * prefixed with its author and a message count. `listThreads` returns rows
 * through `threadInclude()` — `createdBy` and nothing else, no messages and
 * no `_count` — so neither field is available here. Synthesising them would
 * cost one request per row; they need an API slice instead.
 */
export function buildThreadRowView(thread: ThreadRowInput, nowMs: number): ThreadRowView {
  return {
    initials: initialsOf(thread.createdBy),
    subject: thread.subject ?? "(no subject)",
    anchorLabel: entityLabel(thread.entityType, thread.entityId),
    ageLabel: relativeAge(thread.updatedAt, nowMs)
  };
}

/**
 * Body for PATCH /crm/comms/tasks/:id when a checkbox is ticked. Lifted out of
 * the anchored view so the rail, the To-dos tab and the anchored task list all
 * send the same flip.
 */
export function buildToggleTaskBody(task: { status: Task["status"] }): { status: "OPEN" | "DONE" } {
  return { status: task.status === "DONE" ? "OPEN" : "DONE" };
}

// ── CRM_COMMS_RAIL_V1 row components ─────────────────────────────────────────

/**
 * One to-do row. Serves the rail's "My to-dos" and the To-dos tab, so both
 * get the checkbox.
 *
 * PATCH /crm/comms/tasks/:id gates on `crm.manage` while GET /crm/comms/tasks
 * gates on `crm.view` — a viewer can read this list but cannot tick it, so the
 * checkbox renders disabled rather than firing a request that returns 403.
 */
function TodoRow(props: {
  task: Task;
  nowMs: number;
  canManage: boolean;
  showStatus?: boolean;
  onToggle: (task: Task) => void;
}) {
  const { task, nowMs, canManage, showStatus, onToggle } = props;
  const view = buildTodoRowView(task, nowMs);
  const done = task.status === "DONE";
  return (
    <div className="crm-todo-row">
      <input
        type="checkbox"
        className={`crm-todo-row__checkbox${view.overdue ? " crm-todo-row__checkbox--overdue" : ""}`}
        style={{ cursor: canManage ? "pointer" : "not-allowed" }}
        checked={done}
        disabled={!canManage}
        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
        title={canManage ? undefined : "Requires the crm.manage permission."}
        onChange={() => onToggle(task)}
      />
      <div style={{ flex: 1 }}>
        <div className={`crm-todo-row__title${done ? " crm-todo-row__title--done" : ""}`}>
          {task.title}
        </div>
        <div className={`crm-cell-sub${view.overdue ? " crm-todo-row__sub--overdue" : ""}`}>
          {view.dueLabel} &middot; {entityLabel(task.entityType, task.entityId)}
        </div>
        {task.description && (
          <div className="crm-cell-sub">{task.description}</div>
        )}
      </div>
      {showStatus && (
        <span className={`s7-badge s7-badge--${task.status === "OPEN" ? "active" : task.status === "IN_PROGRESS" ? "warning" : task.status === "DONE" ? "active" : "neutral"}`}>
          {STATUS_LABEL[task.status]}
        </span>
      )}
    </div>
  );
}

/** One Threads-tab row: avatar, subject, anchor chip, relative age. */
function ThreadRow(props: { thread: ThreadRowInput; nowMs: number; onOpen: () => void }) {
  const view = buildThreadRowView(props.thread, props.nowMs);
  return (
    <button
      onClick={props.onOpen}
      className="crm-thread-row"
    >
      <span className="crm-avatar crm-thread-row__avatar">
        {view.initials}
      </span>
      <div style={{ flex: 1 }}>
        <div className="crm-thread-row__head">
          <span className="crm-thread-row__subject">{view.subject}</span>
          <span className="s7-badge s7-badge--active crm-thread-row__anchor">
            {view.anchorLabel}
          </span>
        </div>
        <div className="crm-cell-sub crm-thread-row__footer">{view.ageLabel}</div>
      </div>
    </button>
  );
}

const INBOX_PAGE_SIZE = 25;

// ── Unanchored inbox component ────────────────────────────────────────────────
//
// Rendered when /crm/comms has no entityType/entityId query string (the nav
// entry). Shows all threads and my-tasks across every entity, paged.
// Clicking a thread navigates to the anchored view (?entityType=…&entityId=…)
// so there is one conversation UI, not two.

function CommsInboxPage({ activeTab }: { activeTab: CommsInnerTab }) {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();

  // CRM UIFIX S1: the tab is CONTROLLED by the outer CommsPage via URL. The
  // former useState + inner tab bar caused the "two tab bars on Comms" defect.
  const inboxTab = activeTab;

  // CRM-S9: New-thread composer for the unanchored inbox.
  // Before S9, /crm/comms was a closed loop on an empty system — createThread
  // exits early unless anchored, and anchored was only set by the query string
  // that the nav does not carry. AnchorPicker gives the user a way to pick a
  // record here and land in anchored mode with the new thread already open.
  const [pickerSelection, setPickerSelection] = useState<PickerSelection | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // CRM_COMMS_RAIL_V1: the rail's "Add a to-do" composer. It shares the
  // AnchorPicker selection above — POST /crm/comms/tasks requires entityType
  // and entityId (CreateTaskDto), so a to-do must hang off a real record.
  const [todoTitle, setTodoTitle] = useState("");
  const [todoDue, setTodoDue] = useState("");
  const [addingTodo, setAddingTodo] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);

  // Threads paging
  const [inboxThreads, setInboxThreads] = useState<Thread[]>([]);
  const [inboxThreadsTotal, setInboxThreadsTotal] = useState(0);
  const [inboxThreadsPage, setInboxThreadsPage] = useState(1);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  // Tasks paging
  const [inboxTasks, setInboxTasks] = useState<Task[]>([]);
  const [inboxTasksTotal, setInboxTasksTotal] = useState(0);
  const [inboxTasksPage, setInboxTasksPage] = useState(1);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const loadInboxThreads = useCallback(async (page: number) => {
    setLoadingThreads(true);
    setThreadsError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(INBOX_PAGE_SIZE)
      });
      const res = await authFetch(`/crm/comms/threads?${qs.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Thread[]; total: number };
      setInboxThreads(data.items);
      setInboxThreadsTotal(data.total);
      setInboxThreadsPage(page);
    } catch (err) {
      setThreadsError(err instanceof Error ? err.message : "Failed to load threads.");
    } finally {
      setLoadingThreads(false);
    }
  }, [authFetch]);

  const loadInboxTasks = useCallback(async (page: number) => {
    if (!user) return;
    setLoadingTasks(true);
    setTasksError(null);
    try {
      const qs = new URLSearchParams({
        assigneeId: user.id,
        page: String(page),
        limit: String(INBOX_PAGE_SIZE)
      });
      const res = await authFetch(`/crm/comms/tasks?${qs.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Task[]; total: number };
      setInboxTasks(data.items);
      setInboxTasksTotal(data.total);
      setInboxTasksPage(page);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoadingTasks(false);
    }
  }, [authFetch, user]);

  useEffect(() => {
    void loadInboxThreads(1);
  }, [loadInboxThreads]);

  // CRM_COMMS_RAIL_V1: the Threads tab now shows "My to-dos" in its rail, so
  // it needs the same rows the To-dos tab loads. Same request, no new route.
  useEffect(() => {
    if (inboxTab === "tasks" || inboxTab === "threads") void loadInboxTasks(1);
  }, [inboxTab, loadInboxTasks]);

  // sortThreadsByActivity is typed against InboxThread (the subset it sorts
  // on) but returns the very objects it was handed, so createdBy survives the
  // round trip — the cast recovers it for the row avatar.
  const sortedThreads = useMemo(
    () => sortThreadsByActivity(
      inboxThreads.map((t) => ({
        ...t,
        entityDisplay: entityLabel(t.entityType, t.entityId)
      }))
    ) as Array<Thread & { entityDisplay: string }>,
    [inboxThreads]
  );

  const inboxThreadsTotalPages = Math.ceil(inboxThreadsTotal / INBOX_PAGE_SIZE);
  const inboxTasksTotalPages = Math.ceil(inboxTasksTotal / INBOX_PAGE_SIZE);

  function openAnchoredView(thread: { entityType: string; entityId: string }) {
    navigate(`/crm/comms?entityType=${encodeURIComponent(thread.entityType)}&entityId=${encodeURIComponent(thread.entityId)}`);
  }

  const canCreate =
    pickerSelection?.kind === "entity" &&
    !!pickerSelection.entityId &&
    newSubject.trim().length > 0;

  const startThread = useCallback(async () => {
    if (!canCreate || pickerSelection?.kind !== "entity") return;
    setCreating(true);
    setCreateError(null);
    try {
      const body = buildCreateThreadBody(pickerSelection, newSubject.trim());
      const res = await authFetch(`/crm/comms/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const serverType = mapTypeToServer(pickerSelection.type);
      navigate(
        `/crm/comms?entityType=${encodeURIComponent(serverType)}&entityId=${encodeURIComponent(pickerSelection.entityId)}`
      );
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create thread.");
    } finally {
      setCreating(false);
    }
  }, [authFetch, canCreate, navigate, newSubject, pickerSelection]);

  // ── CRM_COMMS_RAIL_V1: rail state ──────────────────────────────────────────

  const nowMs = Date.now();
  const canManage = can(user, "crm.manage");
  const overdueCount = countOverdueTodos(inboxTasks, nowMs);
  const anchored = pickerSelection?.kind === "entity" && !!pickerSelection.entityId;
  const canAddTodo = anchored && canManage && todoTitle.trim().length > 0 && !addingTodo;

  // Helper text — only shown while no anchor is selected (artboard spec).
  const showAnchorHelp = !anchored && canManage;

  const addTodo = useCallback(async () => {
    if (pickerSelection?.kind !== "entity" || !pickerSelection.entityId) return;
    if (!user || !todoTitle.trim()) return;
    setAddingTodo(true);
    setTodoError(null);
    try {
      // buildCreateTaskBody pins assigneeId to the creating user — that is why
      // the row shows up in "My to-dos" (the list filters by assigneeId).
      const body = buildCreateTaskBody({
        entityType: mapTypeToServer(pickerSelection.type),
        entityId: pickerSelection.entityId,
        title: todoTitle.trim(),
        dueAt: todoDue || null,
        userId: user.id
      });
      const res = await authFetch(`/crm/comms/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setTodoTitle("");
      setTodoDue("");
      await loadInboxTasks(1);
    } catch (err) {
      setTodoError(err instanceof Error ? err.message : "Failed to add the to-do.");
    } finally {
      setAddingTodo(false);
    }
  }, [authFetch, loadInboxTasks, pickerSelection, todoDue, todoTitle, user]);

  const toggleInboxTask = useCallback(async (task: Task) => {
    if (!canManage) return;
    setTasksError(null);
    try {
      const res = await authFetch(`/crm/comms/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildToggleTaskBody(task))
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      await loadInboxTasks(inboxTasksPage);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Failed to update the to-do.");
    }
  }, [authFetch, canManage, inboxTasksPage, loadInboxTasks]);

  const meInitials = initialsOf(user ? { firstName: user.firstName, lastName: user.lastName } : null);

  // ADD A TO-DO rail card (artboard spec: s7 card, s7-input, s7-select-styled
  // date, primary button right-aligned, helper only while unanchored).
  const addTodoCard = (
    <div className="s7-card crm-rail-card">
      <p className="s7-type-label crm-rail-card__label">Add a to-do</p>
      <input
        className="s7-input"
        placeholder="What needs doing?"
        value={todoTitle}
        onChange={(e) => { setTodoTitle(e.target.value); setTodoError(null); }}
      />
      <div style={layout.composerFields}>
        <div>
          <p className="s7-type-label crm-rail-card__field-label">Assign to</p>
          {/* Not a picker — assigneeId always defaults to the creator. */}
          <div className="crm-rail-card__assign-box s7-input crm-rail-card__assign-box--readonly">
            <span className="crm-avatar crm-avatar--sm crm-rail-card__me-avatar">
              {meInitials}
            </span>
            <span>Me</span>
          </div>
        </div>
        <div>
          <p className="s7-type-label crm-rail-card__field-label">Due</p>
          <input
            className="s7-input"
            type="date"
            value={todoDue}
            onChange={(e) => setTodoDue(e.target.value)}
          />
        </div>
      </div>
      <div style={layout.composerActions}>
        <button
          className="s7-btn s7-btn--primary crm-btn--primary"
          onClick={() => void addTodo()}
          disabled={!canAddTodo}
        >
          {addingTodo ? "Adding…" : "Add"}
        </button>
      </div>
      {showAnchorHelp && (
        <p className="crm-cell-sub crm-rail-card__help">
          Pick a record from New thread above &mdash; a to-do hangs off an account, tender, job or contract.
        </p>
      )}
      {todoError && (
        <p className="crm-cell-sub crm-rail-card__help crm-rail-card__help--error">{todoError}</p>
      )}
    </div>
  );

  const myTodosCard = (
    <div className="s7-card crm-rail-card">
      <div style={layout.cardHeadRow}>
        <p className="s7-type-label crm-rail-card__label" style={{ marginBottom: 0 }}>My to-dos</p>
        {overdueCount > 0 && (
          <span className="s7-badge s7-badge--danger">
            {overdueCount} overdue
          </span>
        )}
      </div>
      {loadingTasks
        ? <p className="crm-cell-sub">Loading&hellip;</p>
        : inboxTasks.length === 0
          ? <p className="crm-cell-sub">No to-dos assigned to you.</p>
          : inboxTasks.map((t) => (
              <TodoRow
                key={t.id}
                task={t}
                nowMs={nowMs}
                canManage={canManage}
                onToggle={(task) => void toggleInboxTask(task)}
              />
            ))}
    </div>
  );

  // CRM_PARITY_INBOX_V1 (crmvis-S7): the composer is hidden until the user
  // presses "+ New thread". It is the same AnchorPicker state and
  // buildCreateThreadBody call as before — only the visibility is gated.
  const [showComposer, setShowComposer] = useState(false);

  // Close the composer on Escape key.
  useEffect(() => {
    if (!showComposer) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowComposer(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showComposer]);

  // Tab subtitle per artboard:
  //   Inbox: "Everything coming in — leads not yet triaged, live conversations, and what you owe people."
  //   Threads / To-dos: "Internal threads and to-dos, anchored to an account, tender, job or contract."
  const pageSubtitle = inboxTab === "inbox"
    ? "Everything coming in — leads not yet triaged, live conversations, and what you owe people."
    : "Internal threads and to-dos, anchored to an account, tender, job or contract.";

  return (
    <div style={{ padding: "24px", maxWidth: 1080, margin: "0 auto" }}>
      {/* CRM_PARITY_INBOX_V1: crm-page-head — title + subtitle on left,
          Anchor chip + New thread on right. The green notice is gone. */}
      <div className="crm-page-head">
        <div className="crm-page-head__left">
          <h1 className="s7-type-page-title" style={{ margin: 0 }}>Comms hub</h1>
          <p className="crm-page-head__subtitle">{pageSubtitle}</p>
        </div>
        <div className="crm-page-head__actions">
          {/* Anchor chip — legend; the actual picker is inside the composer */}
          <span
            className={`s7-btn s7-btn--secondary s7-btn--sm crm-filter-chip${pickerSelection ? " crm-filter-chip--active" : ""}`}
            aria-label="Anchor filter"
          >
            Anchor: {pickerSelection?.kind === "entity" ? pickerSelection.label : "All"} &#9660;
          </span>
          {/* + New thread button */}
          <button
            className="s7-btn s7-btn--primary crm-btn--primary"
            onClick={() => setShowComposer((v) => !v)}
          >
            {showComposer ? "Cancel" : "+ New thread"}
          </button>
        </div>
      </div>

      {/* CRM_PARITY_INBOX_V1: NEW THREAD composer — hidden until showComposer is true */}
      {showComposer && (
        <div className="s7-card" style={{ marginBottom: 16 }}>
          <p className="s7-type-label" style={{ marginBottom: 10 }}>New thread &mdash; anchor to</p>
          <AnchorPicker
            authFetch={authFetch}
            value={pickerSelection}
            onChange={(sel) => { setPickerSelection(sel); setCreateError(null); }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              className="s7-input"
              placeholder="Subject"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
            />
            <button
              className="s7-btn s7-btn--primary crm-btn--primary"
              onClick={() => void startThread()}
              disabled={!canCreate || creating}
            >
              {creating ? "Starting…" : "Start"}
            </button>
          </div>
          {createError && (
            <p style={{ color: "var(--status-danger)", fontSize: 12, marginTop: 8 }}>{createError}</p>
          )}
        </div>
      )}

      {/* CRM UIFIX S1: the inner Inbox/Threads/To-dos tablist that used to live
          here is gone. The outer CommsPage tab bar drives which tab renders,
          via URL (?tab=inbox|threads|todos). One tab bar per page. */}

      {/* CRM-S10: Inbox tab — lead intake's screen inside the Comms hub window.
          Boundary rule: CommsInboxTriage calls /crm/intake/* only.
          The anchor picker selection (pickerSelection) acts as the anchor filter. */}
      {inboxTab === "inbox" && (
        <CommsInboxTriage anchorFilter={pickerSelection} />
      )}

      {inboxTab === "threads" && (
        <>
          {threadsError && (
            <div className="crm-alert--danger" style={{ marginBottom: 16 }}>{threadsError}</div>
          )}
          {/* CRM_COMMS_RAIL_V1: one screen, two columns — 1fr for the thread
              list, a fixed 400px rail for the to-do composer and My to-dos. */}
          <div style={layout.railGrid}>
            <div>
              {loadingThreads
                ? <p className="crm-cell-sub" style={{ padding: "12px 0" }}>Loading&hellip;</p>
                : (
                  <div className="s7-card">
                    <div style={layout.cardHeadRow}>
                      <p className="s7-type-label" style={{ marginBottom: 0 }}>Threads</p>
                      <span className="crm-cell-sub">
                        page {inboxThreadsPage} of {inboxThreadsTotalPages || 1}
                      </span>
                    </div>
                    {sortedThreads.length === 0
                      ? <p className="crm-cell-sub">No threads found.</p>
                      : sortedThreads.map((t) => (
                          <ThreadRow
                            key={t.id}
                            thread={t}
                            nowMs={nowMs}
                            onOpen={() => openAnchoredView(t)}
                          />
                        ))}

                    {inboxThreadsTotalPages > 1 && (
                      <div style={layout.paginationRow}>
                        <button
                          className="s7-btn s7-btn--secondary s7-btn--sm"
                          disabled={inboxThreadsPage <= 1}
                          onClick={() => void loadInboxThreads(inboxThreadsPage - 1)}
                        >
                          Previous
                        </button>
                        <button
                          className="s7-btn s7-btn--secondary s7-btn--sm"
                          disabled={inboxThreadsPage >= inboxThreadsTotalPages}
                          onClick={() => void loadInboxThreads(inboxThreadsPage + 1)}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
            </div>

            <div style={layout.rail}>
              {addTodoCard}
              {myTodosCard}
            </div>
          </div>
        </>
      )}

      {inboxTab === "tasks" && (
        <>
          {tasksError && (
            <div className="crm-alert--danger" style={{ marginBottom: 16 }}>{tasksError}</div>
          )}
          {loadingTasks
            ? <p className="crm-cell-sub" style={{ padding: "12px 0" }}>Loading&hellip;</p>
            : (
              <div className="s7-card">
                <div style={layout.cardHeadRow}>
                  <p className="s7-type-label" style={{ marginBottom: 0 }}>My to-dos</p>
                  {overdueCount > 0 && (
                    <span className="s7-badge s7-badge--danger">
                      {overdueCount} overdue
                    </span>
                  )}
                  <span className="crm-cell-sub">
                    page {inboxTasksPage} of {inboxTasksTotalPages || 1}
                  </span>
                </div>
                {inboxTasks.length === 0
                  ? <p className="crm-cell-sub">No tasks assigned to you.</p>
                  : inboxTasks.map((t) => (
                      // CRM_COMMS_RAIL_V1: same row component as the rail, so
                      // the To-dos tab is tickable too.
                      <TodoRow
                        key={t.id}
                        task={t}
                        nowMs={nowMs}
                        canManage={canManage}
                        showStatus
                        onToggle={(task) => void toggleInboxTask(task)}
                      />
                    ))}

                {inboxTasksTotalPages > 1 && (
                  <div style={layout.paginationRow}>
                    <button
                      className="s7-btn s7-btn--secondary s7-btn--sm"
                      disabled={inboxTasksPage <= 1}
                      onClick={() => void loadInboxTasks(inboxTasksPage - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="s7-btn s7-btn--secondary s7-btn--sm"
                      disabled={inboxTasksPage >= inboxTasksTotalPages}
                      onClick={() => void loadInboxTasks(inboxTasksPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
        </>
      )}
    </div>
  );
}

// ── Exported body builders (pure — testable without React) ────────────────────

/**
 * Builds the JSON body for POST /crm/comms/tasks.
 * assigneeId must always be included so tasks appear in the creator's "My to-dos"
 * (the inbox query filters by assigneeId — omitting it means the task is unassigned
 * and the To-dos tab is always empty for the creating user).
 */
export function buildCreateTaskBody(args: {
  entityType: string;
  entityId: string;
  title: string;
  dueAt: string | null;
  userId: string;
}): {
  entityType: string;
  entityId: string;
  title: string;
  dueAt: string | null;
  assigneeId: string;
} {
  return {
    entityType: args.entityType,
    entityId: args.entityId,
    title: args.title,
    dueAt: args.dueAt,
    assigneeId: args.userId
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CommsHubPage(props: CommsHubPageProps = {}) {
  const { authFetch, user } = useAuth();
  const [params] = useSearchParams();
  const entityType = params.get("entityType") ?? "ACCOUNT";
  const entityId = params.get("entityId") ?? "";
  // CRM UIFIX S1: outer CommsPage controls the unanchored inbox's tab.
  const unanchoredTab: CommsInnerTab = props.activeInnerTab ?? "inbox";

  const [tab, setTab] = useState<"threads" | "tasks">("threads");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  const anchored = useMemo(
    () => Boolean(entityType && entityId),
    [entityType, entityId]
  );

  const loadThreads = useCallback(async () => {
    if (!anchored) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ entityType, entityId });
      const res = await authFetch(`/crm/comms/threads?${qs.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Thread[] };
      setThreads(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load threads.");
    } finally {
      setLoading(false);
    }
  }, [anchored, authFetch, entityType, entityId]);

  const loadTasks = useCallback(async () => {
    if (!anchored) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ entityType, entityId });
      const res = await authFetch(`/crm/comms/tasks?${qs.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Task[] };
      setTasks(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [anchored, authFetch, entityType, entityId]);

  const openThread = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/crm/comms/threads/${id}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setSelectedThread(await res.json() as ThreadDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (tab === "threads") void loadThreads();
    else void loadTasks();
  }, [tab, loadThreads, loadTasks]);

  const createThread = useCallback(async () => {
    if (!anchored || !newSubject.trim()) return;
    const res = await authFetch(`/crm/comms/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, subject: newSubject.trim() })
    });
    if (res.ok) {
      setNewSubject("");
      await loadThreads();
    } else {
      setError(await readApiErrorMessage(res));
    }
  }, [anchored, authFetch, entityType, entityId, newSubject, loadThreads]);

  const postMessage = useCallback(async () => {
    if (!selectedThread || !newMessage.trim()) return;
    const res = await authFetch(`/crm/comms/threads/${selectedThread.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMessage.trim() })
    });
    if (res.ok) {
      setNewMessage("");
      await openThread(selectedThread.id);
    } else {
      setError(await readApiErrorMessage(res));
    }
  }, [authFetch, selectedThread, newMessage, openThread]);

  const createTask = useCallback(async () => {
    if (!anchored || !newTaskTitle.trim() || !user) return;
    const res = await authFetch(`/crm/comms/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCreateTaskBody({
        entityType,
        entityId,
        title: newTaskTitle.trim(),
        dueAt: newTaskDue || null,
        userId: user.id
      }))
    });
    if (res.ok) {
      setNewTaskTitle("");
      setNewTaskDue("");
      await loadTasks();
    } else {
      setError(await readApiErrorMessage(res));
    }
  }, [anchored, authFetch, entityType, entityId, newTaskTitle, newTaskDue, loadTasks, user]);

  const toggleTask = useCallback(async (task: Task) => {
    // CRM_COMMS_RAIL_V1: one flip, shared with the unanchored rail + To-dos tab.
    const res = await authFetch(`/crm/comms/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildToggleTaskBody(task))
    });
    if (res.ok) await loadTasks();
  }, [authFetch, loadTasks]);

  // When there is no anchor, render the unanchored inbox.
  // This replaces the former error-only early-return (CRM-4 / NAV-4 reconciliation).
  // CRM UIFIX S1: pass the outer-controlled tab down.
  if (!anchored) {
    return <CommsInboxPage activeTab={unanchoredTab} />;
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Comms hub</h1>
        <span className="s7-badge s7-badge--active">
          {ENTITY_LABEL[entityType] ?? entityType}
        </span>
        <span className="crm-cell-sub" style={{ margin: 0 }}>{entityId}</span>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["threads", "tasks"] as const).map((t) => (
          <button
            key={t}
            className={`s7-btn s7-btn--${tab === t ? "primary crm-btn--primary" : "secondary"}`}
            onClick={() => { setTab(t); setSelectedThread(null); }}
          >
            {t === "threads" ? "Threads" : "To-Do"}
          </button>
        ))}
      </div>

      {error && (
        <div className="crm-alert--danger" style={{ marginBottom: 12 }}>{error}</div>
      )}

      {tab === "threads" && (
        <>
          <div className="s7-card" style={{ marginBottom: 12 }}>
            <p className="s7-type-label" style={{ marginBottom: 10 }}>New thread</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="s7-input"
                placeholder="Subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <button
                className="s7-btn s7-btn--primary crm-btn--primary"
                onClick={createThread}
                disabled={loading}
              >
                Start
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div className="s7-card">
              <p className="s7-type-label" style={{ marginBottom: 10 }}>Threads ({threads.length})</p>
              {threads.length === 0
                ? <p className="crm-cell-sub">No threads yet.</p>
                : threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => void openThread(t.id)}
                      className={`crm-thread-row${selectedThread?.id === t.id ? " crm-thread-row--selected" : ""}`}
                      style={{ display: "block", width: "100%", textAlign: "left" }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {t.subject ?? "(no subject)"}
                      </div>
                      <div className="crm-cell-sub">
                        Updated {fmtDate(t.updatedAt)}
                      </div>
                    </button>
                  ))}
            </div>

            <div className="s7-card">
              {!selectedThread
                ? <p className="crm-cell-sub">Select a thread on the left.</p>
                : (
                  <>
                    <p className="s7-type-label" style={{ marginBottom: 10 }}>
                      {selectedThread.subject ?? "(no subject)"}
                    </p>
                    <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
                      {selectedThread.messages.length === 0
                        ? <p className="crm-cell-sub">No messages yet.</p>
                        : selectedThread.messages.map((m) => (
                            <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                  {m.author
                                    ? `${m.author.firstName} ${m.author.lastName}`
                                    : "Unknown"}
                                </span>
                                <span className="crm-cell-sub" style={{ margin: 0 }}>{fmtDate(m.createdAt)}</span>
                              </div>
                              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                                {m.body}
                              </div>
                            </div>
                          ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="s7-input"
                        placeholder="Write a message… use @name to mention"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void postMessage(); }}
                      />
                      <button
                        className="s7-btn s7-btn--primary crm-btn--primary"
                        onClick={postMessage}
                      >
                        Post
                      </button>
                    </div>
                  </>
                )
              }
            </div>
          </div>
        </>
      )}

      {tab === "tasks" && (
        <>
          <div className="s7-card" style={{ marginBottom: 12 }}>
            <p className="s7-type-label" style={{ marginBottom: 10 }}>New task</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="s7-input"
                style={{ flex: 2 }}
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <input
                className="s7-input"
                style={{ flex: 1 }}
                type="date"
                value={newTaskDue}
                onChange={(e) => setNewTaskDue(e.target.value)}
              />
              <button
                className="s7-btn s7-btn--primary crm-btn--primary"
                onClick={createTask}
              >
                Add
              </button>
            </div>
          </div>

          <div className="s7-card">
            <p className="s7-type-label" style={{ marginBottom: 10 }}>Tasks ({tasks.length})</p>
            {tasks.length === 0
              ? <p className="crm-cell-sub">No tasks yet.</p>
              : tasks.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <input
                      type="checkbox"
                      checked={t.status === "DONE"}
                      onChange={() => void toggleTask(t)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: t.status === "DONE" ? "line-through" : "none",
                        color: t.status === "DONE" ? "var(--text-muted)" : "var(--text-primary)"
                      }}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="crm-cell-sub">{t.description}</div>
                      )}
                    </div>
                    <span className={`s7-badge s7-badge--${t.status === "OPEN" ? "active" : t.status === "IN_PROGRESS" ? "warning" : t.status === "DONE" ? "active" : "neutral"}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className="crm-cell-sub" style={{ margin: 0, minWidth: 90, textAlign: "right" }}>
                      {t.dueAt ? `Due ${fmtDate(t.dueAt)}` : "—"}
                    </span>
                    <span className="crm-cell-sub" style={{ margin: 0, minWidth: 100 }}>
                      {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned"}
                    </span>
                  </div>
                ))}
          </div>
        </>
      )}
    </div>
  );
}
