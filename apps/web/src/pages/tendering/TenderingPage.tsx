import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type TenderListItem = {
  id: string;
  tenderNumber: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: string | null;
  estimatedValue?: string | null;
  probability?: number | null;
  createdAt: string;
  updatedAt: string;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    id: string;
    clientId: string;
    client: { id: string; name: string };
  }>;
};

type TenderListResponse = {
  items: TenderListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type UserOption = { id: string; firstName: string; lastName: string };
type ClientOption = { id: string; name: string };

type ProbabilityBucket = "Hot" | "Warm" | "Cold";

type FilterPreset = {
  id: string;
  name: string;
  filters: Filters;
  isDefault: boolean;
};

type Filters = {
  search: string;
  status: string[];
  estimatorId: string | null;
  clientId: string | null;
  probability: ProbabilityBucket[];
  valueMin: string;
  valueMax: string;
  dueDateFrom: string;
  dueDateTo: string;
  discipline: string[];
  sortBy: string | null;
  sortDir: "asc" | "desc";
};

const EMPTY_FILTERS: Filters = {
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

const STAGES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "LOST", "WITHDRAWN"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  DRAFT: "Identified",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  LOST: "Lost",
  WITHDRAWN: "Withdrawn"
};

const STAGE_ACCENT: Record<Stage, string> = {
  DRAFT: "var(--status-neutral, #6B7280)",
  IN_PROGRESS: "var(--status-info, #3B82F6)",
  SUBMITTED: "var(--status-warning, #F59E0B)",
  AWARDED: "var(--status-active, #005B61)",
  LOST: "var(--status-danger, #EF4444)",
  WITHDRAWN: "var(--text-muted, #9CA3AF)"
};

const PROBABILITY_BUCKETS: ProbabilityBucket[] = ["Hot", "Warm", "Cold"];
const PROBABILITY_COLOR: Record<ProbabilityBucket, string> = {
  Hot: "#FEAA6D",
  Warm: "#FED7AA",
  Cold: "#E2E8F0"
};

const DISCIPLINES = ["SO", "Str", "Asb", "Civ", "Prv"] as const;
type Discipline = (typeof DISCIPLINES)[number];

type ColumnKey =
  | "tenderNumber"
  | "name"
  | "client"
  | "estimator"
  | "status"
  | "probability"
  | "value"
  | "dueDate"
  | "daysUntilDue"
  | "createdAt";

const COLUMN_LABEL: Record<ColumnKey, string> = {
  tenderNumber: "Tender #",
  name: "Name",
  client: "Client",
  estimator: "Estimator",
  status: "Status",
  probability: "Probability",
  value: "Value",
  dueDate: "Due date",
  daysUntilDue: "Days until due",
  createdAt: "Created"
};

const ALWAYS_VISIBLE: ColumnKey[] = ["tenderNumber", "name"];
const DEFAULT_COLUMNS: ColumnKey[] = [
  "tenderNumber",
  "name",
  "client",
  "status",
  "probability",
  "value",
  "dueDate"
];
const ALL_COLUMNS: ColumnKey[] = [
  "tenderNumber",
  "name",
  "client",
  "estimator",
  "status",
  "probability",
  "value",
  "dueDate",
  "daysUntilDue",
  "createdAt"
];
const COLUMN_STORAGE_KEY = "tenders-register-columns:v1";

const SORTABLE_COLUMNS: ColumnKey[] = [
  "tenderNumber",
  "name",
  "client",
  "estimator",
  "status",
  "probability",
  "value",
  "dueDate",
  "createdAt"
];

type View = "pipeline" | "register";

function probabilityToBucket(value: number | null | undefined): ProbabilityBucket | null {
  if (value === null || value === undefined) return null;
  if (value >= 70) return "Hot";
  if (value >= 30) return "Warm";
  return "Cold";
}

function initials(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return "??";
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

function daysSince(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - then) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function daysUntil(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Math.ceil((then - Date.now()) / (24 * 60 * 60 * 1000));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "today";
  if (diff === 1) return "1 day";
  return `${diff} days`;
}

function formatCurrency(raw?: string | number | null): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const value = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(value)) return String(raw);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

function loadColumns(): ColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;
    const filtered = parsed.filter((key): key is ColumnKey =>
      ALL_COLUMNS.includes(key as ColumnKey)
    );
    const withAlways = Array.from(new Set([...ALWAYS_VISIBLE, ...filtered]));
    return withAlways.length ? withAlways : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function saveColumns(columns: ColumnKey[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // ignore
  }
}

function buildQueryString(filters: Filters, pageSize: number): string {
  const params = new URLSearchParams();
  params.set("page", "1");
  params.set("pageSize", String(pageSize));
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status.length) params.set("status", filters.status.join(","));
  if (filters.estimatorId) params.set("estimatorId", filters.estimatorId);
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.probability.length === 1) params.set("probability", filters.probability[0]);
  if (filters.valueMin) params.set("valueMin", filters.valueMin);
  if (filters.valueMax) params.set("valueMax", filters.valueMax);
  if (filters.dueDateFrom) params.set("dueDateFrom", filters.dueDateFrom);
  if (filters.dueDateTo) params.set("dueDateTo", filters.dueDateTo);
  if (filters.discipline.length === 1) params.set("discipline", filters.discipline[0]);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortBy) params.set("sortDir", filters.sortDir);
  return params.toString();
}

