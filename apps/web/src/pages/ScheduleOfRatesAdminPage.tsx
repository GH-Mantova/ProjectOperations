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

// ─── S3 API Types ─────────────────────────────────────────────────────────────

type ClientSummary = {
  id: string;
  name: string;
  code: string | null;
};

type SorClientRateCard = {
  id: string;
  clientId: string;
  sorPeriodId: string;
  status: string;
  client: ClientSummary;
  _count: { entries: number };
};

type RowKind = "master" | "override" | "added" | "removed";

type MergedRateRow = {
  id: string;
  sorRateId: string | null;
  entryId: string | null;
  category: SorCategory;
  position: string;
  class: string | null;
  unit: string | null;
  ordinary: string | null;
  oneAndHalf: string | null;
  double: string | null;
  rowKind: RowKind;
};

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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "labour" | "plant" | "waste" | "subcontractor" | "changelog" | "client-cards";

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
                { key: "changelog" as Tab, label: `Change log (${changeLog.length})` },
                { key: "client-cards" as Tab, label: "Client rate cards" }
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
                />
              )}
              {tab === "subcontractor" && (
                <SubcontractorTable
                  rates={ratesByCategory["SUBCONTRACTOR"] ?? []}
                  periodId={selectedPeriodId}
                  canManage={canManage}
                  saving={saving}
                  callApi={callApi}
                />
              )}
              {tab === "changelog" && <ChangeLogPanel entries={changeLog} />}
              {tab === "client-cards" && (
                <ClientRateCardPanel
                  periodId={selectedPeriodId}
                  canManage={canManage}
                  authFetch={authFetch}
                />
              )}
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
};

