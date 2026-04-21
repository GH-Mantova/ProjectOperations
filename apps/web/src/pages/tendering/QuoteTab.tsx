import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "../../auth/AuthContext";

type Discipline = "SO" | "Str" | "Asb" | "Civ" | "Prv";

type DisciplineStat = { itemCount: number; subtotal: number; withMarkup: number };
type ScopeSummary = {
  SO: DisciplineStat;
  Str: DisciplineStat;
  Asb: DisciplineStat;
  Civ: DisciplineStat;
  Prv: DisciplineStat;
  cutting: { itemCount: number; subtotal: number };
  tenderPrice: number;
};

type ListEntry = { id: string; text: string; sortOrder: number };

type Clause = { number: string; heading: string; body: string };
type TandCResponse = { id: string; tenderId: string; clauses: Clause[] };

type ExportEntry = {
  id: string;
  type: string;
  generatedAt: string;
  version: number;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
};

type TenderHeader = {
  tenderNumber: string;
  estimator?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
};

const DISCIPLINE_ROWS: Array<{ key: Discipline; label: string }> = [
  { key: "SO", label: "Strip-outs" },
  { key: "Str", label: "Structural" },
  { key: "Asb", label: "Asbestos removal" },
  { key: "Civ", label: "Civil works" }
];

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}
function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
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