function isFilterActive(filters: Filters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status.length > 0 ||
    filters.estimatorId !== null ||
    filters.clientId !== null ||
    filters.probability.length > 0 ||
    filters.valueMin !== "" ||
    filters.valueMax !== "" ||
    filters.dueDateFrom !== "" ||
    filters.dueDateTo !== "" ||
    filters.discipline.length > 0
  );
}

function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.search === b.search &&
    a.estimatorId === b.estimatorId &&
    a.clientId === b.clientId &&
    a.valueMin === b.valueMin &&
    a.valueMax === b.valueMax &&
    a.dueDateFrom === b.dueDateFrom &&
    a.dueDateTo === b.dueDateTo &&
    a.sortBy === b.sortBy &&
    a.sortDir === b.sortDir &&
    a.status.length === b.status.length &&
    a.status.every((s) => b.status.includes(s)) &&
    a.probability.length === b.probability.length &&
    a.probability.every((p) => b.probability.includes(p)) &&
    a.discipline.length === b.discipline.length &&
    a.discipline.every((d) => b.discipline.includes(d))
  );
}

export function TenderingPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("pipeline");
  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const defaultAppliedRef = useRef(false);

  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadColumns());
  const [users, setUsers] = useState<UserOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [quickEditTarget, setQuickEditTarget] = useState<TenderListItem | null>(null);
  const canManage = user?.permissions.includes("tenders.manage") ?? false;

  const canUseView: View = view;

  const reload = useCallback(
    async (withFilters: Filters) => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildQueryString(withFilters, 500);
        const response = await authFetch(`/tenders?${qs}`);
        if (!response.ok) throw new Error("Could not load tenders.");
        const data = (await response.json()) as TenderListResponse;
        setTenders(data.items);
        setTotal(data.total);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [authFetch]
  );

  // Load presets + users + clients once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [presetsResp, usersResp, clientsResp] = await Promise.all([
          authFetch("/tenders/filter-presets"),
          authFetch("/users?page=1&pageSize=100"),
          authFetch("/master-data/clients?page=1&pageSize=200")
        ]);
        if (cancelled) return;
        if (presetsResp.ok) {
          const body = (await presetsResp.json()) as FilterPreset[];
          setPresets(body);
          const defaultPreset = body.find((p) => p.isDefault);
          if (defaultPreset && !defaultAppliedRef.current) {
            defaultAppliedRef.current = true;
            setFilters({ ...EMPTY_FILTERS, ...defaultPreset.filters });
          }
        }
        setPresetsLoaded(true);
        if (usersResp.ok) {
          const body = await usersResp.json();
          const items = (body.items ?? body) as UserOption[];
          setUsers(items);
        }
        if (clientsResp.ok) {
          const body = await clientsResp.json();
          const items = (body.items ?? body) as ClientOption[];
          setClients(items);
        }
      } catch {
        if (!cancelled) setPresetsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Reload tenders whenever filters change (and presets have been loaded so
  // we don't double-load with the default preset).
  useEffect(() => {
    if (!presetsLoaded) return;
    void reload(filters);
    setSelectedIds([]);
  }, [presetsLoaded, filters, reload]);

  const byStage = useMemo(() => {
    const groups: Record<Stage, TenderListItem[]> = {
      DRAFT: [],
      IN_PROGRESS: [],
      SUBMITTED: [],
      AWARDED: [],
      LOST: [],
      WITHDRAWN: []
    };
    for (const tender of tenders) {
      if ((STAGES as readonly string[]).includes(tender.status)) {
        groups[tender.status as Stage].push(tender);
      }
    }
    return groups;
  }, [tenders]);

  const registerRows = useMemo(() => {
    // Server-side filters already applied. Client-side: probability bucket
    // multi-select (API only supports one) and discipline multi-select.
    let rows = tenders;
    if (filters.probability.length > 1) {
      rows = rows.filter((t) => {
        const bucket = probabilityToBucket(t.probability);
        return bucket !== null && filters.probability.includes(bucket);
      });
    }
    // Client-side sort only if <=100 items (otherwise trust server sort).
    if (rows.length <= 100 && filters.sortBy) {
      const dir = filters.sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => sortCompare(a, b, filters.sortBy as ColumnKey) * dir);
    }
    return rows;
  }, [tenders, filters.probability, filters.sortBy, filters.sortDir]);

  const stats = useMemo(() => {
    const pipeline = registerRows.reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);
    const won = registerRows.filter((t) => t.status === "AWARDED" || t.status === "CONTRACT_ISSUED" || t.status === "CONVERTED").length;
    const decided = registerRows.filter((t) => ["AWARDED", "CONTRACT_ISSUED", "CONVERTED", "LOST"].includes(t.status)).length;
    const winRate = decided ? (won / decided) * 100 : null;
    const avg = registerRows.length ? pipeline / registerRows.length : 0;
    return { count: total, visible: registerRows.length, pipeline, winRate, avg };
  }, [registerRows, total]);

  const moveTender = async (tenderId: string, toStage: Stage) => {
    setTenders((current) =>
      current.map((tender) => (tender.id === tenderId ? { ...tender, status: toStage } : tender))
    );
    try {
      const response = await authFetch(`/tenders/${tenderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: toStage })
      });
      if (!response.ok) throw new Error("Could not update tender stage.");
    } catch (err) {
      setError((err as Error).message);
      void reload(filters);
    }
  };

  const toggleSort = (key: ColumnKey) => {
    if (!SORTABLE_COLUMNS.includes(key)) return;
    setFilters((current) => {
      if (current.sortBy !== key) return { ...current, sortBy: key, sortDir: "asc" };
      if (current.sortDir === "asc") return { ...current, sortDir: "desc" };
      return { ...current, sortBy: null, sortDir: "desc" };
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]
    );
  };

  const toggleAllVisible = () => {
    const visibleIds = registerRows.map((t) => t.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visibleIds);
  };

  const bulkChangeStatus = async (status: Stage) => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      const response = await authFetch("/tenders/bulk-status", {
        method: "POST",
        body: JSON.stringify({ tenderIds: selectedIds, status })
      });
      if (!response.ok) throw new Error(await response.text());
      const body = await response.json();
      setToast(`${body.updated} tenders updated to ${STAGE_LABEL[status]}`);
      setSelectedIds([]);
      await reload(filters);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBulkBusy(false);
    }
  };

  const exportSelectedCsv = () => {
    const selected = registerRows.filter((t) => selectedIds.includes(t.id));
    if (!selected.length) return;
    const header = ["Tender #", "Name", "Client", "Status", "Value", "Estimator", "Due date"];
    const rows = selected.map((t) => [
      t.tenderNumber,
      t.title,
      t.tenderClients.map((tc) => tc.client.name).join("; "),
      t.status,
      t.estimatedValue ?? "",
      t.estimator ? `${t.estimator.firstName} ${t.estimator.lastName}` : "",
      t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : ""
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `IS_Tenders_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const applyPreset = (preset: FilterPreset) => {
    setFilters({ ...EMPTY_FILTERS, ...preset.filters });
  };

  const savePreset = async (name: string, isDefault: boolean) => {
    try {
      const response = await authFetch("/tenders/filter-presets", {
        method: "POST",
        body: JSON.stringify({ name, filters, isDefault })
      });
      if (!response.ok) throw new Error(await response.text());
      const created = (await response.json()) as FilterPreset;
      setPresets((current) => [...current.map((p) => (isDefault ? { ...p, isDefault: false } : p)), created]);
      setToast(`Preset "${name}" saved`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deletePreset = async (id: string) => {
    if (!window.confirm("Delete this filter preset?")) return;
    try {
      const response = await authFetch(`/tenders/filter-presets/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      setPresets((current) => current.filter((p) => p.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onColumnsChange = (columns: ColumnKey[]) => {
    const withAlways = Array.from(new Set([...ALWAYS_VISIBLE, ...columns]));
    setVisibleColumns(withAlways);
    saveColumns(withAlways);
  };

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const onQuickEditSaved = (updated: TenderListItem) => {
    setTenders((current) => current.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    setToast("Tender updated");
    setQuickEditTarget(null);
  };

  return (
    <div className="tender-page">
      <header className="tender-page__header">
        <div>
          <p className="s7-type-label">Tendering</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Pipeline</h1>
        </div>
        <div className="tender-page__header-actions">
          <div className="tender-page__view-toggle" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={canUseView === "pipeline"}
              className={canUseView === "pipeline" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("pipeline")}
            >
              Pipeline
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={canUseView === "register"}
              className={canUseView === "register" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("register")}
            >
              Register
            </button>
          </div>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => setNewOpen(true)}
          >
            + New tender
          </button>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}
      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0F172A",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            zIndex: 60,
            fontSize: 13
          }}
        >
          {toast}
        </div>
      ) : null}

      {view === "pipeline" ? (
        <div className="tender-kanban">
          {STAGES.map((stage) => {
            const items = byStage[stage];
            const stageTotal = items.reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0), 0);
            return (
              <KanbanColumn
                key={stage}
                stage={stage}
                items={items}
                total={stageTotal}
                loading={loading}
                onDrop={moveTender}
                onOpen={(id) => navigate(`/tenders/${id}`)}
              />
            );
          })}
        </div>
      ) : (
        <RegisterView
          loading={loading}
          tenders={registerRows}
          stats={stats}
          filters={filters}
          onFiltersChange={setFilters}
          presets={presets}
          onApplyPreset={applyPreset}
          onSavePreset={savePreset}
          onDeletePreset={deletePreset}
          users={users}
          clients={clients}
          visibleColumns={visibleColumns}
          onColumnsChange={onColumnsChange}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
          onToggleAll={toggleAllVisible}
          onClearSelection={() => setSelectedIds([])}
          onBulkStatus={bulkChangeStatus}
          onExportCsv={exportSelectedCsv}
          bulkBusy={bulkBusy}
          canManage={canManage}
          onSort={toggleSort}
          onOpen={(id) => navigate(`/tenders/${id}`)}
          onQuickEdit={(t) => setQuickEditTarget(t)}
          onNewTender={() => setNewOpen(true)}
        />
      )}

      <NewTenderSlideOver
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setNewOpen(false);
          void reload(filters);
          navigate(`/tenders/${id}`);
        }}
      />

      {quickEditTarget ? (
        <QuickEditModal
          tender={quickEditTarget}
          users={users}
          onClose={() => setQuickEditTarget(null)}
          onSaved={onQuickEditSaved}
        />
      ) : null}
    </div>
  );
}

function sortCompare(a: TenderListItem, b: TenderListItem, key: ColumnKey): number {
  switch (key) {
    case "tenderNumber":
      return a.tenderNumber.localeCompare(b.tenderNumber);
    case "name":
      return a.title.localeCompare(b.title);
    case "client": {
      const aClient = a.tenderClients[0]?.client.name ?? "";
      const bClient = b.tenderClients[0]?.client.name ?? "";
      return aClient.localeCompare(bClient);
    }
    case "estimator": {
      const aName = a.estimator ? `${a.estimator.firstName} ${a.estimator.lastName}` : "";
      const bName = b.estimator ? `${b.estimator.firstName} ${b.estimator.lastName}` : "";
      return aName.localeCompare(bName);
    }
    case "status":
      return a.status.localeCompare(b.status);
    case "probability":
      return (a.probability ?? 0) - (b.probability ?? 0);
    case "value":
      return Number(a.estimatedValue ?? 0) - Number(b.estimatedValue ?? 0);
    case "dueDate": {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return aDate - bDate;
    }
    case "createdAt":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    default:
      return 0;
  }
}

type RegisterViewProps = {
  loading: boolean;
  tenders: TenderListItem[];
  stats: { count: number; visible: number; pipeline: number; winRate: number | null; avg: number };
  filters: Filters;
  onFiltersChange: (next: Filters) => void;
  presets: FilterPreset[];
  onApplyPreset: (preset: FilterPreset) => void;
  onSavePreset: (name: string, isDefault: boolean) => void;
  onDeletePreset: (id: string) => void;
  users: UserOption[];
  clients: ClientOption[];
  visibleColumns: ColumnKey[];
  onColumnsChange: (columns: ColumnKey[]) => void;
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  onClearSelection: () => void;
  onBulkStatus: (status: Stage) => void;
  onExportCsv: () => void;
  bulkBusy: boolean;
  canManage: boolean;
  onSort: (key: ColumnKey) => void;
  onOpen: (id: string) => void;
  onQuickEdit: (tender: TenderListItem) => void;
  onNewTender: () => void;
};

function RegisterView(props: RegisterViewProps) {
  const {
    loading,
    tenders,
    stats,
    filters,
    onFiltersChange,
    presets,
    onApplyPreset,
    onSavePreset,
    onDeletePreset,
    users,
    clients,
    visibleColumns,
    onColumnsChange,
    selectedIds,
    onToggleSelected,
    onToggleAll,
    onClearSelection,
    onBulkStatus,
    onExportCsv,
    bulkBusy,
    canManage,
    onSort,
    onOpen,
    onQuickEdit,
    onNewTender
  } = props;

  const [advancedOpen, setAdvancedOpen] = useState(
    filters.valueMin !== "" ||
      filters.valueMax !== "" ||
      filters.dueDateFrom !== "" ||
      filters.dueDateTo !== "" ||
      filters.discipline.length > 0 ||
      filters.clientId !== null
  );
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  const visibleSelectedCount = tenders.filter((t) => selectedIds.includes(t.id)).length;
  const allVisibleSelected = tenders.length > 0 && visibleSelectedCount === tenders.length;

  return (
    <div className="tender-register">
      <StatsBar stats={stats} />

      <FilterBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        users={users}
        clients={clients}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen((p) => !p)}
        presets={presets}
        onApplyPreset={onApplyPreset}
        onDeletePreset={onDeletePreset}
        savePresetOpen={savePresetOpen}
        onOpenSavePreset={() => setSavePresetOpen(true)}
        onCloseSavePreset={() => setSavePresetOpen(false)}
        onSavePreset={(name, isDefault) => {
          onSavePreset(name, isDefault);
          setSavePresetOpen(false);
        }}
      />

      <ActiveFilterPills filters={filters} onFiltersChange={onFiltersChange} users={users} clients={clients} />

      <div style={{ display: "flex", justifyContent: "flex-end", position: "relative", marginBottom: 8 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          aria-label="Choose columns"
          onClick={() => setColumnsPopoverOpen((p) => !p)}
        >
          ⚙ Columns
        </button>
        {columnsPopoverOpen ? (
          <ColumnsPopover
            visibleColumns={visibleColumns}
            onChange={onColumnsChange}
            onClose={() => setColumnsPopoverOpen(false)}
          />
        ) : null}
      </div>

      <div className="s7-table-scroll">
        <table className="s7-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={allVisibleSelected}
                  onChange={onToggleAll}
                />
              </th>
              {visibleColumns.map((key) => (
                <th key={key}>
                  {SORTABLE_COLUMNS.includes(key) ? (
                    <button
                      type="button"
                      className="tender-register__th-btn"
                      onClick={() => onSort(key)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", font: "inherit" }}
                    >
                      {COLUMN_LABEL[key]}{" "}
                      {filters.sortBy === key ? (filters.sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  ) : (
                    COLUMN_LABEL[key]
                  )}
                </th>
              ))}
              {canManage ? <th style={{ width: 36 }} aria-label="Row actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`row-skel-${index}`}>
                  <td><Skeleton height={14} /></td>
                  {visibleColumns.map((key) => (
                    <td key={key}><Skeleton height={14} /></td>
                  ))}
                  {canManage ? <td /> : null}
                </tr>
              ))
            ) : tenders.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (canManage ? 2 : 1)}>
                  <EmptyState
                    heading="No tenders match these filters"
                    subtext="Adjust filters or clear them to see more results."
                    action={
                      isFilterActive(filters) ? (
                        <button
                          type="button"
                          className="s7-btn s7-btn--secondary"
                          onClick={() => onFiltersChange(EMPTY_FILTERS)}
                        >
                          Clear all filters
                        </button>
                      ) : (
                        <button type="button" className="s7-btn s7-btn--primary" onClick={onNewTender}>
                          + New tender
                        </button>
                      )
                    }
                  />
                </td>
              </tr>
            ) : (
              tenders.map((tender) => (
                <RegisterRow
                  key={tender.id}
                  tender={tender}
                  visibleColumns={visibleColumns}
                  selected={selectedIds.includes(tender.id)}
                  onToggleSelected={() => onToggleSelected(tender.id)}
                  onOpen={() => onOpen(tender.id)}
                  onQuickEdit={() => onQuickEdit(tender)}
                  canManage={canManage}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedIds.length > 0 ? (
        <BulkActionBar
          count={selectedIds.length}
          onClear={onClearSelection}
          onStatusChange={onBulkStatus}
          onExportCsv={onExportCsv}
          busy={bulkBusy}
          canManage={canManage}
        />
      ) : null}
    </div>
  );
}

function StatsBar({ stats }: { stats: RegisterViewProps["stats"] }) {
  return (
    <div
      className="s7-card"
      style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 12, marginBottom: 12, fontSize: 13 }}
    >
      <StatPill label="Total" value={String(stats.count)} />
      <StatPill label="Active pipeline" value={formatCurrency(stats.pipeline)} />
      <StatPill
        label="Win rate"
        value={stats.winRate !== null ? `${stats.winRate.toFixed(0)}%` : "—"}
      />
      <StatPill label="Avg value" value={formatCurrency(stats.avg)} />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 120 }}>
      <p className="s7-type-label" style={{ margin: 0 }}>{label}</p>
      <strong style={{ fontSize: 16 }}>{value}</strong>
    </div>
  );
}

type FilterBarProps = {
  filters: Filters;
  onFiltersChange: (next: Filters) => void;
  users: UserOption[];
  clients: ClientOption[];
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  presets: FilterPreset[];
  onApplyPreset: (preset: FilterPreset) => void;
  onDeletePreset: (id: string) => void;
  savePresetOpen: boolean;
  onOpenSavePreset: () => void;
  onCloseSavePreset: () => void;
  onSavePreset: (name: string, isDefault: boolean) => void;
};

function FilterBar(props: FilterBarProps) {
  const { filters, onFiltersChange, users, clients, advancedOpen, onToggleAdvanced, presets } = props;

  const update = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });
  const toggleArray = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
      {/* Row 1 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          className="s7-input"
          placeholder="Search number, title, or client"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          style={{ flex: "1 1 260px" }}
        />
        <select
          className="s7-select"
          value={filters.status.length === 1 ? filters.status[0] : ""}
          onChange={(e) => update({ status: e.target.value ? [e.target.value] : [] })}
        >
          <option value="">All statuses</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABEL[s]}</option>
          ))}
        </select>
        <select
          className="s7-select"
          value={filters.estimatorId ?? ""}
          onChange={(e) => update({ estimatorId: e.target.value || null })}
        >
          <option value="">Any estimator</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
          ))}
        </select>
        <div style={{ display: "inline-flex", gap: 4 }}>
          {PROBABILITY_BUCKETS.map((b) => {
            const active = filters.probability.includes(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => update({ probability: toggleArray(filters.probability, b) })}
                className="s7-btn s7-btn--sm"
                style={{
                  background: active ? PROBABILITY_COLOR[b] : "transparent",
                  color: active ? "#3E1C00" : "var(--text-default)",
                  border: `1px solid ${active ? PROBABILITY_COLOR[b] : "var(--border-default)"}`,
                  padding: "2px 10px"
                }}
                aria-pressed={active}
              >
                {b}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onToggleAdvanced}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? "Fewer filters" : "More filters"}
        </button>
        <div style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center" }}>
          {presets.length ? <PresetDropdown {...props} /> : null}
          {isFilterActive(filters) ? (
            <SavePresetButton {...props} />
          ) : null}
        </div>
      </div>

      {/* Row 2 — advanced */}
      {advancedOpen ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            padding: 10,
            background: "var(--surface-subtle, rgba(0,0,0,0.02))",
            borderRadius: 8
          }}
        >
          <select
            className="s7-select"
            value={filters.clientId ?? ""}
            onChange={(e) => update({ clientId: e.target.value || null })}
          >
            <option value="">Any client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            Min $
            <input
              className="s7-input s7-input--sm"
              type="number"
              min="0"
              value={filters.valueMin}
              onChange={(e) => update({ valueMin: e.target.value })}
              style={{ width: 100 }}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            Max $
            <input
              className="s7-input s7-input--sm"
              type="number"
              min="0"
              value={filters.valueMax}
              onChange={(e) => update({ valueMax: e.target.value })}
              style={{ width: 100 }}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            Due from
            <input
              className="s7-input s7-input--sm"
              type="date"
              value={filters.dueDateFrom}
              onChange={(e) => update({ dueDateFrom: e.target.value })}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            Due to
            <input
              className="s7-input s7-input--sm"
              type="date"
              value={filters.dueDateTo}
              onChange={(e) => update({ dueDateTo: e.target.value })}
            />
          </label>
          <div style={{ display: "inline-flex", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", marginRight: 4 }}>Discipline:</span>
            {DISCIPLINES.map((d) => {
              const active = filters.discipline.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    update({ discipline: toggleArray(filters.discipline as Discipline[], d) })
                  }
                  className="s7-btn s7-btn--sm"
                  style={{
                    background: active ? "var(--brand-primary, #005B61)" : "transparent",
                    color: active ? "white" : "var(--text-default)",
                    border: `1px solid ${active ? "var(--brand-primary, #005B61)" : "var(--border-default)"}`,
                    padding: "2px 10px"
                  }}
                  aria-pressed={active}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PresetDropdown(props: FilterBarProps) {
  const { presets, onApplyPreset, onDeletePreset } = props;
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        Presets ▾
      </button>
      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "white",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            minWidth: 220,
            zIndex: 40
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {presets.map((preset) => (
            <div
              key={preset.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.06))"
              }}
            >
              <button
                type="button"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "inherit", fontSize: 13 }}
                onClick={() => {
                  onApplyPreset(preset);
                  setOpen(false);
                }}
              >
                {preset.name}
                {preset.isDefault ? (
                  <span style={{ fontSize: 10, marginLeft: 6, color: "var(--text-muted)" }}>(default)</span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label={`Delete preset ${preset.name}`}
                onClick={() => onDeletePreset(preset.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SavePresetButton(props: FilterBarProps) {
  const { savePresetOpen, onOpenSavePreset, onCloseSavePreset, onSavePreset } = props;
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  useEffect(() => {
    if (savePresetOpen) {
      setName("");
      setIsDefault(false);
    }
  }, [savePresetOpen]);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="s7-btn s7-btn--secondary s7-btn--sm"
        onClick={onOpenSavePreset}
      >
        Save filter
      </button>
      {savePresetOpen ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "white",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 10,
            minWidth: 240,
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <input
            autoFocus
            className="s7-input s7-input--sm"
            placeholder="Preset name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Set as default
          </label>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onCloseSavePreset}>Cancel</button>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={!name.trim()}
              onClick={() => onSavePreset(name.trim(), isDefault)}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActiveFilterPills({
  filters,
  onFiltersChange,
  users,
  clients
}: {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  users: UserOption[];
  clients: ClientOption[];
}) {
  if (!isFilterActive(filters)) return null;
  const pills: Array<{ label: string; onClear: () => void }> = [];
  if (filters.search.trim()) {
    pills.push({ label: `Search: "${filters.search}"`, onClear: () => onFiltersChange({ ...filters, search: "" }) });
  }
  if (filters.status.length) {
    pills.push({
      label: `Status: ${filters.status.map((s) => STAGE_LABEL[s as Stage] ?? s).join(", ")}`,
      onClear: () => onFiltersChange({ ...filters, status: [] })
    });
  }
  if (filters.estimatorId) {
    const user = users.find((u) => u.id === filters.estimatorId);
    pills.push({
      label: `Estimator: ${user ? `${user.firstName} ${user.lastName}` : filters.estimatorId}`,
      onClear: () => onFiltersChange({ ...filters, estimatorId: null })
    });
  }
  if (filters.clientId) {
    const client = clients.find((c) => c.id === filters.clientId);
    pills.push({
      label: `Client: ${client ? client.name : filters.clientId}`,
      onClear: () => onFiltersChange({ ...filters, clientId: null })
    });
  }
  if (filters.probability.length) {
    pills.push({
      label: `Probability: ${filters.probability.join(", ")}`,
      onClear: () => onFiltersChange({ ...filters, probability: [] })
    });
  }
  if (filters.valueMin) {
    pills.push({ label: `Min value: ${formatCurrency(filters.valueMin)}`, onClear: () => onFiltersChange({ ...filters, valueMin: "" }) });
  }
  if (filters.valueMax) {
    pills.push({ label: `Max value: ${formatCurrency(filters.valueMax)}`, onClear: () => onFiltersChange({ ...filters, valueMax: "" }) });
  }
  if (filters.dueDateFrom) {
    pills.push({ label: `Due from: ${filters.dueDateFrom}`, onClear: () => onFiltersChange({ ...filters, dueDateFrom: "" }) });
  }
  if (filters.dueDateTo) {
    pills.push({ label: `Due to: ${filters.dueDateTo}`, onClear: () => onFiltersChange({ ...filters, dueDateTo: "" }) });
  }
  if (filters.discipline.length) {
    pills.push({
      label: `Discipline: ${filters.discipline.join(", ")}`,
      onClear: () => onFiltersChange({ ...filters, discipline: [] })
    });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, alignItems: "center" }}>
      {pills.map((pill, index) => (
        <span
          key={index}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 999,
            background: "var(--surface-subtle, rgba(0,0,0,0.05))",
            fontSize: 12
          }}
        >
          {pill.label}
          <button
            type="button"
            aria-label="Clear filter"
            onClick={pill.onClear}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "var(--text-muted)" }}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onFiltersChange({ ...EMPTY_FILTERS, sortBy: filters.sortBy, sortDir: filters.sortDir })}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--brand-primary, #005B61)",
          textDecoration: "underline"
        }}
      >
        Clear all
      </button>
    </div>
  );
}

function ColumnsPopover({
  visibleColumns,
  onChange,
  onClose
}: {
  visibleColumns: ColumnKey[];
  onChange: (columns: ColumnKey[]) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        right: 0,
        background: "white",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: 10,
        minWidth: 200,
        zIndex: 40
      }}
      onMouseLeave={onClose}
    >
      <p className="s7-type-label" style={{ margin: "0 0 6px" }}>Columns</p>
      {ALL_COLUMNS.map((key) => {
        const disabled = ALWAYS_VISIBLE.includes(key);
        const checked = visibleColumns.includes(key);
        return (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "2px 0",
              fontSize: 13,
              opacity: disabled ? 0.6 : 1
            }}
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={checked}
              onChange={(e) => {
                if (disabled) return;
                const next = e.target.checked
                  ? [...visibleColumns, key]
                  : visibleColumns.filter((k) => k !== key);
                onChange(next);
              }}
            />
            {COLUMN_LABEL[key]}
          </label>
        );
      })}
    </div>
  );
}

function RegisterRow({
  tender,
  visibleColumns,
  selected,
  onToggleSelected,
  onOpen,
  onQuickEdit,
  canManage
}: {
  tender: TenderListItem;
  visibleColumns: ColumnKey[];
  selected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
  onQuickEdit: () => void;
  canManage: boolean;
}) {
  const clients = tender.tenderClients.map((tc) => tc.client.name).join(", ") || "—";
  const [hover, setHover] = useState(false);

  const renderCell = (key: ColumnKey) => {
    switch (key) {
      case "tenderNumber":
        return <strong>{tender.tenderNumber}</strong>;
      case "name":
        return tender.title;
      case "client":
        return clients;
      case "estimator":
        return tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : "—";
      case "status": {
        const accent = STAGE_ACCENT[tender.status as Stage] ?? "#6B7280";
        const label = STAGE_LABEL[tender.status as Stage] ?? tender.status;
        return (
          <span
            className="s7-badge"
            style={{
              background: `color-mix(in srgb, ${accent} 15%, transparent)`,
              color: accent
            }}
          >
            {label}
          </span>
        );
      }
      case "probability": {
        const bucket = probabilityToBucket(tender.probability);
        if (!bucket) return "—";
        return (
          <span
            className="s7-badge"
            style={{ background: PROBABILITY_COLOR[bucket], color: "#3E1C00" }}
          >
            {bucket}
          </span>
        );
      }
      case "value":
        return formatCurrency(tender.estimatedValue);
      case "dueDate":
        return tender.dueDate ? new Date(tender.dueDate).toLocaleDateString() : "—";
      case "daysUntilDue":
        return daysUntil(tender.dueDate);
      case "createdAt":
        return new Date(tender.createdAt).toLocaleDateString();
      default:
        return "—";
    }
  };

  return (
    <tr
      className="s7-table__row--clickable"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Select tender ${tender.tenderNumber}`}
          checked={selected}
          onChange={onToggleSelected}
        />
      </td>
      {visibleColumns.map((key) => (
        <td key={key} onClick={onOpen}>
          {renderCell(key)}
        </td>
      ))}
      {canManage ? (
        <td onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={`Quick edit ${tender.tenderNumber}`}
            title="Quick edit"
            onClick={onQuickEdit}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              opacity: hover ? 1 : 0,
              transition: "opacity 150ms"
            }}
          >
            ✎
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function BulkActionBar({
  count,
  onClear,
  onStatusChange,
  onExportCsv,
  busy,
  canManage
}: {
  count: number;
  onClear: () => void;
  onStatusChange: (status: Stage) => void;
  onExportCsv: () => void;
  busy: boolean;
  canManage: boolean;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        marginTop: 10,
        padding: "10px 16px",
        background: "#0F172A",
        color: "white",
        borderRadius: 8,
        display: "flex",
        gap: 12,
        alignItems: "center",
        zIndex: 20,
        boxShadow: "0 -4px 12px rgba(0,0,0,0.12)"
      }}
    >
      <strong>{count} tender{count === 1 ? "" : "s"} selected</strong>
      <button
        type="button"
        onClick={onClear}
        style={{ background: "transparent", border: "none", color: "#93C5FD", cursor: "pointer", fontSize: 13 }}
      >
        Clear selection
      </button>
      {canManage ? (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            onClick={() => setStatusOpen((p) => !p)}
            disabled={busy}
          >
            {busy ? "Updating…" : "Change status"}
          </button>
          {statusOpen ? (
            <div
              role="listbox"
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                background: "white",
                color: "black",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                minWidth: 180,
                zIndex: 30
              }}
              onMouseLeave={() => setStatusOpen(false)}
            >
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 10px",
                    fontSize: 13
                  }}
                  onClick={() => {
                    setStatusOpen(false);
                    onStatusChange(stage);
                  }}
                >
                  {STAGE_LABEL[stage]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onExportCsv} style={{ color: "white", borderColor: "rgba(255,255,255,0.3)" }}>
        Export CSV
      </button>
    </div>
  );
}

function QuickEditModal({
  tender,
  users,
  onClose,
  onSaved
}: {
  tender: TenderListItem;
  users: UserOption[];
  onClose: () => void;
  onSaved: (updated: TenderListItem) => void;
}) {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<string>(tender.status);
  const [probability, setProbability] = useState<string>(
    tender.probability !== null && tender.probability !== undefined ? String(tender.probability) : ""
  );
  const [dueDate, setDueDate] = useState<string>(tender.dueDate ? tender.dueDate.slice(0, 10) : "");
  const [value, setValue] = useState<string>(tender.estimatedValue ?? "");
  const [estimatorId, setEstimatorId] = useState<string>(tender.estimator?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (status !== tender.status) payload.status = status;
      const probNum = probability === "" ? null : Number(probability);
      const prevProb = tender.probability ?? null;
      if (probNum !== prevProb) payload.probability = probNum;
      const prevDue = tender.dueDate ? tender.dueDate.slice(0, 10) : "";
      if (dueDate !== prevDue) payload.dueDate = dueDate ? new Date(dueDate).toISOString() : null;
      if ((value || "") !== (tender.estimatedValue || "")) payload.value = value || null;
      const prevEst = tender.estimator?.id ?? "";
      if (estimatorId !== prevEst) payload.assignedEstimatorId = estimatorId || null;

      if (!Object.keys(payload).length) {
        onClose();
        return;
      }
      const response = await authFetch(`/tenders/${tender.id}/quick-edit`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not save.");
      }
      const updated = (await response.json()) as TenderListItem;
      onSaved(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Quick edit tender" onClick={onClose}>
      <div className="slide-over" onClick={(e) => e.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Quick edit</h2>
            <p className="slide-over__subtitle">{tender.tenderNumber} — {tender.title}</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={save} className="slide-over__body tender-form">
          {error ? <div className="login-card__error" role="alert">{error}</div> : null}
          <label className="tender-form__field">
            <span className="s7-type-label">Status</span>
            <select className="s7-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Probability (0–100)</span>
            <input
              className="s7-input"
              type="number"
              min="0"
              max="100"
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              placeholder="e.g. 80 = Hot, 50 = Warm, 20 = Cold"
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Due date</span>
            <input className="s7-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Value (AUD)</span>
            <input className="s7-input" type="number" min="0" step="1" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Estimator</span>
            <select className="s7-select" value={estimatorId} onChange={(e) => setEstimatorId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </label>
          <footer className="slide-over__footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

type KanbanColumnProps = {
  stage: Stage;
  items: TenderListItem[];
  total: number;
  loading: boolean;
  onDrop: (tenderId: string, stage: Stage) => void;
  onOpen: (tenderId: string) => void;
};

function KanbanColumn({ stage, items, total, loading, onDrop, onOpen }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={dragOver ? "tender-column tender-column--drag-over" : "tender-column"}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const tenderId = event.dataTransfer.getData("text/tender-id");
        if (tenderId) onDrop(tenderId, stage);
      }}
    >
      <header className="tender-column__header">
        <span className="tender-column__accent" style={{ background: STAGE_ACCENT[stage] }} aria-hidden />
        <span className="tender-column__title">{STAGE_LABEL[stage]}</span>
        <span className="tender-column__count">{items.length}</span>
        <span className="tender-column__total">{total > 0 ? formatCurrency(total) : "—"}</span>
      </header>
      <div className="tender-column__body">
        {loading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <div key={`col-skel-${stage}-${index}`} className="tender-card tender-card--skel">
              <Skeleton width="70%" height={14} />
              <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="tender-column__empty">No tenders in this stage.</p>
        ) : (
          items.map((tender) => (
            <TenderCard key={tender.id} tender={tender} onOpen={() => onOpen(tender.id)} />
          ))
        )}
      </div>
    </div>
  );
}

type TenderCardProps = {
  tender: TenderListItem;
  onOpen: () => void;
};

function TenderCard({ tender, onOpen }: TenderCardProps) {
  const clients = tender.tenderClients.map((tc) => tc.client.name).join(", ");
  const assignee = tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : null;
  return (
    <article
      className="tender-card"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/tender-id", tender.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="tender-card__head">
        <span className="tender-card__number">{tender.tenderNumber}</span>
        {assignee ? (
          <span className="tender-card__avatar" title={assignee}>
            {initials(tender.estimator?.firstName, tender.estimator?.lastName)}
          </span>
        ) : null}
      </div>
      <h3 className="tender-card__title">{tender.title}</h3>
      {clients ? <p className="tender-card__meta">{clients}</p> : null}
      <div className="tender-card__footer">
        <span className="tender-card__value">{formatCurrency(tender.estimatedValue)}</span>
        <span className="tender-card__activity">{daysSince(tender.updatedAt)} since activity</span>
      </div>
    </article>
  );
}

type NewTenderSlideOverProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (tenderId: string) => void;
};

function NewTenderSlideOver({ open, onClose, onCreated }: NewTenderSlideOverProps) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    tenderNumber: "",
    title: "",
    description: "",
    estimatedValue: "",
    dueDate: "",
    status: "DRAFT"
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setForm({
        tenderNumber: "",
        title: "",
        description: "",
        estimatedValue: "",
        dueDate: "",
        status: "DRAFT"
      });
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.tenderNumber.trim() || !form.title.trim()) {
      setError("Tender number and title are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        tenderNumber: form.tenderNumber.trim(),
        title: form.title.trim(),
        status: form.status
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.estimatedValue.trim()) payload.estimatedValue = form.estimatedValue.trim();
      if (form.dueDate) payload.dueDate = new Date(form.dueDate).toISOString();
      const response = await authFetch("/tenders", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not create tender.");
      }
      const created = await response.json();
      onCreated(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Create tender" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>New tender</h2>
            <p className="slide-over__subtitle">Create a tender and drop it anywhere on the pipeline.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={submit} className="slide-over__body tender-form">
          {error ? <div className="login-card__error" role="alert">{error}</div> : null}
          <label className="tender-form__field">
            <span className="s7-type-label">Tender number</span>
            <input
              className="s7-input"
              value={form.tenderNumber}
              onChange={(event) => setForm((current) => ({ ...current, tenderNumber: event.target.value }))}
              placeholder="IS-T009"
              required
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Title</span>
            <input
              className="s7-input"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Site civil works package"
              required
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Stage</span>
            <select
              className="s7-select"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>
              ))}
            </select>
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Estimated value (AUD)</span>
            <input
              className="s7-input"
              type="number"
              min="0"
              step="1"
              value={form.estimatedValue}
              onChange={(event) => setForm((current) => ({ ...current, estimatedValue: event.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Due date</span>
            <input
              className="s7-input"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Description</span>
            <textarea
              className="s7-textarea"
              rows={4}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short scope summary"
            />
          </label>
          <footer className="slide-over__footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create tender"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