function LabourTable({
  rates,
  periodId,
  canManage,
  saving,
  callApi
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
              <th style={{ width: "22%" }}>Position</th>
              <th style={{ width: "12%" }}>Class</th>
              <th style={{ width: "12%" }}>Ordinary</th>
              <th style={{ width: "12%" }}>1.5x</th>
              <th style={{ width: "12%" }}>2x</th>
              <th style={{ width: "20%" }}>Comments</th>
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
  callApi
}: { rate: SorRate; canManage: boolean; callApi: RateTableProps["callApi"] }) {
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
  callApi
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
              <th style={{ width: "40%" }}>Name / Item</th>
              <th style={{ width: "12%" }}>Unit</th>
              <th style={{ width: "18%" }}>Rate</th>
              <th style={{ width: "24%" }}>Comments</th>
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
  callApi
}: { rate: SorRate; canManage: boolean; callApi: RateTableProps["callApi"] }) {
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
  callApi
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
              <th style={{ width: "40%" }}>Name / Trade</th>
              <th style={{ width: "18%" }}>Rate</th>
              <th style={{ width: "12%" }}>Cost+</th>
              <th style={{ width: "24%" }}>Comments</th>
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
  callApi
}: { rate: SorRate; canManage: boolean; callApi: RateTableProps["callApi"] }) {
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

// ─── S3: Client Rate Card Panel ───────────────────────────────────────────────

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

type ClientRateCardPanelProps = {
  periodId: string;
  canManage: boolean;
  authFetch: AuthFetch;
};

/**
 * The per-client rate card section within the SoR admin page.
 *
 * Lets the operator pick a client, get-or-create their card for the current
 * period, then view the merged master+override table with add/edit/remove and
 * a "Reset to default" action.
 */
function ClientRateCardPanel({ periodId, canManage, authFetch }: ClientRateCardPanelProps) {
  const confirm = useConfirm();

  // Client list + picker
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);

  // Cards list for this period
  const [cards, setCards] = useState<SorClientRateCard[]>([]);

  // Active card + merged rows
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [mergedRows, setMergedRows] = useState<MergedRateRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  // Add entry form
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState({
    category: "LABOUR" as SorCategory,
    position: "",
    class: "",
    unit: "",
    ordinary: "",
    oneAndHalf: "",
    double: ""
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load clients
  useEffect(() => {
    void (async () => {
      setLoadingClients(true);
      try {
        const res = await authFetch("/master-data/clients?limit=500&status=ACTIVE");
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { data?: ClientSummary[]; items?: ClientSummary[] } | ClientSummary[];
        // Handle both paginated and flat responses
        const list: ClientSummary[] = Array.isArray(data)
          ? data
          : (data as { data?: ClientSummary[]; items?: ClientSummary[] }).data ??
            (data as { data?: ClientSummary[]; items?: ClientSummary[] }).items ??
            [];
        setClients(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingClients(false);
      }
    })();
  }, [authFetch]);

  // Load cards for period
  const loadCards = useCallback(async () => {
    try {
      const res = await authFetch(`/schedule-of-rates/client-cards/by-period/${periodId}`);
      if (!res.ok) throw new Error(await res.text());
      setCards((await res.json()) as SorClientRateCard[]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, periodId]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  // Load merged rows for active card
  const loadRows = useCallback(async (cardId: string) => {
    setLoadingRows(true);
    setError(null);
    try {
      const res = await authFetch(`/schedule-of-rates/client-cards/${cardId}/entries`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { rows: MergedRateRow[] };
      setMergedRows(data.rows ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingRows(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeCardId) void loadRows(activeCardId);
  }, [activeCardId, loadRows]);

  // Get or create card for selected client
  const openCard = async () => {
    if (!selectedClientId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        `/schedule-of-rates/client-cards/clients/${selectedClientId}/periods/${periodId}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { card: SorClientRateCard };
      setActiveCardId(data.card.id);
      await loadCards();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = () => {
    if (!activeCardId) return;
    void (async () => {
      const ok = await confirm({
        title: "Reset to master defaults",
        message:
          "This will remove all overrides, additions, and removals on this client card. The card reverts to the master rate book for this period. This action is logged but cannot be undone.",
        confirmLabel: "Reset",
        variant: "danger"
      });
      if (!ok) return;
      setSaving(true);
      setError(null);
      try {
        const res = await authFetch(
          `/schedule-of-rates/client-cards/${activeCardId}/reset`,
          { method: "POST" }
        );
        if (!res.ok) throw new Error(await res.text());
        await loadRows(activeCardId);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    })();
  };

  // Add entry
  const handleAddEntry = async () => {
    if (!activeCardId || !addDraft.position.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/schedule-of-rates/client-cards/${activeCardId}/entries`, {
        method: "POST",
        body: JSON.stringify({
          category: addDraft.category,
          position: addDraft.position.trim(),
          class: addDraft.class.trim() || null,
          unit: addDraft.unit.trim() || null,
          ordinary: addDraft.ordinary !== "" ? Number(addDraft.ordinary) : null,
          oneAndHalf: addDraft.oneAndHalf !== "" ? Number(addDraft.oneAndHalf) : null,
          double: addDraft.double !== "" ? Number(addDraft.double) : null
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setShowAdd(false);
      setAddDraft({ category: "LABOUR", position: "", class: "", unit: "", ordinary: "", oneAndHalf: "", double: "" });
      await loadRows(activeCardId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Remove master rate from card
  const handleRemoveMasterRate = (sorRateId: string, position: string) => {
    if (!activeCardId) return;
    void (async () => {
      const ok = await confirm({
        title: "Remove rate from client card",
        message: `Remove "${position}" from this client's rate card? The rate remains in the master catalog; it is only hidden for this client.`,
        confirmLabel: "Remove",
        variant: "danger"
      });
      if (!ok) return;
      setSaving(true);
      setError(null);
      try {
        const res = await authFetch(
          `/schedule-of-rates/client-cards/${activeCardId}/entries/by-rate/${sorRateId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(await res.text());
        await loadRows(activeCardId);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    })();
  };

  // Delete fresh addition
  const handleDeleteFreshEntry = (entryId: string, position: string) => {
    if (!activeCardId) return;
    void (async () => {
      const ok = await confirm({
        title: "Delete client addition",
        message: `Delete "${position}" from this client's rate card?`,
        confirmLabel: "Delete",
        variant: "danger"
      });
      if (!ok) return;
      setSaving(true);
      setError(null);
      try {
        const res = await authFetch(
          `/schedule-of-rates/client-cards/entries/${entryId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(await res.text());
        await loadRows(activeCardId);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    })();
  };

  // Edit entry inline callback
  const handleEditEntry = useCallback(async (entryId: string, patch: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        `/schedule-of-rates/client-cards/entries/${entryId}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      if (!res.ok) throw new Error(await res.text());
      if (activeCardId) await loadRows(activeCardId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [authFetch, activeCardId, loadRows]);

  const rowKindBadge = (kind: RowKind): ReactNode => {
    if (kind === "master") return null;
    const cfg: Record<Exclude<RowKind, "master">, { label: string; color: string }> = {
      override: { label: "Override", color: "var(--status-warning, #f59e0b)" },
      added: { label: "Added", color: "var(--status-info, #3b82f6)" },
      removed: { label: "Removed", color: "var(--status-danger, #ef4444)" }
    };
    const { label, color } = cfg[kind];
    return (
      <span
        style={{
          display: "inline-block",
          padding: "1px 6px",
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 600,
          background: color,
          color: "#fff",
          marginLeft: 4
        }}
      >
        {label}
      </span>
    );
  };

  const activeCard = cards.find((c) => c.id === activeCardId) ?? null;

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0, marginBottom: 12 }}>
        Per-client rate cards let you override, add, or remove rates from the master catalog for a
        specific client. The card shows the merged view (master + client changes). Use{" "}
        <strong>Reset to default</strong> to revert all overrides.
      </p>

      {error ? (
        <div
          style={{ color: "var(--status-danger)", fontSize: 13, marginBottom: 10 }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {/* Existing cards for this period */}
      {cards.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Cards for this period ({cards.length})
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={activeCardId === card.id ? "s7-btn s7-btn--primary s7-btn--sm" : "s7-btn s7-btn--sm"}
                onClick={() => { setActiveCardId(card.id); setShowAdd(false); }}
              >
                {card.client.name}
                {card.client.code ? ` (${card.client.code})` : ""}
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>
                  {card._count.entries} override{card._count.entries !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Client picker — open a new/existing card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "10px 12px",
          background: "var(--surface-2, #f9fafb)",
          borderRadius: "var(--radius-md, 8px)",
          marginBottom: 16
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
          Open rate card for client:
        </label>
        {loadingClients ? (
          <Skeleton width={240} height={32} />
        ) : (
          <select
            className="s7-input"
            style={{ maxWidth: 320 }}
            value={selectedClientId ?? ""}
            onChange={(e) => setSelectedClientId(e.target.value || null)}
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.code ? ` (${c.code})` : ""}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          disabled={!selectedClientId || saving}
          onClick={() => void openCard()}
        >
          Open / create card
        </button>
      </div>

      {/* Merged rate table for active card */}
      {activeCardId && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
              flexWrap: "wrap",
              gap: 8
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              {activeCard
                ? `${activeCard.client.name} — ${activeCard._count.entries} override${activeCard._count.entries !== 1 ? "s" : ""}`
                : "Client rate card"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {canManage && (
                <>
                  <button
                    type="button"
                    className="s7-btn s7-btn--sm"
                    onClick={() => setShowAdd((v) => !v)}
                    disabled={saving}
                  >
                    {showAdd ? "Cancel add" : "+ Add rate"}
                  </button>
                  <button
                    type="button"
                    className="s7-btn s7-btn--sm"
                    style={{ color: "var(--status-danger)" }}
                    onClick={handleReset}
                    disabled={saving}
                  >
                    Reset to default
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Add entry form */}
          {showAdd && canManage && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--surface-2, #f9fafb)",
                borderRadius: "var(--radius-md, 8px)",
                marginBottom: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "flex-end"
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Category</label>
                <select
                  className="s7-input"
                  value={addDraft.category}
                  onChange={(e) => setAddDraft((p) => ({ ...p, category: e.target.value as SorCategory }))}
                  style={{ width: 130 }}
                >
                  <option value="LABOUR">Labour</option>
                  <option value="PLANT">Plant</option>
                  <option value="WASTE">Waste</option>
                  <option value="SUBCONTRACTOR">Subcontractor</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Position / Name</label>
                <input
                  className="s7-input"
                  type="text"
                  value={addDraft.position}
                  onChange={(e) => setAddDraft((p) => ({ ...p, position: e.target.value }))}
                  placeholder="Position / Name"
                  style={{ width: 160 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Class</label>
                <input
                  className="s7-input"
                  type="text"
                  value={addDraft.class}
                  onChange={(e) => setAddDraft((p) => ({ ...p, class: e.target.value }))}
                  placeholder="Class"
                  style={{ width: 90 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Unit</label>
                <input
                  className="s7-input"
                  type="text"
                  value={addDraft.unit}
                  onChange={(e) => setAddDraft((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="Unit"
                  style={{ width: 70 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Ordinary ($/hr)</label>
                <input
                  className="s7-input"
                  type="number"
                  step="0.01"
                  value={addDraft.ordinary}
                  onChange={(e) => setAddDraft((p) => ({ ...p, ordinary: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: 90 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>1.5x</label>
                <input
                  className="s7-input"
                  type="number"
                  step="0.01"
                  value={addDraft.oneAndHalf}
                  onChange={(e) => setAddDraft((p) => ({ ...p, oneAndHalf: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: 80 }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>2x</label>
                <input
                  className="s7-input"
                  type="number"
                  step="0.01"
                  value={addDraft.double}
                  onChange={(e) => setAddDraft((p) => ({ ...p, double: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: 80 }}
                />
              </div>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                disabled={!addDraft.position.trim() || saving}
                onClick={() => void handleAddEntry()}
              >
                Add
              </button>
            </div>
          )}

          {/* Merged rate table */}
          {loadingRows ? (
            <Skeleton width="100%" height={160} />
          ) : mergedRows.length === 0 ? (
            <EmptyState
              heading="No rates yet"
              subtext="This card mirrors the master catalog. Add overrides or remove rates above."
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-page__table">
                <thead>
                  <tr>
                    <th style={{ width: "6%" }}>Cat</th>
                    <th style={{ width: "22%" }}>Position / Name</th>
                    <th style={{ width: "10%" }}>Class</th>
                    <th style={{ width: "8%" }}>Unit</th>
                    <th style={{ width: "12%" }}>Ordinary</th>
                    <th style={{ width: "12%" }}>1.5x</th>
                    <th style={{ width: "12%" }}>2x</th>
                    <th style={{ width: "10%" }}>Status</th>
                    <th style={{ width: 56 }} aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((row) => (
                    <ClientRateRow
                      key={row.id}
                      row={row}
                      canManage={canManage}
                      saving={saving}
                      rowKindBadge={rowKindBadge}
                      onRemoveMaster={handleRemoveMasterRate}
                      onDeleteFresh={handleDeleteFreshEntry}
                      onEdit={handleEditEntry}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Single row in the merged client rate table ───────────────────────────────

type ClientRateRowProps = {
  row: MergedRateRow;
  canManage: boolean;
  saving: boolean;
  rowKindBadge: (kind: RowKind) => ReactNode;
  onRemoveMaster: (sorRateId: string, position: string) => void;
  onDeleteFresh: (entryId: string, position: string) => void;
  onEdit: (entryId: string, patch: Record<string, unknown>) => Promise<void>;
};

type ClientRowDraft = {
  position: string;
  class: string;
  unit: string;
  ordinary: string;
  oneAndHalf: string;
  double: string;
};

function ClientRateRow({
  row,
  canManage,
  saving,
  rowKindBadge,
  onRemoveMaster,
  onDeleteFresh,
  onEdit
}: ClientRateRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ClientRowDraft>({
    position: row.position,
    class: row.class ?? "",
    unit: row.unit ?? "",
    ordinary: row.ordinary ?? "",
    oneAndHalf: row.oneAndHalf ?? "",
    double: row.double ?? ""
  });
  const trRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraft({
      position: row.position,
      class: row.class ?? "",
      unit: row.unit ?? "",
      ordinary: row.ordinary ?? "",
      oneAndHalf: row.oneAndHalf ?? "",
      double: row.double ?? ""
    });
  }, [row, editing]);

  const enterEdit = (e: MouseEvent<HTMLTableRowElement>) => {
    // Can only edit override/added/master rows that have entryId, or create override for master
    if (!canManage || editing || row.rowKind === "removed") return;
    void e;
    setEditing(true);
  };

  const commit = async () => {
    if (!row.entryId) {
      // No entry yet — this is an untouched master row. We need to create an override via addEntry.
      // Skip editing here; the add-entry form should be used.
      setEditing(false);
      return;
    }
    await onEdit(row.entryId, {
      position: draft.position.trim() || row.position,
      class: draft.class.trim() || null,
      unit: draft.unit.trim() || null,
      ordinary: draft.ordinary !== "" ? Number(draft.ordinary) : null,
      oneAndHalf: draft.oneAndHalf !== "" ? Number(draft.oneAndHalf) : null,
      double: draft.double !== "" ? Number(draft.double) : null
    });
    setEditing(false);
  };

  const cancel = () => {
    setDraft({
      position: row.position,
      class: row.class ?? "",
      unit: row.unit ?? "",
      ordinary: row.ordinary ?? "",
      oneAndHalf: row.oneAndHalf ?? "",
      double: row.double ?? ""
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

  const rowStyle: React.CSSProperties =
    row.rowKind === "removed"
      ? { opacity: 0.45, background: "var(--surface-2, #f9fafb)" }
      : row.rowKind === "override"
        ? { background: "rgba(245,158,11,0.06)" }
        : row.rowKind === "added"
          ? { background: "rgba(59,130,246,0.06)" }
          : {};

  const catLabel: Record<SorCategory, string> = {
    LABOUR: "Lab",
    PLANT: "Plant",
    WASTE: "Waste",
    SUBCONTRACTOR: "Sub"
  };

  return (
    <tr
      ref={trRef}
      className={editing ? "rates-row rates-row--editing" : "rates-row"}
      style={rowStyle}
      onClick={enterEdit}
      onBlur={handleRowBlur}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {catLabel[row.category] ?? row.category}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="text"
            value={draft.position}
            onChange={(e) => setDraft((p) => ({ ...p, position: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          row.position
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="text"
            value={draft.class}
            onChange={(e) => setDraft((p) => ({ ...p, class: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          row.class ?? ""
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="text"
            value={draft.unit}
            onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          row.unit ?? ""
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="number"
            step="0.01"
            value={draft.ordinary}
            onChange={(e) => setDraft((p) => ({ ...p, ordinary: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          currency(row.ordinary)
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="number"
            step="0.01"
            value={draft.oneAndHalf}
            onChange={(e) => setDraft((p) => ({ ...p, oneAndHalf: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          currency(row.oneAndHalf)
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="s7-input s7-input--sm"
            type="number"
            step="0.01"
            value={draft.double}
            onChange={(e) => setDraft((p) => ({ ...p, double: e.target.value }))}
            onFocus={(e) => e.currentTarget.select()}
          />
        ) : (
          currency(row.double)
        )}
      </td>
      <td>{rowKindBadge(row.rowKind)}</td>
      <td onClick={(e) => e.stopPropagation()}>
        {canManage && row.rowKind !== "removed" ? (
          <button
            type="button"
            aria-label="Remove rate"
            disabled={saving}
            onClick={() => {
              if (row.rowKind === "added" && row.entryId) {
                onDeleteFresh(row.entryId, row.position);
              } else if (row.sorRateId) {
                onRemoveMaster(row.sorRateId, row.position);
              }
            }}
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

// Re-export Fragment to satisfy the import (used in add-row rendering)
export { Fragment };
