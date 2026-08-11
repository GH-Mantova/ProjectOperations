import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../hooks/useConfirm";
import { can } from "../auth/permissions";
import { NoAccess } from "../components/NoAccess";

// ─── API Types ────────────────────────────────────────────────────────────────

type SorPeriodHalf = "H1" | "H2";
type SorCategory = "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
type SorPeriodStatus = "ACTIVE" | "EXPIRED" | string;

type SorPeriodSummary = {
  id: string;
  year: number;
  half: SorPeriodHalf;
  label: string;
  startDate: string;
  expiryDate: string;
  status: SorPeriodStatus;
  _count: { rates: number };
};

type SorRate = {
  id: string;
  periodId: string;
  category: SorCategory;
  name: string;
  class: string | null;
  unit: string | null;
  ordinary: string | null;
  oneAndHalf: string | null;
  double: string | null;
  isReference: boolean;
  comments: string | null;
  sortOrder: number;
  active: boolean;
};

type SorPeriodWithRates = {
  period: Omit<SorPeriodSummary, "_count">;
  ratesByCategory: Partial<Record<SorCategory, SorRate[]>>;
};

type SorChangeLogEntry = {
  id: string;
  periodId: string;
  rateId: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedById: string | null;
};

// ─── Draft types for add/edit forms ──────────────────────────────────────────

type AddRateDraft = {
  name: string;
  class: string;
  unit: string;
  ordinary: string;
  oneAndHalf: string;
  double: string;
  isReference: boolean;
  comments: string;
};

const BLANK_ADD_DRAFT: AddRateDraft = {
  name: "",
  class: "",
  unit: "",
  ordinary: "",
  oneAndHalf: "",
  double: "",
  isReference: false,
  comments: ""
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currency(value: string | null | undefined): ReactNode {
  if (value == null || value === "") return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2
  }).format(n);
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

function statusBadge(status: SorPeriodStatus): ReactNode {
  const color =
    status === "ACTIVE"
      ? "var(--status-success, #22c55e)"
      : status === "EXPIRED"
        ? "var(--status-danger, #ef4444)"
        : "var(--text-muted)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: color,
        color: "#fff",
        marginLeft: 6,
        verticalAlign: "middle"
      }}
    >
      {status}
    </span>
  );
}

// ─── Client PDF header type ───────────────────────────────────────────────────

