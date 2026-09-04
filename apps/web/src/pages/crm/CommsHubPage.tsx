import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { readApiErrorMessage } from "../../lib/api-errors";
import { entityLabel, sortThreadsByActivity } from "./comms-inbox.helpers";
import { AnchorPicker, buildCreateThreadBody, mapTypeToServer, type PickerSelection } from "./AnchorPicker";
import { CommsInboxTriage } from "./CommsInboxTriage";

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
 *
 * Colour discipline: this slice adds no colour of its own. Every ink it uses
 * is read from `s` or `STATUS_COLOUR` below, via RAIL_INK.
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

const s: Record<string, React.CSSProperties> = {
  page: { padding: "24px", maxWidth: 1080, margin: "0 auto", fontFamily: "sans-serif" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  card: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12, background: "#fff" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 },
  tabs: { display: "flex", gap: 4, marginBottom: 16 },
  tab: { padding: "6px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  input: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, width: "100%" },
  primaryBtn: { padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  secondaryBtn: { padding: "4px 10px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontSize: 12 },
  empty: { color: "#9ca3af", fontSize: 13, padding: "12px 0" },
  msgRow: { padding: "10px 0", borderBottom: "1px solid #f3f4f6" },
  msgHead: { display: "flex", gap: 8, alignItems: "center", marginBottom: 4 },
  msgAuthor: { fontSize: 13, fontWeight: 600, color: "#111827" },
  msgTime: { fontSize: 11, color: "#9ca3af" },
  taskRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 },

  // ── CRM_COMMS_RAIL_V1 — layout only, no colour ─────────────────────────────
  railGrid: {
    display: "grid",
    gridTemplateColumns: CRM_COMMS_RAIL_V1.GRID_TEMPLATE,
    gap: CRM_COMMS_RAIL_V1.GAP,
    alignItems: "start"
  },
  rail: { display: "flex", flexDirection: "column", gap: CRM_COMMS_RAIL_V1.GAP },
  railCardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  composerFields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  composerLabel: { fontSize: 11, fontWeight: 600, marginBottom: 4 },
  assignToBox: { display: "flex", alignItems: "center", gap: 7, height: 34, padding: "0 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box" },
  meAvatar: { width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 },
  composerActions: { display: "flex", justifyContent: "flex-end", marginTop: 10 },
  composerHelp: { fontSize: 11, marginTop: 8 },
  todoRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0" },
  todoCheckbox: { width: 16, height: 16, marginTop: 2, flexShrink: 0 },
  todoTitle: { fontSize: 13, fontWeight: 600 },
  todoSubLine: { fontSize: 11, marginTop: 2 },
  threadRow: { display: "flex", gap: 12, width: "100%", textAlign: "left", padding: "12px 6px", background: "transparent", border: "none", cursor: "pointer" },
  threadAvatar: { width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  threadHead: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2, flexWrap: "wrap" },
  threadSubject: { fontSize: 13, fontWeight: 600 },
  threadFooter: { fontSize: 11, marginTop: 4 }
};

const STATUS_COLOUR: Record<Task["status"], { bg: string; fg: string }> = {
  OPEN: { bg: "#dbeafe", fg: "#1e40af" },
  IN_PROGRESS: { bg: "#fef3c7", fg: "#92400e" },
  DONE: { bg: "#d1fae5", fg: "#065f46" },
  CANCELLED: { bg: "#f3f4f6", fg: "#6b7280" }
};

/**
 * CRM_COMMS_RAIL_V1 palette. Every entry is READ from `s` or `STATUS_COLOUR`
 * above — the rail introduces no colour value of its own, so the Comms hub
 * cannot drift away from the palette the rest of this page already uses.
 */
const RAIL_INK = {
  /** Row title ink — the ink message authors already render in. */
  title: s.msgAuthor.color,
  /** Field-label ink — the ink card titles already render in. */
  label: s.cardTitle.color,
  /** Muted metadata ink — the ink empty states already render in. */
  muted: s.empty.color,
  /** Row divider — the rule task rows already draw. */
  divider: s.taskRow.borderBottom,
  /** Field border — the border inputs already draw. */
  fieldBorder: s.input.border,
  /** Thread-author avatar circle — the neutral pair. */
  avatarBg: STATUS_COLOUR.CANCELLED.bg,
  avatarInk: STATUS_COLOUR.CANCELLED.fg,
  /** Anchor chip on a thread row — the open pair. */
  anchorBg: STATUS_COLOUR.OPEN.bg,
  anchorInk: STATUS_COLOUR.OPEN.fg,
  /** Overdue treatment (chip + sub-line) — the file's needs-attention pair. */
  overdueBg: STATUS_COLOUR.IN_PROGRESS.bg,
  overdueInk: STATUS_COLOUR.IN_PROGRESS.fg,
  /** The composer's "Me" avatar — the primary button's fill and ink. */
  meBg: s.primaryBtn.background,
  meInk: s.primaryBtn.color
} as const;

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
    <div style={{ ...s.todoRow, borderBottom: RAIL_INK.divider }}>
      <input
        type="checkbox"
        style={{ ...s.todoCheckbox, cursor: canManage ? "pointer" : "not-allowed" }}
        checked={done}
        disabled={!canManage}
        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
        title={canManage ? undefined : "Requires the crm.manage permission."}
        onChange={() => onToggle(task)}
      />
      <div style={{ flex: 1 }}>
        <div style={{
          ...s.todoTitle,
          textDecoration: done ? "line-through" : "none",
          color: done ? RAIL_INK.muted : RAIL_INK.title
        }}>
          {task.title}
        </div>
        <div style={{
          ...s.todoSubLine,
          color: view.overdue ? RAIL_INK.overdueInk : RAIL_INK.muted
        }}>
          {view.dueLabel} · {entityLabel(task.entityType, task.entityId)}
        </div>
        {task.description && (
          <div style={{ ...s.todoSubLine, color: RAIL_INK.muted }}>{task.description}</div>
        )}
      </div>
      {showStatus && (
        <span style={{
          ...s.badge,
          background: STATUS_COLOUR[task.status].bg,
          color: STATUS_COLOUR[task.status].fg
        }}>
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
      style={{ ...s.threadRow, borderBottom: RAIL_INK.divider }}
    >
      <div style={{ ...s.threadAvatar, background: RAIL_INK.avatarBg, color: RAIL_INK.avatarInk }}>
        {view.initials}
      </div>
      <div style={{ flex: 1 }}>
        <div style={s.threadHead}>
          <span style={{ ...s.threadSubject, color: RAIL_INK.title }}>{view.subject}</span>
          <span style={{ ...s.badge, background: RAIL_INK.anchorBg, color: RAIL_INK.anchorInk, fontSize: 10 }}>
            {view.anchorLabel}
          </span>
        </div>
        <div style={{ ...s.threadFooter, color: RAIL_INK.muted }}>{view.ageLabel}</div>
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

  const todoHelpText = !canManage
    ? "Creating a to-do needs the crm.manage permission."
    : !anchored
      ? "Pick a record in the anchor picker above — a to-do has to hang off an account, tender, job or contract."
      : todoTitle.trim().length === 0
        ? "Give the to-do a title."
        : `Anchored to ${pickerSelection?.label ?? ""}. Assigned to you.`;

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

  // s.card carries marginBottom for the stacked single-column layout; inside
  // the rail the flex gap owns the spacing, so the margin is zeroed here.
  const addTodoCard = (
    <div style={{ ...s.card, marginBottom: 0 }}>
      <div style={s.cardTitle}>Add a to-do</div>
      <input
        style={s.input}
        placeholder="What needs doing?"
        value={todoTitle}
        onChange={(e) => { setTodoTitle(e.target.value); setTodoError(null); }}
      />
      <div style={s.composerFields}>
        <div>
          <div style={{ ...s.composerLabel, color: RAIL_INK.label }}>Assign to</div>
          {/* Not a picker — assigneeId always defaults to the creator. */}
          <div style={{ ...s.assignToBox, border: RAIL_INK.fieldBorder, color: RAIL_INK.title }}>
            <span style={{ ...s.meAvatar, background: RAIL_INK.meBg, color: RAIL_INK.meInk }}>
              {meInitials}
            </span>
            <span>Me</span>
          </div>
        </div>
        <div>
          <div style={{ ...s.composerLabel, color: RAIL_INK.label }}>Due</div>
          <input
            style={s.input}
            type="date"
            value={todoDue}
            onChange={(e) => setTodoDue(e.target.value)}
          />
        </div>
      </div>
      <div style={s.composerActions}>
        <button
          style={{ ...s.primaryBtn, opacity: canAddTodo ? 1 : 0.5, cursor: canAddTodo ? "pointer" : "not-allowed" }}
          onClick={() => void addTodo()}
          disabled={!canAddTodo}
        >
          {addingTodo ? "Adding…" : "Add"}
        </button>
      </div>
      <div style={{ ...s.composerHelp, color: RAIL_INK.muted }}>{todoHelpText}</div>
      {todoError && <div style={{ ...s.composerHelp, color: RAIL_INK.overdueInk }}>{todoError}</div>}
    </div>
  );

  const myTodosCard = (
    <div style={{ ...s.card, marginBottom: 0 }}>
      <div style={s.railCardHead}>
        <div style={{ ...s.cardTitle, marginBottom: 0 }}>My to-dos</div>
        {overdueCount > 0 && (
          <span style={{ ...s.badge, background: RAIL_INK.overdueBg, color: RAIL_INK.overdueInk }}>
            {overdueCount} overdue
          </span>
        )}
      </div>
      {loadingTasks
        ? <div style={s.empty}>Loading…</div>
        : inboxTasks.length === 0
          ? <div style={s.empty}>No to-dos assigned to you.</div>
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

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Comms hub</h1>
        <span style={{ fontSize: 12, color: "#6b7280" }}>All records</span>
      </div>

      <div style={{ ...s.card, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
        <div style={{ fontSize: 13, color: "#15803d" }}>
          Inbox view — showing threads across all records. Threads linked to deleted records are
          shown with an explicit label. Click any thread to open it in the anchored view.
        </div>
      </div>

      {/* CRM-S9 composer: pick an anchor + subject then Start. */}
      <div style={s.card}>
        <div style={s.cardTitle}>New thread</div>
        <AnchorPicker
          authFetch={authFetch}
          value={pickerSelection}
          onChange={(sel) => { setPickerSelection(sel); setCreateError(null); }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            style={s.input}
            placeholder="Subject"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
          />
          <button
            style={{ ...s.primaryBtn, opacity: canCreate && !creating ? 1 : 0.5, cursor: canCreate && !creating ? "pointer" : "not-allowed" }}
            onClick={() => void startThread()}
            disabled={!canCreate || creating}
          >
            {creating ? "Starting…" : "Start"}
          </button>
        </div>
        {createError && (
          <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{createError}</div>
        )}
      </div>

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
          {threadsError && <div style={{ ...s.card, color: "#dc2626" }}>{threadsError}</div>}
          {/* CRM_COMMS_RAIL_V1: one screen, two columns — 1fr for the thread
              list, a fixed 400px rail for the to-do composer and My to-dos. */}
          <div style={s.railGrid}>
            <div>
              {loadingThreads
                ? <div style={s.empty}>Loading…</div>
                : (
                  <div style={s.card}>
                    <div style={s.cardTitle}>
                      Threads — page {inboxThreadsPage} of {inboxThreadsTotalPages || 1}
                    </div>
                    {sortedThreads.length === 0
                      ? <div style={s.empty}>No threads found.</div>
                      : sortedThreads.map((t) => (
                          <ThreadRow
                            key={t.id}
                            thread={t}
                            nowMs={nowMs}
                            onOpen={() => openAnchoredView(t)}
                          />
                        ))}

                    {inboxThreadsTotalPages > 1 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                        <button
                          style={s.secondaryBtn}
                          disabled={inboxThreadsPage <= 1}
                          onClick={() => void loadInboxThreads(inboxThreadsPage - 1)}
                        >
                          Previous
                        </button>
                        <button
                          style={s.secondaryBtn}
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

            <div style={s.rail}>
              {addTodoCard}
              {myTodosCard}
            </div>
          </div>
        </>
      )}

      {inboxTab === "tasks" && (
        <>
          {tasksError && <div style={{ ...s.card, color: "#dc2626" }}>{tasksError}</div>}
          {loadingTasks
            ? <div style={s.empty}>Loading…</div>
            : (
              <div style={s.card}>
                <div style={s.cardTitle}>
                  My to-dos — page {inboxTasksPage} of {inboxTasksTotalPages || 1}
                </div>
                {inboxTasks.length === 0
                  ? <div style={s.empty}>No tasks assigned to you.</div>
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
                  <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                    <button
                      style={s.secondaryBtn}
                      disabled={inboxTasksPage <= 1}
                      onClick={() => void loadInboxTasks(inboxTasksPage - 1)}
                    >
                      Previous
                    </button>
                    <button
                      style={s.secondaryBtn}
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
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Comms hub</h1>
        <span style={{ ...s.badge, background: "#e0e7ff", color: "#3730a3" }}>
          {ENTITY_LABEL[entityType] ?? entityType}
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{entityId}</span>
      </div>

      <div style={s.tabs}>
        {(["threads", "tasks"] as const).map((t) => (
          <button
            key={t}
            style={{
              ...s.tab,
              background: tab === t ? "#6366f1" : "#f3f4f6",
              color: tab === t ? "#fff" : "#374151",
              fontWeight: tab === t ? 700 : 400
            }}
            onClick={() => { setTab(t); setSelectedThread(null); }}
          >
            {t === "threads" ? "Threads" : "To-Do"}
          </button>
        ))}
      </div>

      {error && <div style={{ ...s.card, color: "#dc2626" }}>{error}</div>}

      {tab === "threads" && (
        <>
          <div style={s.card}>
            <div style={s.cardTitle}>New thread</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={s.input}
                placeholder="Subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <button style={s.primaryBtn} onClick={createThread} disabled={loading}>
                Start
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div style={s.card}>
              <div style={s.cardTitle}>Threads ({threads.length})</div>
              {threads.length === 0
                ? <div style={s.empty}>No threads yet.</div>
                : threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => void openThread(t.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 6px",
                        background: selectedThread?.id === t.id ? "#eef2ff" : "transparent",
                        border: "none",
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {t.subject ?? "(no subject)"}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        Updated {fmtDate(t.updatedAt)}
                      </div>
                    </button>
                  ))}
            </div>

            <div style={s.card}>
              {!selectedThread
                ? <div style={s.empty}>Select a thread on the left.</div>
                : (
                  <>
                    <div style={s.cardTitle}>
                      {selectedThread.subject ?? "(no subject)"}
                    </div>
                    <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
                      {selectedThread.messages.length === 0
                        ? <div style={s.empty}>No messages yet.</div>
                        : selectedThread.messages.map((m) => (
                            <div key={m.id} style={s.msgRow}>
                              <div style={s.msgHead}>
                                <span style={s.msgAuthor}>
                                  {m.author
                                    ? `${m.author.firstName} ${m.author.lastName}`
                                    : "Unknown"}
                                </span>
                                <span style={s.msgTime}>{fmtDate(m.createdAt)}</span>
                              </div>
                              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                                {m.body}
                              </div>
                            </div>
                          ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        style={s.input}
                        placeholder="Write a message… use @name to mention"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void postMessage(); }}
                      />
                      <button style={s.primaryBtn} onClick={postMessage}>Post</button>
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
          <div style={s.card}>
            <div style={s.cardTitle}>New task</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...s.input, flex: 2 }}
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <input
                style={{ ...s.input, flex: 1 }}
                type="date"
                value={newTaskDue}
                onChange={(e) => setNewTaskDue(e.target.value)}
              />
              <button style={s.primaryBtn} onClick={createTask}>Add</button>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Tasks ({tasks.length})</div>
            {tasks.length === 0
              ? <div style={s.empty}>No tasks yet.</div>
              : tasks.map((t) => (
                  <div key={t.id} style={s.taskRow}>
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
                        color: t.status === "DONE" ? "#9ca3af" : "#111827"
                      }}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t.description}</div>
                      )}
                    </div>
                    <span style={{
                      ...s.badge,
                      background: STATUS_COLOUR[t.status].bg,
                      color: STATUS_COLOUR[t.status].fg
                    }}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span style={{ fontSize: 11, color: "#6b7280", minWidth: 90, textAlign: "right" }}>
                      {t.dueAt ? `Due ${fmtDate(t.dueAt)}` : "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "#6b7280", minWidth: 100 }}>
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
