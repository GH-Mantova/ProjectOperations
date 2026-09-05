// NAV-3: read-only Tenders register at /crm/register.
// CRM-S7: adds "Last interaction" and "Logged by" columns.
// CRM-S8: CRM_REGISTER_V2 — full filter set, column sort, CSV export, post-
//   submission columns (Last interaction, Logged by, Next action with overdue
//   chip), Log action (interaction + next action in one step), Follow-ups tab
//   (same list, amber toggles on, On track off), Saved views.
// CRM_REGISTER_V3 — row composition brought onto the approved mock-up:
//   Tender (number + title + "Submitted …" sub-line) | Client | Status | Value |
//   Last interaction (relative time) | Logged by | Next action | Actions.
//   Adds the money column, folds Title into the Tender cell, drops the Updated
//   column (it duplicated Last interaction as a bare date), and adds a Columns
//   picker persisted under its own localStorage key.
//   NO-OP (see the PR body): the mock-up's channel and one-line-summary halves
//   of the Last interaction cell are NOT built — the comms API sends neither.
// CRM_FOLLOWUPS_V2 — Follow-ups gets the summary and the controls it was
//   missing: the four KPI cards (Overdue · Due this week · Never logged ·
//   Value at risk) above the toggle row, the four entity-type toggles
//   (Submitted tenders · Opportunities · Leads · Won & lost) whose status Sets
//   were already in this file and dead, and a Type chip column so a Lead row
//   and a Tender row are distinguishable on a list that spans both.
//   Still ONE list, ONE fetch, ONE row pipeline (decision 6): the entity-type
//   group is a status filter that COMPOSES with the four next-action toggles.
//   Every KPI figure is derived in the browser from rows already loaded.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { fetchAllPages, type FiltersForQuery } from "../tendering/tenderingPage.helpers";
import {
  TENDER_STATUSES,
  TENDER_STATUS_LABEL,
  type TenderStatus
} from "../tendering/tenderStatusLabels";
import {
  classifyNextAction,
  nextActionPassesFilter,
  buildCrmRegisterCsv,
  validateLogPayload,
  sortCrmRow,
  FOLLOWUPS_DEFAULT_TOGGLES,
  formatMoneyAUD,
  formatRelativeTime,
  formatSubmittedLabel,
  normalizeColumnVisibility,
  DEFAULT_COLUMN_VISIBILITY,
  EM_RULE,
  REGISTER_COLUMNS_STORAGE_KEY,
  columnsForTab,
  visibleColumnsForTab,
  computeRegisterKpis,
  entityTypeChipLabel,
  entityTypePassesFilter,
  ENTITY_TYPES,
  DEFAULT_ENTITY_TYPE_TOGGLES,
  type EntityTypeToggles,
  type FollowUpToggles,
  type CrmColumnKey,
  type LogPayload,
  type RegisterColumnId,
  type RegisterColumnVisibility
} from "./tendersRegisterPage.helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenderRow = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  updatedAt: string;
  /**
   * CRM_REGISTER_V3: rides back on the same `include: tenderInclude` fetch —
   * it is a scalar on Tender, so no API change was needed to read it.
   * Renders as the "Submitted 12 Aug" sub-line under the tender number.
   */
  submittedAt?: string | null;
  dueDate?: string | null;
  estimatedValue?: string | null;
  probability?: number | null;
  createdAt: string;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{ id: string; clientId: string; client: { id: string; name: string } }>;
};

/** CRM-S7/S8: Last interaction result returned by POST /crm/comms/last-interaction/batch */
type LastInteraction = {
  entityType: string;
  entityId: string;
  lastMessageAt: string;
  loggedBy: { id: string; firstName: string; lastName: string };
};

/** CRM-S8: Next-action task for a tender (earliest open CommTask). */
type NextAction = {
  entityId: string;
  taskId: string;
  dueAt: string | null;
  title: string;
};

export type TendersRegisterTab = "register" | "followups";
type Tab = TendersRegisterTab;

/** CRM UIFIX S1: props for outer-shell composition. */
export type TendersRegisterPageProps = {
  /**
   * When provided, the page is a CONTROLLED subview: the outer TendersPage tab
   * bar decides the tab and the page renders no inner tab bar. When absent,
   * the page falls back to its previous "register" default (kept only so any
   * standalone caller in tests or storybook still works).
   */
  activeTab?: Tab;
};

// CRM_FOLLOWUPS_V2: the five status Sets that used to be declared here — one
// per Follow-ups toggle, each with exactly one reference in the repo (its own
// declaration line) — now live in tendersRegisterPage.helpers.ts under the
// same names, wired to the toggle group and the Type chip through
// ENTITY_TYPES. They moved rather than being duplicated so "what kind of thing
// is this row" has one definition, and so the predicate is unit-testable
// without React. WITHDRAWN_STATUSES stays declared there and belongs to no
// toggle: the mock-up has no control for it.