export function QuoteTab({
  tenderId,
  tender,
  canManage
}: {
  tenderId: string;
  tender: TenderHeader;
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [summary, setSummary] = useState<ScopeSummary | null>(null);
  const [provisional, setProvisional] = useState<Array<{ id: string; description: string; amount: number }>>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const [sumRes, scopeRes] = await Promise.all([
        authFetch(`/tenders/${tenderId}/scope/summary`),
        authFetch(`/tenders/${tenderId}/scope/items`)
      ]);
      if (sumRes.ok) setSummary((await sumRes.json()) as ScopeSummary);
      if (scopeRes.ok) {
        const body = (await scopeRes.json()) as {
          items: Array<{
            id: string;
            discipline: string;
            description: string;
            provisionalAmount: string | null;
          }>;
        };
        const prv = body.items
          .filter((i) => i.discipline === "Prv")
          .map((i) => ({
            id: i.id,
            description: i.description,
            amount: i.provisionalAmount ? Number(i.provisionalAmount) : 0
          }));
        setProvisional(prv);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <CostSummarySection
        summary={summary}
        provisional={provisional}
        tender={tender}
        onRecalculate={loadSummary}
      />
      <TextListSection
        kind="assumptions"
        title="Assumptions"
        tenderId={tenderId}
        canManage={canManage}
        onToast={setToast}
      />
      <TextListSection
        kind="exclusions"
        title="Exclusions"
        tenderId={tenderId}
        canManage={canManage}
        onToast={setToast}
      />
      <TandCSection tenderId={tenderId} canManage={canManage} onToast={setToast} />
      <GenerateQuoteSection
        tenderId={tenderId}
        tenderNumber={tender.tenderNumber}
        onToast={setToast}
      />

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#005B61",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            zIndex: 100
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

// ── Section 1: Cost summary ──────────────────────────────────────────
function CostSummarySection({
  summary,
  provisional,
  tender,
  onRecalculate
}: {
  summary: ScopeSummary | null;
  provisional: Array<{ id: string; description: string; amount: number }>;
  tender: TenderHeader;
  onRecalculate: () => void;
}) {
  const estimatorName = tender.estimator
    ? `${tender.estimator.firstName} ${tender.estimator.lastName}`.trim()
    : null;
  const disciplineRows = useMemo(() => {
    if (!summary) return [];
    return DISCIPLINE_ROWS.filter((d) => summary[d.key].itemCount > 0).map((d) => ({
      key: d.key,
      label: d.label,
      amount: summary[d.key].withMarkup
    }));
  }, [summary]);
  const cuttingRow = summary && summary.cutting.itemCount > 0 ? summary.cutting.subtotal : 0;
  const total = disciplineRows.reduce((s, r) => s + r.amount, 0) + cuttingRow;

  return (
    <section className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Cost summary</h3>
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onRecalculate}>
          Recalculate
        </button>
      </div>

      {!summary ? (
        <p style={{ color: "var(--text-muted)" }}>Loading summary…</p>
      ) : disciplineRows.length === 0 && cuttingRow === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No scope items yet. Add items in the Scope of Works tab to populate this summary.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead style={{ background: "#005B61", color: "#fff" }}>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", width: 80 }}>Scope</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Description</th>
              <th style={{ ...thStyle, textAlign: "right", width: 160 }}>Amount (ex GST)</th>
            </tr>
          </thead>
          <tbody>
            {disciplineRows.map((row, i) => (
              <tr key={row.key} style={{ background: i % 2 === 1 ? "#F6F6F6" : "transparent" }}>
                <td style={tdStyle}>{row.key}</td>
                <td style={tdStyle}>{row.label}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtCurrency(row.amount)}</td>
              </tr>
            ))}
            {cuttingRow > 0 ? (
              <tr style={{ background: disciplineRows.length % 2 === 1 ? "#F6F6F6" : "transparent" }}>
                <td style={tdStyle}>Cutting</td>
                <td style={tdStyle}>Concrete cutting</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmtCurrency(cuttingRow)}</td>
              </tr>
            ) : null}
            <tr style={{ background: "#005B61", color: "#fff", fontWeight: 700 }}>
              <td style={tdStyle} colSpan={2}>TOTAL</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{fmtCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {provisional.length > 0 ? (
        <>
          <h4 style={{ fontSize: 13, margin: "14px 0 6px", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Provisional sums
          </h4>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
              <tr>
                <th style={{ ...thStyle, textAlign: "left" }}>Description</th>
                <th style={{ ...thStyle, textAlign: "right", width: 160 }}>Amount (ex GST)</th>
              </tr>
            </thead>
            <tbody>
              {provisional.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 1 ? "#F6F6F6" : "transparent" }}>
                  <td style={tdStyle}>{p.description}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{fmtCurrency(p.amount)}</td>
                </tr>
              ))}
              <tr style={{ background: "#005B61", color: "#fff", fontWeight: 700 }}>
                <td style={tdStyle}>TOTAL PROVISIONAL SUM</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {fmtCurrency(provisional.reduce((s, p) => s + p.amount, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : null}

      <p style={{ fontStyle: "italic", color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
        All prices exclude GST. Add 10% if applicable.
      </p>
      <p style={{ fontStyle: "italic", color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
        This quote is valid for 30 days from issue date or the end of the current financial year, whichever is first.
      </p>
      {estimatorName ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Prepared by: <strong style={{ color: "var(--text)" }}>{estimatorName}</strong>
          {tender.estimator?.email ? ` · ${tender.estimator.email}` : ""}
        </p>
      ) : null}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.3
};
const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--border, #e5e7eb)"
};

// ── Sections 2 & 3: Assumptions + Exclusions (shared) ────────────────
function TextListSection({
  kind,
  title,
  tenderId,
  canManage,
  onToast
}: {
  kind: "assumptions" | "exclusions";
  title: string;
  tenderId: string;
  canManage: boolean;
  onToast: (msg: string) => void;
}) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/tenders/${tenderId}/${kind}`);
      if (!response.ok) throw new Error(await response.text());
      setItems((await response.json()) as ListEntry[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const addOne = async () => {
    const response = await authFetch(`/tenders/${tenderId}/${kind}`, {
      method: "POST",
      body: JSON.stringify({ text: "New " + (kind === "assumptions" ? "assumption" : "exclusion") })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
    // Focus the last row's input on the next tick.
    requestAnimationFrame(() => {
      const all = document.querySelectorAll<HTMLInputElement>(`[data-list-kind="${kind}"] input[type="text"]`);
      const last = all[all.length - 1];
      last?.focus();
      last?.select();
    });
  };

  const patchOne = async (id: string, text: string) => {
    const response = await authFetch(`/tenders/${tenderId}/${kind}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ text })
    });
    if (!response.ok) setError(await response.text());
  };

  const removeOne = async (id: string) => {
    const response = await authFetch(`/tenders/${tenderId}/${kind}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((item, i) => ({ ...item, sortOrder: i }));
    setItems(next);
    try {
      const response = await authFetch(`/tenders/${tenderId}/${kind}/reorder`, {
        method: "POST",
        body: JSON.stringify({ order: next.map(({ id, sortOrder }) => ({ id, sortOrder })) })
      });
      if (!response.ok) throw new Error(await response.text());
      onToast("Order saved");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="s7-card" data-list-kind={kind}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>{title}</h3>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => void addOne()}>
            + Add
          </button>
        ) : null}
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No {kind === "assumptions" ? "assumptions" : "exclusions"} added. Click + Add to add one.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((item) => (
                <TextRow
                  key={item.id}
                  id={item.id}
                  text={item.text}
                  canManage={canManage}
                  onChange={(v) => void patchOne(item.id, v)}
                  onRemove={() => void removeOne(item.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function TextRow({
  id,
  text,
  canManage,
  onChange,
  onRemove
}: {
  id: string;
  text: string;
  canManage: boolean;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid var(--border, #e5e7eb)"
  };
  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        disabled={!canManage}
        style={{
          background: "transparent",
          border: "none",
          cursor: canManage ? "grab" : "default",
          color: "var(--text-muted)",
          padding: "4px 6px",
          fontSize: 14
        }}
      >
        ⋮⋮
      </button>
      <input
        type="text"
        className="s7-input"
        defaultValue={text}
        disabled={!canManage}
        onBlur={(e) => {
          const v = e.target.value;
          if (v !== text) onChange(v);
        }}
        style={{ flex: 1 }}
      />
      {canManage ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          aria-label="Delete"
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </li>
  );
}

// ── Section 4: Terms & Conditions ────────────────────────────────────
function TandCSection({
  tenderId,
  canManage,
  onToast
}: {
  tenderId: string;
  canManage: boolean;
  onToast: (msg: string) => void;
}) {
  const { authFetch } = useAuth();
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/tenders/${tenderId}/tandc`);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as TandCResponse;
      setClauses(Array.isArray(body.clauses) ? body.clauses : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePatch = useCallback(
    async (next: Clause[]) => {
      try {
        const response = await authFetch(`/tenders/${tenderId}/tandc`, {
          method: "PATCH",
          body: JSON.stringify({ clauses: next })
        });
        if (!response.ok) throw new Error(await response.text());
        onToast("Saved");
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, tenderId, onToast]
  );

  const updateBody = (number: string, body: string) => {
    setClauses((prev) => {
      const next = prev.map((c) => (c.number === number ? { ...c, body } : c));
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
      patchTimerRef.current = setTimeout(() => void savePatch(next), 500);
      return next;
    });
  };

  const resetOne = async (number: string) => {
    try {
      const response = await authFetch(`/tenders/${tenderId}/tandc/reset/${encodeURIComponent(number)}`, {
        method: "POST"
      });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as TandCResponse;
      setClauses(body.clauses);
      onToast(`Clause ${number} reset to standard`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const resetAll = async () => {
    if (!window.confirm("Reset all T&Cs to IS standard? Your edits will be lost.")) return;
    try {
      const response = await authFetch(`/tenders/${tenderId}/tandc/reset`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as TandCResponse;
      setClauses(body.clauses);
      onToast("All clauses reset to IS standard");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Terms &amp; Conditions</h3>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void resetAll()}>
            Reset all to IS standard
          </button>
        ) : null}
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : clauses.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No clauses yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {clauses.map((c) => (
            <div key={c.number}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>
                  {c.number}. {c.heading}
                </strong>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void resetOne(c.number)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: 0
                    }}
                  >
                    Reset to standard
                  </button>
                ) : null}
              </div>
              <textarea
                className="s7-input"
                defaultValue={c.body}
                disabled={!canManage}
                onBlur={(e) => updateBody(c.number, e.target.value)}
                rows={Math.max(3, Math.min(10, c.body.split(/\r?\n/).length + 1))}
                style={{ width: "100%", minHeight: 80, resize: "vertical", fontSize: 13 }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Section 5: Generate quote ────────────────────────────────────────
function GenerateQuoteSection({
  tenderId,
  tenderNumber,
  onToast
}: {
  tenderId: string;
  tenderNumber: string;
  onToast: (msg: string) => void;
}) {
  const { authFetch } = useAuth();
  const [exports, setExports] = useState<ExportEntry[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadExports = useCallback(async () => {
    try {
      const response = await authFetch(`/tenders/${tenderId}/exports`);
      if (!response.ok) throw new Error(await response.text());
      setExports((await response.json()) as ExportEntry[]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void loadExports();
  }, [loadExports]);

  const download = async (kind: "pdf" | "excel") => {
    setBusy(kind);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/export/${kind}`);
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = kind === "pdf" ? "pdf" : "xlsx";
      const base = kind === "pdf" ? "IS_Quote" : "IS_Estimate";
      a.download = `${base}_${tenderNumber}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onToast(kind === "pdf" ? "PDF quote generated" : "Excel workbook generated");
      await loadExports();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const visible = showAll ? exports : exports.slice(0, 5);

  return (
    <section className="s7-card">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 12 }}>Generate quote</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          disabled={busy !== null}
          onClick={() => void download("pdf")}
          style={{ background: "#FEAA6D", borderColor: "#FEAA6D", color: "#000" }}
        >
          {busy === "pdf" ? "Generating…" : "Download PDF quote"}
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--ghost"
          disabled={busy !== null}
          onClick={() => void download("excel")}
        >
          {busy === "excel" ? "Generating…" : "Download Excel"}
        </button>
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      <h4 style={{ fontSize: 12, margin: "16px 0 6px", textTransform: "uppercase", color: "var(--text-muted)" }}>
        Export history
      </h4>
      {exports.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No exports yet</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {visible.map((ex) => {
            const badge = (ex.type || "").toLowerCase().includes("pdf") ? "PDF" : "Excel";
            const who = ex.user ? `${ex.user.firstName} ${ex.user.lastName}`.trim() : "Unknown";
            return (
              <li
                key={ex.id}
                style={{
                  padding: "6px 0",
                  borderBottom: "1px solid var(--border, #e5e7eb)",
                  fontSize: 12,
                  display: "flex",
                  gap: 8,
                  alignItems: "center"
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: badge === "PDF" ? "#FEAA6D" : "var(--surface-muted, #F6F6F6)",
                    color: badge === "PDF" ? "#000" : "var(--text)",
                    fontWeight: 600
                  }}
                >
                  {badge}
                </span>
                <span>
                  Generated by <strong>{who}</strong> on {fmtDateTime(ex.generatedAt)}
                </span>
              </li>
            );
          })}
          {exports.length > 5 && !showAll ? (
            <li style={{ padding: "6px 0", fontSize: 12 }}>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                style={{ background: "transparent", border: "none", color: "var(--brand-primary, #005B61)", cursor: "pointer", padding: 0 }}
              >
                Show all ({exports.length})
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