type SorClientPdfHeaderInput = {
  docRef: string;
  clientName: string;
  contactName: string;
  projectTitle: string;
  preparedBy: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "labour" | "plant" | "waste" | "subcontractor" | "changelog";

export function ScheduleOfRatesAdminPage() {
  const { authFetch, user } = useAuth();
  const canManage = useMemo(() => can(user, "rates.manage"), [user]);

  const [periods, setPeriods] = useState<SorPeriodSummary[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [periodData, setPeriodData] = useState<SorPeriodWithRates | null>(null);
  const [changeLog, setChangeLog] = useState<SorChangeLogEntry[]>([]);
  const [tab, setTab] = useState<Tab>("labour");
  const [loading, setLoading] = useState(true);
  const [loadingPeriod, setLoadingPeriod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Multi-select for client PDF ───────────────────────────────────────────
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [showPdfForm, setShowPdfForm] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfHeader, setPdfHeader] = useState<SorClientPdfHeaderInput>({
    docRef: "",
    clientName: "",
    contactName: "",
    projectTitle: "",
    preparedBy: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
  });

  const toggleLine = useCallback((id: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const generateClientPdf = useCallback(async () => {
    if (selectedLineIds.size === 0 || !pdfHeader.docRef.trim()) return;
    setGeneratingPdf(true);
    setError(null);
    try {
      const res = await authFetch("/schedule-of-rates/client-pdf", {
        method: "POST",
        body: JSON.stringify({
          lineIds: Array.from(selectedLineIds),
          header: {
            docRef: pdfHeader.docRef.trim(),
            clientName: pdfHeader.clientName.trim() || null,
            contactName: pdfHeader.contactName.trim() || null,
            projectTitle: pdfHeader.projectTitle.trim() || null,
            preparedBy: pdfHeader.preparedBy.trim() || null,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      anchor.download = match?.[1] ?? `SoR_Client_${pdfHeader.docRef}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setShowPdfForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingPdf(false);
    }
  }, [authFetch, selectedLineIds, pdfHeader]);

  // ── Create period form ────────────────────────────────────────────────────
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({
    year: String(new Date().getFullYear()),
    half: "H1" as SorPeriodHalf,
    startDate: "",
    expiryDate: "",
    label: ""
  });

  // ── Load periods list ─────────────────────────────────────────────────────
  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authFetch("/schedule-of-rates/periods");
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as SorPeriodSummary[];
      setPeriods(data);
      // Auto-select the most-recent period when none is selected yet.
      // Use functional updater so this callback does not need to capture
      // `selectedPeriodId` in its closure (avoids re-creating on every change).
      if (data.length > 0) {
        setSelectedPeriodId((prev) => prev ?? data[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  // ── Load selected period + rates ──────────────────────────────────────────
  const loadPeriodData = useCallback(
    async (periodId: string) => {
      setLoadingPeriod(true);
      setError(null);
      try {
        const [ratesRes, logRes] = await Promise.all([
          authFetch(`/schedule-of-rates/periods/${periodId}`),
          authFetch(`/schedule-of-rates/periods/${periodId}/change-log`)
        ]);
        if (!ratesRes.ok) throw new Error(await ratesRes.text());
        if (!logRes.ok) throw new Error(await logRes.text());
        const ratesData = (await ratesRes.json()) as SorPeriodWithRates;
        const logData = (await logRes.json()) as SorChangeLogEntry[];
        setPeriodData(ratesData);
        setChangeLog(logData);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingPeriod(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    if (selectedPeriodId) {
      void loadPeriodData(selectedPeriodId);
    }
  }, [selectedPeriodId, loadPeriodData]);

  // ── Mutation helper ───────────────────────────────────────────────────────
  const callApi = useCallback(
    async (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
      setSaving(true);
      setError(null);
      try {
        const response = await authFetch(path, {
          method,
          body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) throw new Error(await response.text());
        // Reload both periods list (for counts) and period data
        await loadPeriods();
        if (selectedPeriodId) {
          await loadPeriodData(selectedPeriodId);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [authFetch, loadPeriods, loadPeriodData, selectedPeriodId]
  );

  // ── Create period ─────────────────────────────────────────────────────────
  const submitCreatePeriod = async () => {
    if (!newPeriod.year || !newPeriod.startDate || !newPeriod.expiryDate) return;
    const autoLabel =
      newPeriod.label ||
      `${newPeriod.half} ${newPeriod.year}`;
    await callApi("/schedule-of-rates/periods", "POST", {
      year: Number(newPeriod.year),
      half: newPeriod.half,
      startDate: newPeriod.startDate,
      expiryDate: newPeriod.expiryDate,
      label: autoLabel
    });
    setShowCreatePeriod(false);
    setNewPeriod({
      year: String(new Date().getFullYear()),
      half: "H1",
      startDate: "",
      expiryDate: "",
      label: ""
    });
    // Select the newly created period (it'll be first after sort by year desc)
    const updated = await authFetch("/schedule-of-rates/periods");
    if (updated.ok) {
      const data = (await updated.json()) as SorPeriodSummary[];
      if (data.length > 0) setSelectedPeriodId(data[0].id);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!canManage) {
    return <NoAccess required="rates.manage" />;
  }

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const ratesByCategory = periodData?.ratesByCategory ?? {};

  const countFor = (cat: SorCategory) => (ratesByCategory[cat] ?? []).length;

  return (
    <div className="admin-page" style={{ paddingBottom: 70 }}>
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Estimating</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>
            Schedule of Rates
          </h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Master rate catalog for live-job variations (VC) and agreed records (AR). Separate from
            the tender estimate engine.
          </p>
        </div>
      </header>

      {error ? (
        <div
          className="s7-card"
          role="alert"
          style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}
        >
          {error}
        </div>
      ) : null}

      {/* Period selector */}
      <section className="s7-card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <label
            htmlFor="sor-period-select"
            style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}
          >
            Period
          </label>
          {loading ? (
            <Skeleton width={240} height={36} />
          ) : (
            <select
              id="sor-period-select"
              className="s7-input"
              style={{ maxWidth: 340 }}
              value={selectedPeriodId ?? ""}
              onChange={(e) => setSelectedPeriodId(e.target.value || null)}
            >
              {periods.length === 0 && <option value="">No periods — create one below</option>}
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — expires {fmtDate(p.expiryDate)} [{p.status}]
                </option>
              ))}
            </select>
          )}
          {selectedPeriod && statusBadge(selectedPeriod.status)}
          <button
            type="button"
            className="s7-btn s7-btn--sm"
            style={{ marginLeft: "auto" }}
            onClick={() => setShowCreatePeriod((v) => !v)}
          >
            {showCreatePeriod ? "Cancel" : "New period"}
          </button>
        </div>

        {showCreatePeriod && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "var(--surface-2, #f9fafb)",
              borderRadius: "var(--radius-md, 8px)",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "flex-end"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Year</label>
              <input
                className="s7-input"
                type="number"
                min={2000}
                max={2100}
                step={1}
                value={newPeriod.year}
                onChange={(e) => setNewPeriod((p) => ({ ...p, year: e.target.value }))}
                style={{ width: 90 }}
                placeholder="2026"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Half</label>
              <select
                className="s7-input"
                value={newPeriod.half}
                onChange={(e) =>
                  setNewPeriod((p) => ({ ...p, half: e.target.value as SorPeriodHalf }))
                }
                style={{ width: 80 }}
              >
                <option value="H1">H1</option>
                <option value="H2">H2</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Start date</label>
              <input
                className="s7-input"
                type="date"
                value={newPeriod.startDate}
                onChange={(e) => setNewPeriod((p) => ({ ...p, startDate: e.target.value }))}
                style={{ width: 150 }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Expiry date</label>
              <input
                className="s7-input"
                type="date"
                value={newPeriod.expiryDate}
                onChange={(e) => setNewPeriod((p) => ({ ...p, expiryDate: e.target.value }))}
                style={{ width: 150 }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Label (optional)</label>
              <input
                className="s7-input"
                type="text"
                value={newPeriod.label}
                onChange={(e) => setNewPeriod((p) => ({ ...p, label: e.target.value }))}
                placeholder={`${newPeriod.half} ${newPeriod.year}`}
                style={{ width: 140 }}
              />
            </div>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={saving || !newPeriod.year || !newPeriod.startDate || !newPeriod.expiryDate}
              onClick={() => void submitCreatePeriod()}
            >
              Create
            </button>
          </div>
        )}
      </section>

      {/* Client PDF action bar — visible when a period is loaded */}
      {selectedPeriodId && canManage && (
        <section
          className="s7-card"
          style={{
            marginBottom: 8,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            Client PDF
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {selectedLineIds.size === 0
              ? "Tick applicable rate lines below, then generate."
              : `${selectedLineIds.size} line${selectedLineIds.size === 1 ? "" : "s"} selected.`}
          </span>
          {selectedLineIds.size > 0 && (
            <button
              type="button"
              className="s7-btn s7-btn--sm"
              onClick={() => setSelectedLineIds(new Set())}
            >
              Clear selection
            </button>
          )}
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            disabled={selectedLineIds.size === 0 || generatingPdf}
            style={{ marginLeft: "auto" }}
            onClick={() => setShowPdfForm((v) => !v)}
          >
            {showPdfForm ? "Cancel" : "Generate client PDF"}
          </button>
        </section>
      )}

      {/* Client PDF header form */}
      {showPdfForm && selectedPeriodId && (
        <section
          className="s7-card"
          style={{
            marginBottom: 8,
            padding: "12px 16px",
            background: "var(--surface-2, #f9fafb)"
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Document details — these appear on the cover of the client PDF.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            {(
              [
                { key: "docRef" as const, label: "Reference *", placeholder: "e.g. SoR H2-2026", width: 200 },
                { key: "clientName" as const, label: "Client company", placeholder: "Acme Construction", width: 200 },
                { key: "contactName" as const, label: "Attention", placeholder: "Jane Doe", width: 160 },
                { key: "projectTitle" as const, label: "Project", placeholder: "Optional", width: 200 },
                { key: "preparedBy" as const, label: "Prepared by", placeholder: "Name", width: 160 },
              ]
            ).map((col) => (
              <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>{col.label}</label>
                <input
                  className="s7-input"
                  type="text"
                  placeholder={col.placeholder}
                  value={pdfHeader[col.key]}
                  onChange={(e) => setPdfHeader((prev) => ({ ...prev, [col.key]: e.target.value }))}
                  style={{ width: col.width }}
                />
              </div>
            ))}
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={generatingPdf || !pdfHeader.docRef.trim() || selectedLineIds.size === 0}
              onClick={() => void generateClientPdf()}
            >
              {generatingPdf ? "Generating…" : `Download PDF (${selectedLineIds.size} lines)`}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Internal margin, BMI, and cost-plus columns are never included in the client PDF.
          </p>
        </section>
      )}

      {/* Category tabs */}
      {selectedPeriodId && (
        <>
          <nav className="admin-page__tabs" role="tablist">
            {(
              [
                { key: "labour" as Tab, label: `Labour (${countFor("LABOUR")})` },
                { key: "plant" as Tab, label: `Plant & Equipment (${countFor("PLANT")})` },
                { key: "waste" as Tab, label: `Waste (${countFor("WASTE")})` },
                { key: "subcontractor" as Tab, label: `Subcontractors (${countFor("SUBCONTRACTOR")})` },
                { key: "changelog" as Tab, label: `Change log (${changeLog.length})` }
              ] as Array<{ key: Tab; label: string }>
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={
                  tab === t.key ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"
                }
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {loadingPeriod ? (
            <div className="s7-card">
              <Skeleton width="100%" height={200} />
            </div>
          ) : (
            <section className="s7-card">
              {tab === "labour" && (
                <LabourTable
                  rates={ratesByCategory["LABOUR"] ?? []}
                  periodId={selectedPeriodId}
                  canManage={canManage}
                  saving={saving}
                  callApi={callApi}
                  selectedLineIds={selectedLineIds}
                  onToggleLine={toggleLine}
                />
              )}
              {tab === "plant" && (
                <UnitRateTable
                  category="PLANT"
                  rates={ratesByCategory["PLANT"] ?? []}
                  periodId={selectedPeriodId}
                  canManage={canManage}
                  saving={saving}
                  callApi={callApi}
                  selectedLineIds={selectedLineIds}
                  onToggleLine={toggleLine}
                />
              )}
              {tab === "waste" && (
                <UnitRateTable
                  category="WASTE"
                  rates={ratesByCategory["WASTE"] ?? []}
                  periodId={selectedPeriodId}
                  canManage={canManage}
                  saving={saving}
                  callApi={callApi}
                  selectedLineIds={selectedLineIds}
                  onToggleLine={toggleLine}
                />
              )}
              {tab === "subcontractor" && (
                <SubcontractorTable
                  rates={ratesByCategory["SUBCONTRACTOR"] ?? []}
                  periodId={selectedPeriodId}
                  canManage={canManage}
                  saving={saving}
                  callApi={callApi}
                  selectedLineIds={selectedLineIds}
                  onToggleLine={toggleLine}
                />
              )}
              {tab === "changelog" && <ChangeLogPanel entries={changeLog} />}
            </section>
          )}
        </>
      )}

      {!loading && periods.length === 0 && (
        <div className="s7-card">
          <EmptyState
            heading="No SoR periods yet"
            subtext="Create a period above to start managing rates."
          />
        </div>
      )}

      <footer
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--surface-raised, white)",
          borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
          padding: "10px 16px",
          fontSize: 12,
          color: "var(--text-muted)",
          marginTop: 12,
          zIndex: 10
        }}
      >
        Rates are append-only — every edit is recorded in the change log. Editing a rate here never
        changes a locked job snapshot.
      </footer>
    </div>
  );
}

// ─── Labour table (Position · Class · Ord / 1.5x / 2x) ──────────────────────

type RateTableProps = {
  periodId: string;
  canManage: boolean;
  saving: boolean;
  callApi: (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;
  /** IDs of rates currently selected for client PDF */
  selectedLineIds: Set<string>;
  /** Toggle a rate in/out of the client PDF selection */
  onToggleLine: (id: string) => void;
};

function LabourTable({
  rates,
  periodId,
  canManage,
  saving,
  callApi,
  selectedLineIds,
  onToggleLine
}: RateTableProps & { rates: SorRate[] }) {
  const [draft, setDraft] = useState<AddRateDraft>(BLANK_ADD_DRAFT);
  const canAdd = canManage && !!draft.name.trim();

  const submit = async () => {
    if (!canAdd) return;
    await callApi(`/schedule-of-rates/periods/${periodId}/rates`, "POST", {
      category: "LABOUR",
      name: draft.name.trim(),
      class: draft.class.trim() || null,
      ordinary: draft.ordinary !== "" ? Number(draft.ordinary) : null,
      oneAndHalf: draft.oneAndHalf !== "" ? Number(draft.oneAndHalf) : null,
      double: draft.double !== "" ? Number(draft.double) : null,
      comments: draft.comments.trim() || null
    });
    setDraft(BLANK_ADD_DRAFT);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0, marginBottom: 12 }}>
        Ordinary, 1.5x, and 2x columns are per-hour rates.
      </p>
      {canManage && (
        <div className="admin-page__add-row">
          {(
            [
              { key: "name", label: "Position", type: "text" },
              { key: "class", label: "Class", type: "text" },
              { key: "ordinary", label: "Ordinary ($/hr)", type: "number" },
              { key: "oneAndHalf", label: "1.5x ($/hr)", type: "number" },
              { key: "double", label: "2x ($/hr)", type: "number" },
              { key: "comments", label: "Comments", type: "text" }
            ] as Array<{ key: keyof AddRateDraft; label: string; type: string }>
          ).map((col) => (
            <input
              key={col.key}
              className="s7-input"
              type={col.type}
              step={col.type === "number" ? "0.01" : undefined}
              placeholder={col.label}
              value={col.key === "isReference" ? "" : String(draft[col.key] ?? "")}
              onChange={(e) => setDraft((prev) => ({ ...prev, [col.key]: e.target.value }))}
            />
          ))}
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            disabled={!canAdd || saving}
            onClick={() => void submit()}
          >
            Add
          </button>
        </div>
      )}
      {rates.length === 0 ? (
        <EmptyState heading="No labour rates" subtext="Add the first rate above." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr>
              <th style={{ width: 36 }} aria-label="Select for PDF" />
              <th style={{ width: "22%" }}>Position</th>
              <th style={{ width: "12%" }}>Class</th>
              <th style={{ width: "12%" }}>Ordinary</th>
              <th style={{ width: "12%" }}>1.5x</th>
              <th style={{ width: "12%" }}>2x</th>
              <th style={{ width: "18%" }}>Comments</th>
              <th style={{ width: 48 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <LabourRateRow
                key={rate.id}
                rate={rate}
                canManage={canManage}
                callApi={callApi}
                selected={selectedLineIds.has(rate.id)}
                onToggle={onToggleLine}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type LabourRowDraft = {
  name: string;
  class: string;
  ordinary: string;
  oneAndHalf: string;
  double: string;
  comments: string;
};

function LabourRateRow({
  rate,
  canManage,
  callApi,
  selected,
  onToggle,
}: {
  rate: SorRate;
  canManage: boolean;
  callApi: RateTableProps["callApi"];
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LabourRowDraft>({
    name: rate.name,
    class: rate.class ?? "",
    ordinary: rate.ordinary ?? "",
    oneAndHalf: rate.oneAndHalf ?? "",
    double: rate.double ?? "",
    comments: rate.comments ?? ""
  });
  const trRef = useRef<HTMLTableRowElement | null>(null);
  const focusColRef = useRef(0);

  useEffect(() => {
    if (editing) return;
    setDraft({
      name: rate.name,
      class: rate.class ?? "",
      ordinary: rate.ordinary ?? "",
      oneAndHalf: rate.oneAndHalf ?? "",
      double: rate.double ?? "",
      comments: rate.comments ?? ""
    });
  }, [rate, editing]);

  const enterEdit = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!canManage || editing) return;
    const cell = (e.target as HTMLElement).closest("td");
    const cellIndex = cell?.parentElement
      ? Array.from(cell.parentElement.children).indexOf(cell)
      : 0;
    focusColRef.current = cellIndex >= 0 && cellIndex < 6 ? cellIndex : 0;
    setEditing(true);
  };

  useLayoutEffect(() => {
    if (!editing) return;
    const inputs = trRef.current?.querySelectorAll<HTMLInputElement>("input");
    const target = inputs?.[focusColRef.current] ?? inputs?.[0];
    target?.focus();
    target?.select();
  }, [editing]);

  const commit = async () => {
    await callApi(`/schedule-of-rates/rates/${rate.id}`, "PATCH", {
      name: draft.name.trim() || rate.name,
      class: draft.class.trim() || null,
      ordinary: draft.ordinary !== "" ? Number(draft.ordinary) : null,
      oneAndHalf: draft.oneAndHalf !== "" ? Number(draft.oneAndHalf) : null,
      double: draft.double !== "" ? Number(draft.double) : null,
      comments: draft.comments.trim() || null
    });
    setEditing(false);
  };

  const cancel = () => {
    setDraft({
      name: rate.name,
      class: rate.class ?? "",
      ordinary: rate.ordinary ?? "",
      oneAndHalf: rate.oneAndHalf ?? "",
      double: rate.double ?? "",
      comments: rate.comments ?? ""
    });
    setEditing(false);
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    const next = e.relatedTarget as Node | null;
    if (next && trRef.current && trRef.current.contains(next)) return;
    void commit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    if (e.key === "Enter") { e.preventDefault(); void commit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  const remove = () => {
    void (async () => {
      const ok = await confirm({
        title: "Remove rate",
        message: `Remove rate "${rate.name}"? This is a soft-delete — it will be logged in the change log.`,
        confirmLabel: "Remove",
        variant: "danger"
      });
      if (!ok) return;
      await callApi(`/schedule-of-rates/rates/${rate.id}`, "DELETE");
    })();
  };

  return (
    <tr
      ref={trRef}
      className={editing ? "rates-row rates-row--editing" : "rates-row"}
      onClick={enterEdit}
      onBlur={handleRowBlur}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
        <input
          type="checkbox"
          aria-label={`Include ${rate.name} in client PDF`}
          checked={selected}
          onChange={() => onToggle(rate.id)}
        />
      </td>
      <td>
        {editing ? (
          <input className="s7-input s7-input--sm" type="text" value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()} />
        ) : rate.name}
      </td>
      <td>
        {editing ? (
          <input className="s7-input s7-input--sm" type="text" value={draft.class}
            onChange={(e) => setDraft((prev) => ({ ...prev, class: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()} />
        ) : (rate.class ?? "")}
      </td>
      <td>
        {editing ? (
          <input className="s7-input s7-input--sm" type="number" step="0.01" value={draft.ordinary}
            onChange={(e) => setDraft((prev) => ({ ...prev, ordinary: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()} />
        ) : currency(rate.ordinary)}
      </td>
      <td>
        {editing ? (
          <input className="s7-input s7-input--sm" type="number" step="0.01" value={draft.oneAndHalf}
            onChange={(e) => setDraft((prev) => ({ ...prev, oneAndHalf: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()} />
        ) : currency(rate.oneAndHalf)}
      </td>
      <td>
        {editing ? (
          <input className="s7-input s7-input--sm" type="number" step="0.01" value={draft.double}
            onChange={(e) => setDraft((prev) => ({ ...prev, double: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()} />
        ) : currency(rate.double)}
      </td>
      <td>
        {editing ? (
          <input className="s7-input s7-input--sm" type="text" value={draft.comments}
            onChange={(e) => setDraft((prev) => ({ ...prev, comments: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()} />
        ) : (rate.comments ?? "")}
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {canManage ? (
          <button
            type="button"
            aria-label="Remove rate"
            onClick={remove}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--status-danger, #EF4444)",
              fontSize: 18,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4
            }}
          >
            ×
          </button>
        ) : null}
      </td>
    </tr>
  );
}

// ─── Plant / Waste table (name · unit · rate) ─────────────────────────────────

function UnitRateTable({
  category,
  rates,
  periodId,
  canManage,
  saving,
  callApi,
  selectedLineIds,
  onToggleLine
}: RateTableProps & { category: "PLANT" | "WASTE"; rates: SorRate[] }) {
  const [draft, setDraft] = useState({ name: "", unit: "", ordinary: "", comments: "" });
  const canAdd = canManage && !!draft.name.trim();

  const submit = async () => {
    if (!canAdd) return;
    await callApi(`/schedule-of-rates/periods/${periodId}/rates`, "POST", {
      category,
      name: draft.name.trim(),
      unit: draft.unit.trim() || null,
      ordinary: draft.ordinary !== "" ? Number(draft.ordinary) : null,
      comments: draft.comments.trim() || null
    });
    setDraft({ name: "", unit: "", ordinary: "", comments: "" });
  };

  return (
    <div>
      {canManage && (
        <div className="admin-page__add-row">
          {(
            [
              { key: "name", label: "Name / Item", type: "text" },
              { key: "unit", label: "Unit", type: "text" },
              { key: "ordinary", label: "Rate", type: "number" },
              { key: "comments", label: "Comments", type: "text" }
            ] as const
          ).map((col) => (
            <input
              key={col.key}
              className="s7-input"
              type={col.type}
              step={col.type === "number" ? "0.01" : undefined}
              placeholder={col.label}
              value={draft[col.key]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [col.key]: e.target.value }))}
            />
          ))}
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            disabled={!canAdd || saving}
            onClick={() => void submit()}
          >
            Add
          </button>
        </div>
      )}
      {rates.length === 0 ? (
        <EmptyState heading={`No ${category.toLowerCase()} rates`} subtext="Add the first rate above." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr>
              <th style={{ width: 36 }} aria-label="Select for PDF" />
              <th style={{ width: "38%" }}>Name / Item</th>
              <th style={{ width: "12%" }}>Unit</th>
              <th style={{ width: "16%" }}>Rate</th>
              <th style={{ width: "22%" }}>Comments</th>
              <th style={{ width: 48 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <UnitRateRow
                key={rate.id}
                rate={rate}
                canManage={canManage}
                callApi={callApi}
                selected={selectedLineIds.has(rate.id)}
                onToggle={onToggleLine}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type UnitRowDraft = { name: string; unit: string; ordinary: string; comments: string };

function UnitRateRow({
  rate,
  canManage,
  callApi,
  selected,
  onToggle,
}: {
  rate: SorRate;
  canManage: boolean;
  callApi: RateTableProps["callApi"];
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UnitRowDraft>({
    name: rate.name,
    unit: rate.unit ?? "",
    ordinary: rate.ordinary ?? "",
    comments: rate.comments ?? ""
  });
  const trRef = useRef<HTMLTableRowElement | null>(null);
  const focusColRef = useRef(0);

  useEffect(() => {
    if (editing) return;
    setDraft({ name: rate.name, unit: rate.unit ?? "", ordinary: rate.ordinary ?? "", comments: rate.comments ?? "" });
  }, [rate, editing]);

  const enterEdit = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!canManage || editing) return;
    const cell = (e.target as HTMLElement).closest("td");
    const cellIndex = cell?.parentElement ? Array.from(cell.parentElement.children).indexOf(cell) : 0;
    focusColRef.current = cellIndex >= 0 && cellIndex < 4 ? cellIndex : 0;
    setEditing(true);
  };

  useLayoutEffect(() => {
    if (!editing) return;
    const inputs = trRef.current?.querySelectorAll<HTMLInputElement>("input");
    const target = inputs?.[focusColRef.current] ?? inputs?.[0];
    target?.focus();
    target?.select();
  }, [editing]);

  const commit = async () => {
    await callApi(`/schedule-of-rates/rates/${rate.id}`, "PATCH", {
      name: draft.name.trim() || rate.name,
      unit: draft.unit.trim() || null,
      ordinary: draft.ordinary !== "" ? Number(draft.ordinary) : null,
      comments: draft.comments.trim() || null
    });
    setEditing(false);
  };

  const cancel = () => {
    setDraft({ name: rate.name, unit: rate.unit ?? "", ordinary: rate.ordinary ?? "", comments: rate.comments ?? "" });
    setEditing(false);
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    const next = e.relatedTarget as Node | null;
    if (next && trRef.current && trRef.current.contains(next)) return;
    void commit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    if (e.key === "Enter") { e.preventDefault(); void commit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  const remove = () => {
    void (async () => {
      const ok = await confirm({
        title: "Remove rate",
        message: `Remove rate "${rate.name}"?`,
        confirmLabel: "Remove",
        variant: "danger"
      });
      if (!ok) return;
      await callApi(`/schedule-of-rates/rates/${rate.id}`, "DELETE");
    })();
  };

  const fields: Array<{ key: keyof UnitRowDraft; type: string }> = [
    { key: "name", type: "text" },
    { key: "unit", type: "text" },
    { key: "ordinary", type: "number" },
    { key: "comments", type: "text" }
  ];

  return (
    <tr
      ref={trRef}
      className={editing ? "rates-row rates-row--editing" : "rates-row"}
      onClick={enterEdit}
      onBlur={handleRowBlur}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
        <input
          type="checkbox"
          aria-label={`Include ${rate.name} in client PDF`}
          checked={selected}
          onChange={() => onToggle(rate.id)}
        />
      </td>
      {fields.map((col) => (
        <td key={col.key}>
          {editing ? (
            <input
              className="s7-input s7-input--sm"
              type={col.type}
              step={col.type === "number" ? "0.01" : undefined}
              value={draft[col.key]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [col.key]: e.target.value }))}
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : col.key === "ordinary" ? (
            currency(rate.ordinary)
          ) : (
            String(draft[col.key] ?? "")
          )}
        </td>
      ))}
      <td onClick={(e) => e.stopPropagation()}>
        {canManage ? (
          <button
            type="button"
            aria-label="Remove rate"
            onClick={remove}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--status-danger, #EF4444)",
              fontSize: 18,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4
            }}
          >
            ×
          </button>
        ) : null}
      </td>
    </tr>
  );
}

// ─── Subcontractor table (name · cost+ reference flag) ────────────────────────

function SubcontractorTable({
  rates,
  periodId,
  canManage,
  saving,
  callApi,
  selectedLineIds,
  onToggleLine
}: RateTableProps & { rates: SorRate[] }) {
  const [draft, setDraft] = useState({ name: "", ordinary: "", isReference: true, comments: "" });
  const canAdd = canManage && !!draft.name.trim();

  const submit = async () => {
    if (!canAdd) return;
    await callApi(`/schedule-of-rates/periods/${periodId}/rates`, "POST", {
      category: "SUBCONTRACTOR",
      name: draft.name.trim(),
      ordinary: draft.ordinary !== "" ? Number(draft.ordinary) : null,
      isReference: draft.isReference,
      comments: draft.comments.trim() || null
    });
    setDraft({ name: "", ordinary: "", isReference: true, comments: "" });
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0, marginBottom: 12 }}>
        Subcontractor rates are cost-plus references. Toggle{" "}
        <strong>Cost+</strong> to mark a row as a reference (isReference).
      </p>
      {canManage && (
        <div className="admin-page__add-row">
          <input
            className="s7-input"
            type="text"
            placeholder="Subcontractor / trade name"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="s7-input"
            type="number"
            step="0.01"
            placeholder="Rate"
            value={draft.ordinary}
            onChange={(e) => setDraft((prev) => ({ ...prev, ordinary: e.target.value }))}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              whiteSpace: "nowrap",
              cursor: "pointer"
            }}
          >
            <input
              type="checkbox"
              checked={draft.isReference}
              onChange={(e) => setDraft((prev) => ({ ...prev, isReference: e.target.checked }))}
            />
            Cost+
          </label>
          <input
            className="s7-input"
            type="text"
            placeholder="Comments"
            value={draft.comments}
            onChange={(e) => setDraft((prev) => ({ ...prev, comments: e.target.value }))}
          />
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            disabled={!canAdd || saving}
            onClick={() => void submit()}
          >
            Add
          </button>
        </div>
      )}
      {rates.length === 0 ? (
        <EmptyState heading="No subcontractor rates" subtext="Add the first rate above." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr>
              <th style={{ width: 36 }} aria-label="Select for PDF" />
              <th style={{ width: "38%" }}>Name / Trade</th>
              <th style={{ width: "16%" }}>Rate</th>
              <th style={{ width: "12%" }}>Cost+</th>
              <th style={{ width: "22%" }}>Comments</th>
              <th style={{ width: 48 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <SubcontractorRateRow
                key={rate.id}
                rate={rate}
                canManage={canManage}
                callApi={callApi}
                selected={selectedLineIds.has(rate.id)}
                onToggle={onToggleLine}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type SubRowDraft = { name: string; ordinary: string; isReference: boolean; comments: string };

function SubcontractorRateRow({
  rate,
  canManage,
  callApi,
  selected,
  onToggle,
}: {
  rate: SorRate;
  canManage: boolean;
  callApi: RateTableProps["callApi"];
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SubRowDraft>({
    name: rate.name,
    ordinary: rate.ordinary ?? "",
    isReference: rate.isReference,
    comments: rate.comments ?? ""
  });
  const trRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraft({
      name: rate.name,
      ordinary: rate.ordinary ?? "",
      isReference: rate.isReference,
      comments: rate.comments ?? ""
    });
  }, [rate, editing]);

  const enterEdit = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!canManage || editing) return;
    void e;
    setEditing(true);
  };

  const commit = async () => {
    await callApi(`/schedule-of-rates/rates/${rate.id}`, "PATCH", {
      name: draft.name.trim() || rate.name,
      ordinary: draft.ordinary !== "" ? Number(draft.ordinary) : null,
      isReference: draft.isReference,
      comments: draft.comments.trim() || null
    });
    setEditing(false);
  };

  const cancel = () => {
    setDraft({
      name: rate.name,
      ordinary: rate.ordinary ?? "",
      isReference: rate.isReference,
      comments: rate.comments ?? ""
    });
    setEditing(false);
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    const next = e.relatedTarget as Node | null;
    if (next && trRef.current && trRef.current.contains(next)) return;
    void commit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    if (e.key === "Enter") { e.preventDefault(); void commit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  const remove = () => {
    void (async () => {
      const ok = await confirm({
        title: "Remove rate",
        message: `Remove rate "${rate.name}"?`,
        confirmLabel: "Remove",
        variant: "danger"
      });
      if (!ok) return;
      await callApi(`/schedule-of-rates/rates/${rate.id}`, "DELETE");
    })();
  };

  return (
    <tr
      ref={trRef}
      className={editing ? "rates-row rates-row--editing" : "rates-row"}
      onClick={enterEdit}
      onBlur={handleRowBlur}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
        <input
          type="checkbox"
          aria-label={`Include ${rate.name} in client PDF`}
          checked={selected}
          onChange={() => onToggle(rate.id)}
        />
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          rate.name
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="number"
            step="0.01"
            value={draft.ordinary}
            onChange={(e) => setDraft((prev) => ({ ...prev, ordinary: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          currency(rate.ordinary)
        )}
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <input
            type="checkbox"
            checked={draft.isReference}
            onChange={(e) => setDraft((prev) => ({ ...prev, isReference: e.target.checked }))}
          />
        ) : rate.isReference ? (
          <span style={{ color: "var(--status-success, #22c55e)", fontWeight: 600 }}>Yes</span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>No</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="text"
            value={draft.comments}
            onChange={(e) => setDraft((prev) => ({ ...prev, comments: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          rate.comments ?? ""
        )}
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        {canManage ? (
          <button
            type="button"
            aria-label="Remove rate"
            onClick={remove}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--status-danger, #EF4444)",
              fontSize: 18,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4
            }}
          >
            ×
          </button>
        ) : null}
      </td>
    </tr>
  );
}

// ─── Change log panel ─────────────────────────────────────────────────────────

function ChangeLogPanel({ entries }: { entries: SorChangeLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState heading="No change log entries" subtext="Changes will appear here as rates are added or edited." />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-page__table">
        <thead>
          <tr>
            <th style={{ width: "18%" }}>When</th>
            <th style={{ width: "16%" }}>Field</th>
            <th style={{ width: "28%" }}>Old value</th>
            <th style={{ width: "28%" }}>New value</th>
            <th style={{ width: "10%" }}>By</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {fmtDate(entry.changedAt)}
              </td>
              <td>
                <code
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12
                  }}
                >
                  {entry.field}
                </code>
              </td>
              <td style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {entry.oldValue != null ? (
                  <span style={{ textDecoration: "line-through" }}>{entry.oldValue}</span>
                ) : (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                )}
              </td>
              <td style={{ fontSize: 13 }}>
                {entry.newValue != null ? (
                  entry.newValue
                ) : (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                )}
              </td>
              <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {entry.changedById ? (
                  <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11 }}>
                    {entry.changedById.slice(0, 8)}
                  </code>
                ) : (
                  "system"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Re-export Fragment to satisfy the import (used in add-row rendering)
export { Fragment };