const EMPTY_FILTERS: FiltersForQuery = {
  search: "",
  status: [],
  estimatorId: null,
  clientId: null,
  probability: [],
  valueMin: "",
  valueMax: "",
  dueDateFrom: "",
  dueDateTo: "",
  discipline: [],
  sortBy: null,
  sortDir: "desc"
};

/** localStorage key for saved views (named filter sets). */
const SAVED_VIEWS_KEY = "crm-register-saved-views:v1";

type SavedView = {
  id: string;
  name: string;
  filters: FiltersForQuery;
  toggles: FollowUpToggles;
  tab: Tab;
};

function loadSavedViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    // ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// CRM_REGISTER_V3: Columns picker persistence.
// Same shape as the saved-views helpers above, but a SIBLING key — toggling a
// column must never rewrite `crm-register-saved-views:v1`.
// ---------------------------------------------------------------------------

function loadColumnVisibility(): RegisterColumnVisibility {
  if (typeof window === "undefined") return DEFAULT_COLUMN_VISIBILITY;
  try {
    const raw = window.localStorage.getItem(REGISTER_COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_VISIBILITY;
    return normalizeColumnVisibility(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_COLUMN_VISIBILITY;
  }
}

function persistColumnVisibility(visibility: RegisterColumnVisibility): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REGISTER_COLUMNS_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Log-contact modal component
// ---------------------------------------------------------------------------

type LogModalProps = {
  tender: TenderRow;
  onClose: () => void;
  onSave: (payload: LogPayload) => Promise<void>;
};

function LogModal({ tender, onClose, onSave }: LogModalProps) {
  const [subject, setSubject] = useState(
    `Contact — ${new Date().toLocaleDateString("en-AU")}`
  );
  const [body, setBody] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [nextActionNote, setNextActionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: LogPayload = {
      subject: subject.trim(),
      body: body.trim(),
      nextActionAt: nextActionAt || null,
      nextActionNote: nextActionNote.trim() || null
    };
    const validationError = validateLogPayload(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Log interaction for ${tender.tenderNumber}`}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          width: 480,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600 }}>
          Log interaction
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#666" }}>
          {tender.tenderNumber} — {tender.title}
        </p>
        {error && (
          <div
            role="alert"
            style={{
              color: "#dc2626",
              padding: "8px 12px",
              background: "#fef2f2",
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 13
            }}
          >
            {error}
          </div>
        )}
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <label style={labelStyle}>
            Subject
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={inputStyle}
              aria-label="Interaction subject"
            />
          </label>
          <label style={labelStyle}>
            Notes
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
              aria-label="Interaction notes"
            />
          </label>
          <label style={labelStyle}>
            Next action due (optional)
            <input
              type="date"
              value={nextActionAt}
              onChange={(e) => setNextActionAt(e.target.value)}
              style={inputStyle}
              aria-label="Next action due date"
            />
          </label>
          {nextActionAt && (
            <label style={labelStyle}>
              Next action note (optional)
              <input
                type="text"
                value={nextActionNote}
                onChange={(e) => setNextActionNote(e.target.value)}
                placeholder="e.g. Call client to follow up"
                style={inputStyle}
                aria-label="Next action note"
              />
            </label>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              style={ghostBtnStyle}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={primaryBtnStyle}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? "Saving…" : "Log interaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 12,
  color: "#374151",
  fontWeight: 500,
  marginBottom: 12,
  gap: 4
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box"
};
const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: "var(--brand-primary, #005B61)",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer",
  fontWeight: 500
};
const ghostBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "transparent",
  fontSize: 13,
  cursor: "pointer"
};

/**
 * CRM_REGISTER_V3 cell styles.
 *
 * Every colour here is read from a design token that already exists
 * (`--text-muted`, defined for both themes in styles/tokens.css) or is
 * inherited from the table. This slice introduces no colour literal of its own.
 */
const registerCellStyle = {
  tenderTitle: { cursor: "pointer", marginTop: 2 },
  tenderSubLine: { fontSize: 11, color: "var(--text-muted)", marginTop: 2 },
  money: { textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  relativeTime: { whiteSpace: "nowrap" },
  columnsPanel: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    border: "1px solid",
    borderColor: "var(--text-muted)",
    fontSize: 12
  },
  columnsCheckbox: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
  /** A column switched off in the Columns picker. */
  hiddenCell: { display: "none" }
} satisfies Record<string, React.CSSProperties>;

/**
 * CRM_FOLLOWUPS_V2 styles.
 *
 * Every colour is a design token that already exists in styles/tokens.css and
 * is defined for BOTH themes (`--surface-card`, `--border-default`,
 * `--text-primary`, `--text-secondary`, `--surface-subtle`) or is a locked
 * brand token (`--brand-primary`, `--brand-primary-light`,
 * `--brand-primary-dark`, §5 BRAND — unchanged across the theme flip by
 * design). This slice introduces no colour literal of its own.
 */
const followUpsStyle = {
  kpiRow: { marginBottom: 12 },
  kpiCard: {
    background: "var(--surface-card)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "12px 16px"
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-secondary)"
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 600,
    color: "var(--text-primary)",
    marginTop: 4,
    fontVariantNumeric: "tabular-nums"
  },
  toggleRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
    alignItems: "center"
  },
  toggleLabel: { fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 },
  entityToggleBase: {
    padding: "4px 10px",
    borderRadius: 12,
    border: "1px solid",
    fontSize: 12,
    cursor: "pointer"
  },
  entityToggleOn: {
    borderColor: "var(--brand-primary)",
    background: "var(--brand-primary-light)",
    color: "var(--brand-primary-dark)"
  },
  entityToggleOff: {
    borderColor: "var(--border-default)",
    background: "transparent",
    color: "var(--text-secondary)"
  },
  /**
   * The Type chip. One neutral chip for all four types: the chip TEXT is what
   * distinguishes a Lead row from a Tender row, and there is no per-type
   * colour token defined for both themes to reach for. Colouring it would have
   * meant inventing literals.
   */
  typeChip: {
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: 10,
    border: "1px solid",
    borderColor: "var(--border-default)",
    background: "var(--surface-subtle)",
    color: "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap"
  }
} satisfies Record<string, React.CSSProperties>;

/** CRM_FOLLOWUPS_V2: one KPI card. */
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={followUpsStyle.kpiCard}>
      <div style={followUpsStyle.kpiLabel}>{label}</div>
      <div style={followUpsStyle.kpiValue}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function TendersRegisterPage(props: TendersRegisterPageProps = {}) {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();

  // CRM UIFIX S1: the outer TendersPage tab bar drives the tab through a prop.
  // Two tab bars used to render on this screen (an outer at TendersPage and an
  // inner here) — the outer advertised an S8-empty-state stub while S8 was
  // already shipped inside this page. The inner tablist is removed; the tab is
  // now controlled from above.
  const tab: Tab = props.activeTab ?? "register";
  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<FiltersForQuery>(EMPTY_FILTERS);
  const [followUpToggles, setFollowUpToggles] =
    useState<FollowUpToggles>(FOLLOWUPS_DEFAULT_TOGGLES);
  // CRM_FOLLOWUPS_V2: the entity-type (status) toggles. All four default OFF,
  // which means "no entity-type filter" — Follow-ups opens on exactly the rows
  // it opened on before this slice.
  const [entityTypeToggles, setEntityTypeToggles] =
    useState<EntityTypeToggles>(DEFAULT_ENTITY_TYPE_TOGGLES);
  const [mineOnly, setMineOnly] = useState(false);

  const [sortBy, setSortBy] = useState<CrmColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  /** CRM-S7/S8: keyed by tenderId for O(1) lookup in the render loop. */
  const [interactions, setInteractions] = useState<Map<string, LastInteraction>>(new Map());
  /** CRM-S8: keyed by tenderId — earliest open CommTask for each tender. */
  const [nextActions, setNextActions] = useState<Map<string, NextAction>>(new Map());

  const [logTarget, setLogTarget] = useState<TenderRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews());
  const [viewNameInput, setViewNameInput] = useState("");
  const [showSaveView, setShowSaveView] = useState(false);

  // CRM_REGISTER_V3: Columns picker. Persisted under its own key, read once on
  // mount so a column switched off stays off across a reload.
  const [columnVisibility, setColumnVisibility] =
    useState<RegisterColumnVisibility>(loadColumnVisibility);
  const [showColumns, setShowColumns] = useState(false);

  // Users for "Mine only" filter
  const currentUserId = (user as { id?: string } | null)?.id ?? null;

  // Filter-bar UI state
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  // Load clients once for the filter bar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/master-data/clients?page=1&pageSize=200");
        if (!res.ok || cancelled) return;
        const body = await res.json();
        const items = (body.items ?? body) as Array<{ id: string; name: string }>;
        if (!cancelled) setClients(items);
      } catch {
        // best-effort
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch]);

  const loadTenders = useCallback(async (withFilters: FiltersForQuery) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllPages<TenderRow>(authFetch, withFilters);
      setTenders(result.items);
      setTotal(result.total);
      setTruncated(result.truncated);

      // Batch-fetch last interactions.
      if (result.items.length > 0) {
        const pairs = result.items.map((t) => ({ entityType: "TENDER", entityId: t.id }));
        try {
          const resp = await authFetch("/crm/comms/last-interaction/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pairs })
          });
          if (resp.ok) {
            const data: LastInteraction[] = await resp.json();
            const map = new Map<string, LastInteraction>();
            for (const item of data) map.set(item.entityId, item);
            setInteractions(map);
          }
        } catch {
          // Interaction data is enhancement-only; do not surface as a page error.
        }

        // Batch-fetch open CommTasks (next actions) for all loaded tenders.
        try {
          const taskIds = result.items.map((t) => t.id);
          const taskResp = await authFetch(
            `/crm/comms/tasks?entityType=TENDER&status=OPEN&limit=200`
          );
          if (taskResp.ok) {
            const taskBody = await taskResp.json() as {
              items: Array<{ id: string; entityId: string; dueAt: string | null; title: string; status: string }>
            };
            // Keep only the earliest open task per tender.
            const taskMap = new Map<string, NextAction>();
            const tenderIds = new Set(taskIds);
            const sorted = taskBody.items
              .filter((task) => tenderIds.has(task.entityId) && task.status === "OPEN")
              .sort((a, b) => {
                const aMs = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
                const bMs = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
                return aMs - bMs;
              });
            for (const task of sorted) {
              if (!taskMap.has(task.entityId)) {
                taskMap.set(task.entityId, {
                  entityId: task.entityId,
                  taskId: task.id,
                  dueAt: task.dueAt,
                  title: task.title
                });
              }
            }
            setNextActions(taskMap);
          }
        } catch {
          // Next-action data is enhancement-only.
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadTenders(filters);
  }, [filters, loadTenders]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const now = useRef(new Date());
  // Refresh "now" on each render cycle for classification accuracy.
  now.current = new Date();

  // ---------------------------------------------------------------------------
  // Derived rows
  // ---------------------------------------------------------------------------

  const enrichedRows = useMemo(() =>
    tenders.map((t) => {
      const interaction = interactions.get(t.id) ?? null;
      const nextAction = nextActions.get(t.id) ?? null;
      return {
        ...t,
        lastInteractionAt: interaction?.lastMessageAt ?? null,
        loggedByName: interaction
          ? `${interaction.loggedBy.firstName} ${interaction.loggedBy.lastName}`.trim()
          : null,
        nextActionAt: nextAction?.dueAt ?? null,
        nextActionNote: nextAction?.title ?? null
      };
    }),
    [tenders, interactions, nextActions]
  );

  // Client-side filter for search, status, client, mineOnly.
  const clientFiltered = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return enrichedRows.filter((t) => {
      if (filters.status.length && !filters.status.includes(t.status)) return false;
      if (filters.clientId && !t.tenderClients.some((tc) => tc.client.id === filters.clientId)) {
        return false;
      }
      if (needle) {
        const inTitle = t.title.toLowerCase().includes(needle);
        const inNumber = t.tenderNumber.toLowerCase().includes(needle);
        if (!inTitle && !inNumber) return false;
      }
      if (mineOnly && currentUserId) {
        if (t.estimator?.id !== currentUserId) return false;
      }
      return true;
    });
  }, [enrichedRows, filters.search, filters.status, filters.clientId, mineOnly, currentUserId]);

  // Follow-up tab toggle filter. Register tab: no toggle filter applied.
  //
  // CRM_FOLLOWUPS_V2: TWO independent toggle groups, and they COMPOSE — a row
  // renders only if it passes both.
  //   · entity type (status)      — Submitted tenders · Opportunities · Leads · Won & lost
  //   · next action (due-date)    — Overdue · Due soon · No next action · On track
  // Each group applies no filter at all when every toggle in it is off, so the
  // default Follow-ups view is unchanged: the three amber next-action toggles
  // on, On track off, and no entity-type narrowing.
  const tabFiltered = useMemo(() => {
    if (tab === "register") return clientFiltered;

    return clientFiltered.filter((t) => {
      if (!entityTypePassesFilter(t.status, entityTypeToggles)) return false;
      const cls = classifyNextAction(t.nextActionAt, now.current);
      return nextActionPassesFilter(cls, followUpToggles);
    });
  }, [clientFiltered, tab, followUpToggles, entityTypeToggles]);

  /**
   * CRM_FOLLOWUPS_V2: the four KPI cards.
   *
   * Derived from `tabFiltered` — the rows currently in scope for the active
   * filters, which is the exact array the list below renders (sorting reorders
   * it, it never changes its membership). The cards and the list therefore
   * cannot disagree: change a filter and both move together.
   */
  const kpis = useMemo(
    () => computeRegisterKpis(tabFiltered, now.current),
    [tabFiltered]
  );

  // Client-side sort.
  const sortedRows = useMemo(() => {
    if (!sortBy) return tabFiltered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...tabFiltered].sort((a, b) => sortCrmRow(a, b, sortBy) * dir);
  }, [tabFiltered, sortBy, sortDir]);

  const handleSort = (key: CrmColumnKey) => {
    setSortBy((prev) => {
      if (prev !== key) {
        setSortDir("asc");
        return key;
      }
      setSortDir((dir) => {
        if (dir === "asc") return "desc";
        // Third click clears sort.
        setSortBy(null);
        return "desc";
      });
      return key;
    });
  };

  const sortIndicator = (key: CrmColumnKey) => {
    if (sortBy !== key) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  // ---------------------------------------------------------------------------
  // Export CSV
  // ---------------------------------------------------------------------------

  const exportCsv = () => {
    if (!sortedRows.length) {
      setToast("No rows to export.");
      return;
    }
    if (
      truncated &&
      !window.confirm(
        `Showing ${sortedRows.length} of ${total} tenders (safety limit reached). Export loaded rows only?`
      )
    ) {
      return;
    }
    const csv = buildCrmRegisterCsv(sortedRows);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = truncated
      ? `IS_CRM_Tenders_${stamp}_${sortedRows.length}of${total}.csv`
      : `IS_CRM_Tenders_${stamp}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Log interaction
  // ---------------------------------------------------------------------------

  const handleLogSave = async (payload: LogPayload, tenderId: string) => {
    const resp = await authFetch("/crm/comms/log-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "TENDER",
        entityId: tenderId,
        subject: payload.subject,
        body: payload.body,
        nextActionAt: payload.nextActionAt ?? null,
        nextActionNote: payload.nextActionNote ?? null
      })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || "Failed to log interaction.");
    }
    setToast("Interaction logged.");
    // Reload to pick up updated interactions and next actions.
    void loadTenders(filters);
  };

  // ---------------------------------------------------------------------------
  // Saved views
  // ---------------------------------------------------------------------------

  const handleSaveView = () => {
    const name = viewNameInput.trim();
    if (!name) return;
    const view: SavedView = {
      id: `view-${Date.now()}`,
      name,
      filters,
      toggles: followUpToggles,
      tab
    };
    const updated = [...savedViews, view];
    setSavedViews(updated);
    persistSavedViews(updated);
    setViewNameInput("");
    setShowSaveView(false);
    setToast(`View "${name}" saved.`);
  };

  const handleApplyView = (view: SavedView) => {
    setFilters(view.filters);
    setFollowUpToggles(view.toggles);
    // CRM UIFIX S1: the tab now lives in the URL (outer TendersPage tab bar).
    // A saved view that carries a tab navigates the browser so the outer bar
    // updates in step with the filters. Falls back to /crm/register for the
    // default view.
    if (view.tab === "followups") {
      navigate("/crm/register?tab=follow-ups");
    } else if (tab !== "register") {
      navigate("/crm/register");
    }
  };

  const handleDeleteView = (id: string) => {
    const updated = savedViews.filter((v) => v.id !== id);
    setSavedViews(updated);
    persistSavedViews(updated);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // CRM_FOLLOWUPS_V2: Register keeps its own column set; Follow-ups adds the
  // Type chip column. One list, one row pipeline — only the header sequence
  // and one cell differ.
  const tabColumns = useMemo(() => columnsForTab(tab), [tab]);
  const visibleColumns = useMemo(
    () => visibleColumnsForTab(tab, columnVisibility),
    [tab, columnVisibility]
  );

  /** Style for a body cell: its own style, plus display:none when hidden. */
  const cellStyle = (
    id: RegisterColumnId,
    base?: React.CSSProperties
  ): React.CSSProperties | undefined => {
    if (columnVisibility[id]) return base;
    return { ...base, ...registerCellStyle.hiddenCell };
  };

  const toggleColumn = (id: RegisterColumnId) => {
    setColumnVisibility((prev) => {
      const next = normalizeColumnVisibility({ ...prev, [id]: !prev[id] });
      persistColumnVisibility(next);
      return next;
    });
  };

  const clientOptions = useMemo(() =>
    Array.from(
      new Map(
        tenders.flatMap((t) => t.tenderClients.map((tc) => [tc.client.id, tc.client.name]))
      ).entries()
    ).sort((a, b) => a[1].localeCompare(b[1])),
    [tenders]
  );

  return (
    <div style={{ padding: "24px 32px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 className="s7-type-page-title" style={{ margin: 0 }}>Tenders register</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted, #666)", fontSize: 13 }}>
          {tab === "register"
            ? "All tenders across all statuses."
            : "Tenders requiring follow-up action."}
        </p>
      </header>

      {/* CRM UIFIX S1: the inner Register/Follow-ups tablist that used to live
          here is gone. The outer TendersPage tab bar (?tab=register|follow-ups)
          drives which view renders — one tab bar per page, one URL contract.
          Removing this fixed the "two tab bars on Tenders" defect where the
          outer bar advertised an S8-empty-state stub for work already
          shipped in this page. */}

      {/* CRM_FOLLOWUPS_V2: the four KPI cards, above the toggle rows.
          Every figure is computed from the rows in scope for the active
          filters — no fetch, no endpoint — so the cards and the list beneath
          them can never disagree. */}
      {tab === "followups" && (
        <div
          className="s7-card-grid s7-card-grid--kpi"
          style={followUpsStyle.kpiRow}
          role="group"
          aria-label="Follow-ups summary"
        >
          <KpiCard label="Overdue" value={String(kpis.overdue)} />
          <KpiCard label="Due this week" value={String(kpis.dueThisWeek)} />
          <KpiCard label="Never logged" value={String(kpis.neverLogged)} />
          <KpiCard
            label="Value at risk"
            value={kpis.valueAtRisk === null ? EM_RULE : formatMoneyAUD(kpis.valueAtRisk)}
          />
        </div>
      )}

      {/* CRM_FOLLOWUPS_V2: the entity-type toggle group. A STATUS filter, and
          independent of the four next-action toggles below — the two groups
          compose. All four default off, i.e. no narrowing. */}
      {tab === "followups" && (
        <div style={followUpsStyle.toggleRow} role="group" aria-label="Entity type">
          <span style={followUpsStyle.toggleLabel}>Type:</span>
          {ENTITY_TYPES.map((def) => {
            const on = entityTypeToggles[def.id];
            return (
              <button
                key={def.id}
                type="button"
                onClick={() =>
                  setEntityTypeToggles((prev) => ({ ...prev, [def.id]: !prev[def.id] }))
                }
                aria-pressed={on}
                style={{
                  ...followUpsStyle.entityToggleBase,
                  ...(on ? followUpsStyle.entityToggleOn : followUpsStyle.entityToggleOff)
                }}
              >
                {def.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Follow-ups toggle row */}
      {tab === "followups" && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12,
            flexWrap: "wrap",
            alignItems: "center"
          }}
        >
          <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>Show:</span>
          {(
            [
              ["overdue", "Overdue"],
              ["dueSoon", "Due soon"],
              ["noNextAction", "No next action"],
              ["onTrack", "On track"]
            ] as Array<[keyof FollowUpToggles, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setFollowUpToggles((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              aria-pressed={followUpToggles[key]}
              style={{
                padding: "4px 10px",
                borderRadius: 12,
                border: "1px solid",
                fontSize: 12,
                cursor: "pointer",
                borderColor:
                  key === "onTrack"
                    ? followUpToggles[key]
                      ? "#22c55e"
                      : "#d1d5db"
                    : followUpToggles[key]
                    ? "#f59e0b"
                    : "#d1d5db",
                background:
                  key === "onTrack"
                    ? followUpToggles[key]
                      ? "#dcfce7"
                      : "transparent"
                    : followUpToggles[key]
                    ? "#fef3c7"
                    : "transparent",
                color:
                  key === "onTrack"
                    ? followUpToggles[key]
                      ? "#15803d"
                      : "#6b7280"
                    : followUpToggles[key]
                    ? "#92400e"
                    : "#6b7280"
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "#666", gap: 2 }}>
          Search
          <input
            type="search"
            placeholder="Tender # or title…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            aria-label="Search tenders"
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 34, minWidth: 200 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "#666", gap: 2 }}>
          Status
          <select
            value={filters.status[0] ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value ? [e.target.value] : [] }))
            }
            aria-label="Filter by status"
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 34 }}
          >
            <option value="">All statuses</option>
            {TENDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TENDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "#666", gap: 2 }}>
          Client
          <select
            value={filters.clientId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, clientId: e.target.value || null }))
            }
            aria-label="Filter by client"
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 34 }}
          >
            <option value="">All clients</option>
            {clientOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "#666", gap: 2 }}>
          Due from
          <input
            type="date"
            value={filters.dueDateFrom}
            onChange={(e) => setFilters((f) => ({ ...f, dueDateFrom: e.target.value }))}
            aria-label="Due date from"
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 34 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "#666", gap: 2 }}>
          Due to
          <input
            type="date"
            value={filters.dueDateTo}
            onChange={(e) => setFilters((f) => ({ ...f, dueDateTo: e.target.value }))}
            aria-label="Due date to"
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 34 }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "#666", gap: 2 }}>
          Estimator ID
          <input
            type="text"
            value={filters.estimatorId ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, estimatorId: e.target.value || null }))
            }
            placeholder="User ID"
            aria-label="Filter by estimator"
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 34, minWidth: 120 }}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            aria-label="Show mine only"
          />
          Mine only
        </label>

        {(filters.search ||
          filters.status.length ||
          filters.clientId ||
          filters.dueDateFrom ||
          filters.dueDateTo ||
          filters.estimatorId ||
          mineOnly) && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setMineOnly(false);
            }}
            style={ghostBtnStyle}
          >
            Clear filters
          </button>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666" }} aria-live="polite">
            {loading
              ? "Loading…"
              : `${sortedRows.length} shown${truncated ? ` of ${total} total` : ""}`}
          </span>
          <button type="button" onClick={exportCsv} style={ghostBtnStyle}>
            Export CSV
          </button>
          {/* CRM_REGISTER_V3: Columns picker (mock-up's filter-bar control). */}
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            style={ghostBtnStyle}
            aria-expanded={showColumns}
            aria-label="Choose visible columns"
          >
            Columns
          </button>
          <button type="button" onClick={() => setShowSaveView((v) => !v)} style={ghostBtnStyle}>
            Save view
          </button>
        </div>
      </div>

      {/* CRM_REGISTER_V3: Columns panel. The two anchor columns (Tender, Actions)
          are not hideable — a row with no identity and no action is not a row. */}
      {showColumns && (
        <div role="group" aria-label="Visible columns" style={registerCellStyle.columnsPanel}>
          {tabColumns.filter((col) => col.hideable).map((col) => (
            <label key={col.id} style={registerCellStyle.columnsCheckbox}>
              <input
                type="checkbox"
                checked={columnVisibility[col.id]}
                onChange={() => toggleColumn(col.id)}
                aria-label={`Show ${col.label} column`}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}

      {/* Save view panel */}
      {showSaveView && (
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <input
            type="text"
            placeholder="View name…"
            value={viewNameInput}
            onChange={(e) => setViewNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveView(); }}
            style={{ ...inputStyle, width: 200 }}
            aria-label="View name"
          />
          <button type="button" onClick={handleSaveView} style={primaryBtnStyle}>
            Save
          </button>
          <button type="button" onClick={() => setShowSaveView(false)} style={ghostBtnStyle}>
            Cancel
          </button>
          {savedViews.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: 8 }}>
              {savedViews.map((view) => (
                <span
                  key={view.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 12,
                    background: "#e0f2fe",
                    fontSize: 12,
                    color: "#0369a1"
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleApplyView(view)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 12, padding: 0 }}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteView(view.id)}
                    aria-label={`Delete view ${view.name}`}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 11, padding: "0 2px", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            color: "#dc2626",
            padding: 12,
            background: "#fef2f2",
            borderRadius: 6,
            marginBottom: 12
          }}
        >
          {error}
        </div>
      )}

      {toast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#1e293b",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 2000
          }}
        >
          {toast}
        </div>
      )}

      <div className="s7-table-scroll">
        <table className="s7-table">
          <thead>
            <tr>
              {/* CRM_REGISTER_V3: header sequence comes from the column model —
                  Tender | Client | Status | Value | Last interaction |
                  Logged by | Next action | Actions.
                  CRM_FOLLOWUPS_V2: on Follow-ups the same model inserts Type
                  after Tender. */}
              {tabColumns.map((col) => {
                const key: CrmColumnKey | null = col.sortKey;
                return (
                  <th
                    key={col.id}
                    onClick={key ? () => handleSort(key) : undefined}
                    style={{
                      ...(key ? { cursor: "pointer", userSelect: "none" } : null),
                      ...(col.align === "right" ? { textAlign: "right" } : null),
                      ...(columnVisibility[col.id] ? null : registerCellStyle.hiddenCell)
                    }}
                    aria-sort={
                      key && sortBy === key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : key
                        ? "none"
                        : undefined
                    }
                  >
                    {col.label}
                    {key ? sortIndicator(key) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {Array.from({ length: visibleColumns.length }).map((__, j) => (
                    <td key={j}><Skeleton height={14} /></td>
                  ))}
                </tr>
              ))
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length}>
                  <EmptyState
                    heading={
                      tab === "followups"
                        ? "No follow-ups match the active toggles"
                        : "No tenders match these filters"
                    }
                    subtext="Adjust filters or clear them to see more results."
                  />
                </td>
              </tr>
            ) : (
              sortedRows.map((t) => {
                const primaryClient = t.tenderClients[0]?.client.name ?? EM_RULE;
                const statusLabel = TENDER_STATUS_LABEL[t.status as TenderStatus] ?? t.status;
                const interaction = interactions.get(t.id) ?? null;
                // CRM_REGISTER_V3: the mock-up's "4 days ago" half. The channel
                // and the one-line summary are NOT rendered — see the NO-OPs at
                // the top of this file; the API sends neither.
                const lastInteractionLabel = formatRelativeTime(
                  interaction?.lastMessageAt ?? null,
                  now.current
                );
                const lastInteractionExact = interaction
                  ? new Date(interaction.lastMessageAt).toLocaleDateString()
                  : undefined;
                const submittedLabel = formatSubmittedLabel(t.submittedAt);
                // CRM_FOLLOWUPS_V2: derived from the SAME status groups as the
                // entity-type toggles. Null for a status no group claims
                // (WITHDRAWN) — that row shows the em-rule, not a made-up type.
                const typeLabel = entityTypeChipLabel(t.status);
                const valueLabel = formatMoneyAUD(t.estimatedValue);
                const loggedByLabel = interaction
                  ? `${interaction.loggedBy.firstName} ${interaction.loggedBy.lastName}`.trim()
                  : EM_RULE;
                const nextAction = nextActions.get(t.id) ?? null;
                const naClass = classifyNextAction(nextAction?.dueAt ?? null, now.current);
                const naLabel = nextAction
                  ? nextAction.dueAt
                    ? new Date(nextAction.dueAt).toLocaleDateString()
                    : nextAction.title
                  : EM_RULE;

                return (
                  <tr key={t.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/tenders/${t.id}`)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-primary, #005B61)", padding: 0, textDecoration: "underline", fontSize: "inherit" }}
                      >
                        {t.tenderNumber}
                      </button>
                      <div
                        style={registerCellStyle.tenderTitle}
                        onClick={() => navigate(`/tenders/${t.id}`)}
                      >
                        {t.title}
                      </div>
                      {submittedLabel && (
                        <div style={registerCellStyle.tenderSubLine}>{submittedLabel}</div>
                      )}
                    </td>
                    {tab === "followups" && (
                      <td style={cellStyle("type")} aria-label={`Type: ${typeLabel ?? EM_RULE}`}>
                        {typeLabel ? (
                          <span style={followUpsStyle.typeChip}>{typeLabel}</span>
                        ) : (
                          EM_RULE
                        )}
                      </td>
                    )}
                    <td style={cellStyle("client")}>{primaryClient}</td>
                    <td style={cellStyle("status")}>{statusLabel}</td>
                    <td
                      style={cellStyle("value", registerCellStyle.money)}
                      aria-label={`Value: ${valueLabel}`}
                    >
                      {valueLabel}
                    </td>
                    <td
                      style={cellStyle("lastInteraction")}
                      aria-label={`Last interaction: ${lastInteractionLabel}`}
                    >
                      <span style={registerCellStyle.relativeTime} title={lastInteractionExact}>
                        {lastInteractionLabel}
                      </span>
                    </td>
                    <td style={cellStyle("loggedBy")} aria-label={`Logged by: ${loggedByLabel}`}>{loggedByLabel}</td>
                    <td style={cellStyle("nextAction")} aria-label={`Next action: ${naLabel}`}>
                      <span>
                        {nextAction ? (
                          <>
                            {naClass === "overdue" && (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginRight: 4,
                                  padding: "1px 6px",
                                  borderRadius: 10,
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                  fontSize: 11,
                                  fontWeight: 600
                                }}
                                aria-label="overdue"
                              >
                                Overdue
                              </span>
                            )}
                            {naClass === "due_soon" && (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginRight: 4,
                                  padding: "1px 6px",
                                  borderRadius: 10,
                                  background: "#fef3c7",
                                  color: "#92400e",
                                  fontSize: 11,
                                  fontWeight: 600
                                }}
                                aria-label="due soon"
                              >
                                Due soon
                              </span>
                            )}
                            {naLabel}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setLogTarget(t)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          background: "transparent",
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                        aria-label={`Log interaction for ${t.tenderNumber}`}
                      >
                        Log
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {logTarget && (
        <LogModal
          tender={logTarget}
          onClose={() => setLogTarget(null)}
          onSave={(payload) => handleLogSave(payload, logTarget.id)}
        />
      )}
    </div>
  );
}
