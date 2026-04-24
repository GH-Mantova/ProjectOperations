import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "../../auth/AuthContext";
import { SendQuoteModal } from "./SendQuoteModal";

type QuoteStatus = "DRAFT" | "SENT" | "SUPERSEDED";

type QuoteSummary = {
  id: string;
  tenderId: string;
  clientId: string;
  revision: number;
  quoteRef: string;
  status: QuoteStatus;
  adjustmentPct: string | null;
  adjustmentAmt: string | null;
  adjustmentNote: string | null;
  assumptionMode: string;
  showProvisional: boolean;
  showCostOptions: boolean;
  sentAt: string | null;
  client: { id: string; name: string };
  _count?: { costLines: number; provisionalLines: number; costOptions: number };
};

type CostLine = { id: string; label: string; description: string; price: string; sortOrder: number };
type ProvisionalLine = {
  id: string;
  description: string;
  price: string;
  notes: string | null;
  sortOrder: number;
};
type CostOption = {
  id: string;
  label: string;
  description: string;
  price: string;
  notes: string | null;
  sortOrder: number;
};
type AssumptionRow = { id: string; text: string; costLineId: string | null; sortOrder: number };
type ExclusionRow = { id: string; text: string; sortOrder: number };
type FullQuote = QuoteSummary & {
  client: { id: string; name: string; email: string | null; phone: string | null };
  costLines: CostLine[];
  provisionalLines: ProvisionalLine[];
  costOptions: CostOption[];
  assumptions: AssumptionRow[];
  exclusions: ExclusionRow[];
  detailLevel?: "simple" | "detailed";
};
type SummaryResult = {
  baseTotalCostLines: number;
  adjustmentAmount: number;
  adjustedTotal: number;
  provisionalTotal: number;
  costOptionsTotal: number;
  clientFacingTotal: number;
};

function fmtCurrency(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "$0.00";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);
}
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

type TenderClientLite = {
  id: string;
  client: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
};

type EditorTab = "cost" | "scope" | "provisional" | "options" | "assumptions" | "exclusions" | "preview";

export function ClientQuotesPanel({
  tenderId,
  tenderClients,
  canManage
}: {
  tenderId: string;
  tenderClients: TenderClientLite[];
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [full, setFull] = useState<FullQuote | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("cost");
  const [sendOpen, setSendOpen] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/tenders/${tenderId}/quotes`);
      if (!res.ok) throw new Error(await res.text());
      const list = (await res.json()) as QuoteSummary[];
      setQuotes(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  const loadOne = useCallback(
    async (quoteId: string) => {
      try {
        const [qRes, sRes] = await Promise.all([
          authFetch(`/tenders/${tenderId}/quotes/${quoteId}`),
          authFetch(`/tenders/${tenderId}/quotes/${quoteId}/summary`)
        ]);
        if (!qRes.ok) throw new Error(await qRes.text());
        setFull((await qRes.json()) as FullQuote);
        if (sRes.ok) setSummary((await sRes.json()) as SummaryResult);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, tenderId]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadOne(selectedId);
    else {
      setFull(null);
      setSummary(null);
    }
  }, [selectedId, loadOne]);

  // Keep the latest revision per client visible on top; older revisions
  // collapse under a "Prior revisions" toggle per client.
  const latestByClient = useMemo(() => {
    const m = new Map<string, QuoteSummary>();
    for (const q of quotes) {
      const existing = m.get(q.clientId);
      if (!existing || q.revision > existing.revision) m.set(q.clientId, q);
    }
    return Array.from(m.values());
  }, [quotes]);

  const createQuote = async (clientId: string, copyFromQuoteId?: string) => {
    try {
      const res = await authFetch(`/tenders/${tenderId}/quotes`, {
        method: "POST",
        body: JSON.stringify({ clientId, copyFromQuoteId })
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as FullQuote;
      await loadList();
      setSelectedId(created.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const patchQuote = async (quoteId: string, body: Record<string, unknown>) => {
    const res = await authFetch(`/tenders/${tenderId}/quotes/${quoteId}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await loadOne(quoteId);
    await loadList();
  };

  const refresh = async () => {
    if (selectedId) await loadOne(selectedId);
  };

  const downloadPdf = async (quoteId: string, quoteRef: string) => {
    try {
      const res = await authFetch(`/tenders/${tenderId}/quotes/${quoteId}/pdf`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IS_Quote_${quoteRef}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (tenderClients.length === 0) {
    return (
      <section className="s7-card" style={{ marginBottom: 16 }}>
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Quote versions</h3>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          Link a client to this tender first (Overview tab) to create a quote.
        </p>
      </section>
    );
  }

  return (
    <section className="s7-card" style={{ marginBottom: 16 }}>
      <h3 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 12 }}>
        Quote versions
      </h3>

      {error ? (
        <div
          role="alert"
          style={{ background: "#FEE2E2", color: "#7F1D1D", padding: 8, borderRadius: 4, marginBottom: 12 }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tenderClients.map((tc) => {
            const latest = latestByClient.find((q) => q.clientId === tc.client.id);
            const older = quotes.filter((q) => q.clientId === tc.client.id && q.id !== latest?.id);
            return (
              <ClientRow
                key={tc.client.id}
                tenderClient={tc}
                latest={latest}
                older={older}
                canManage={canManage}
                onSelect={setSelectedId}
                onNewQuote={() => void createQuote(tc.client.id)}
                onNewRevision={() =>
                  latest ? void createQuote(tc.client.id, latest.id) : void createQuote(tc.client.id)
                }
                onDownload={(q) => void downloadPdf(q.id, q.quoteRef)}
                onSend={(q) => {
                  setSelectedId(q.id);
                  setSendOpen(true);
                }}
              />
            );
          })}
        </div>
      )}

      {full && summary ? (
        <QuoteEditor
          tenderId={tenderId}
          quote={full}
          summary={summary}
          canManage={canManage}
          editorTab={editorTab}
          onTabChange={setEditorTab}
          onPatchQuote={(b) => void patchQuote(full.id, b)}
          onRefresh={refresh}
          onDownload={() => void downloadPdf(full.id, full.quoteRef)}
          onSendClick={() => setSendOpen(true)}
        />
      ) : null}

      {sendOpen && full ? (
        <SendQuoteModal
          tenderId={tenderId}
          quote={full}
          tenderClients={tenderClients}
          summary={summary}
          onClose={() => setSendOpen(false)}
          onSent={async () => {
            setSendOpen(false);
            await loadList();
            await loadOne(full.id);
          }}
        />
      ) : null}
    </section>
  );
}

function statusPillStyle(status: QuoteStatus): React.CSSProperties {
  const colors: Record<QuoteStatus, { bg: string; fg: string }> = {
    DRAFT: { bg: "#E5E7EB", fg: "#374151" },
    SENT: { bg: "#DCFCE7", fg: "#166534" },
    SUPERSEDED: { bg: "#FEF3C7", fg: "#92400E" }
  };
  const c = colors[status];
  return {
    background: c.bg,
    color: c.fg,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600
  };
}

function ClientRow({
  tenderClient,
  latest,
  older,
  canManage,
  onSelect,
  onNewQuote,
  onNewRevision,
  onDownload,
  onSend
}: {
  tenderClient: TenderClientLite;
  latest: QuoteSummary | undefined;
  older: QuoteSummary[];
  canManage: boolean;
  onSelect: (id: string) => void;
  onNewQuote: () => void;
  onNewRevision: () => void;
  onDownload: (q: QuoteSummary) => void;
  onSend: (q: QuoteSummary) => void;
}) {
  const [expandOlder, setExpandOlder] = useState(false);
  return (
    <div
      style={{
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 6,
        padding: 10,
        background: "var(--surface, #fff)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 600 }}>{tenderClient.client.name}</div>
        {latest ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>{latest.quoteRef}</span>
            <span style={statusPillStyle(latest.status)}>{latest.status}</span>
            {latest.sentAt ? (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sent {fmtDate(latest.sentAt)}</span>
            ) : null}
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => onSelect(latest.id)}
            >
              Edit
            </button>
            {canManage ? (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={onNewRevision}
                title="Create next revision (current becomes SUPERSEDED)"
              >
                New revision
              </button>
            ) : null}
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => onDownload(latest)}
            >
              PDF
            </button>
            {canManage ? (
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={() => onSend(latest)}
                style={{ background: "#FEAA6D", borderColor: "#FEAA6D", color: "#000" }}
              >
                Send
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            {canManage ? (
              <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onNewQuote}>
                + Add quote for client
              </button>
            ) : (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No quote yet</span>
            )}
          </div>
        )}
      </div>
      {older.length > 0 ? (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            onClick={() => setExpandOlder((v) => !v)}
          >
            {expandOlder ? "▾" : "▸"} Prior revisions ({older.length})
          </button>
          {expandOlder ? (
            <ul style={{ margin: "4px 0 0 0", padding: 0, listStyle: "none" }}>
              {older.map((o) => (
                <li
                  key={o.id}
                  style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0", fontSize: 12 }}
                >
                  <span>{o.quoteRef}</span>
                  <span style={statusPillStyle(o.status)}>{o.status}</span>
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    onClick={() => onSelect(o.id)}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuoteEditor({
  tenderId,
  quote,
  summary,
  canManage,
  editorTab,
  onTabChange,
  onPatchQuote,
  onRefresh,
  onDownload,
  onSendClick
}: {
  tenderId: string;
  quote: FullQuote;
  summary: SummaryResult;
  canManage: boolean;
  editorTab: EditorTab;
  onTabChange: (t: EditorTab) => void;
  onPatchQuote: (body: Record<string, unknown>) => void;
  onRefresh: () => Promise<void>;
  onDownload: () => void;
  onSendClick: () => void;
}) {
  const { authFetch } = useAuth();

  const post = async (path: string, body: unknown) => {
    const res = await authFetch(`/tenders/${tenderId}/quotes/${quote.id}${path}`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    await onRefresh();
  };
  const patch = async (path: string, body: unknown) => {
    const res = await authFetch(`/tenders/${tenderId}/quotes/${quote.id}${path}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    await onRefresh();
  };
  const del = async (path: string) => {
    const res = await authFetch(`/tenders/${tenderId}/quotes/${quote.id}${path}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    await onRefresh();
  };

  const tabs: Array<{ key: EditorTab; label: string }> = [
    { key: "cost", label: "Cost Summary" },
    { key: "scope", label: "Scope items" },
    { key: "provisional", label: "Provisional Sums" },
    { key: "options", label: "Cost Options" },
    { key: "assumptions", label: "Assumptions" },
    { key: "exclusions", label: "Exclusions" },
    { key: "preview", label: "Preview" }
  ];

  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 6,
        padding: 12
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>
          Editing {quote.quoteRef} — {quote.client.name}
        </strong>
        <span style={statusPillStyle(quote.status)}>{quote.status}</span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          marginBottom: 12
        }}
      >
        {tabs.map((t) => {
          const active = t.key === editorTab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              style={{
                padding: "6px 14px",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #FEAA6D" : "2px solid transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                fontSize: 13
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {editorTab === "cost" ? (
        <CostTab
          quote={quote}
          summary={summary}
          canManage={canManage}
          onCreate={(b) => post("/cost-lines", b)}
          onPatch={(id, b) => patch(`/cost-lines/${id}`, b)}
          onDelete={(id) => del(`/cost-lines/${id}`)}
          onPatchQuote={onPatchQuote}
        />
      ) : null}

      {editorTab === "scope" ? (
        <QuoteScopeTab
          tenderId={tenderId}
          quoteId={quote.id}
          detailLevel={quote.detailLevel ?? "simple"}
          canManage={canManage}
          onDetailLevelChange={(v) => onPatchQuote({ detailLevel: v })}
        />
      ) : null}

      {editorTab === "provisional" ? (
        <ProvisionalTab
          quote={quote}
          canManage={canManage}
          onToggleShow={(v) => onPatchQuote({ showProvisional: v })}
          onCreate={(b) => post("/provisional-lines", b)}
          onPatch={(id, b) => patch(`/provisional-lines/${id}`, b)}
          onDelete={(id) => del(`/provisional-lines/${id}`)}
        />
      ) : null}

      {editorTab === "options" ? (
        <OptionsTab
          quote={quote}
          canManage={canManage}
          onToggleShow={(v) => onPatchQuote({ showCostOptions: v })}
          onCreate={(b) => post("/cost-options", b)}
          onPatch={(id, b) => patch(`/cost-options/${id}`, b)}
          onDelete={(id) => del(`/cost-options/${id}`)}
        />
      ) : null}

      {editorTab === "assumptions" ? (
        <AssumptionsTab
          quote={quote}
          canManage={canManage}
          onModeChange={(m) => onPatchQuote({ assumptionMode: m })}
          onCreate={(b) => post("/assumptions", b)}
          onPatch={(id, b) => patch(`/assumptions/${id}`, b)}
          onDelete={(id) => del(`/assumptions/${id}`)}
          onCopyFromTender={() => post("/assumptions/copy-from-tender", {})}
        />
      ) : null}

      {editorTab === "exclusions" ? (
        <ExclusionsTab
          quote={quote}
          canManage={canManage}
          onCreate={(b) => post("/exclusions", b)}
          onPatch={(id, b) => patch(`/exclusions/${id}`, b)}
          onDelete={(id) => del(`/exclusions/${id}`)}
          onCopyFromTender={() => post("/exclusions/copy-from-tender", {})}
        />
      ) : null}

      {editorTab === "preview" ? (
        <PreviewTab
          quote={quote}
          summary={summary}
          canManage={canManage}
          onDownload={onDownload}
          onSend={onSendClick}
        />
      ) : null}
    </div>
  );
}

// ── Cost Summary tab ────────────────────────────────────────────────
function CostTab({
  quote,
  summary,
  canManage,
  onCreate,
  onPatch,
  onDelete,
  onPatchQuote
}: {
  quote: FullQuote;
  summary: SummaryResult;
  canManage: boolean;
  onCreate: (b: Record<string, unknown>) => Promise<void>;
  onPatch: (id: string, b: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPatchQuote: (b: Record<string, unknown>) => void;
}) {
  const { authFetch } = useAuth();
  const [suggestion, setSuggestion] = useState<{ suggestedAdjustmentPct: number; rationale: string } | null>(null);
  const nextLabel = String.fromCharCode(65 + quote.costLines.length); // A, B, C...
  const addLine = () =>
    void onCreate({ label: nextLabel, description: "", price: 0 });
  const fetchSuggestion = async () => {
    const res = await authFetch(`/tenders/${quote.tenderId}/quotes/client-suggestion/${quote.clientId}`);
    if (res.ok) setSuggestion((await res.json()) as { suggestedAdjustmentPct: number; rationale: string });
  };

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
        <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 4px", width: 60 }}>Label</th>
            <th style={{ textAlign: "left", padding: "6px 4px" }}>Description</th>
            <th style={{ textAlign: "right", padding: "6px 4px", width: 140 }}>Price</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {quote.costLines.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  defaultValue={l.label}
                  disabled={!canManage}
                  style={{ width: 50 }}
                  onBlur={(e) =>
                    e.target.value !== l.label && void onPatch(l.id, { label: e.target.value })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  defaultValue={l.description}
                  disabled={!canManage}
                  style={{ width: "100%" }}
                  onBlur={(e) =>
                    e.target.value !== l.description &&
                    void onPatch(l.id, { description: e.target.value })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  type="number"
                  step="0.01"
                  defaultValue={l.price}
                  disabled={!canManage}
                  style={{ width: 130, textAlign: "right" }}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && String(n) !== String(l.price))
                      void onPatch(l.id, { label: l.label, description: l.description, price: n });
                  }}
                />
              </td>
              <td style={{ padding: 4 }}>
                {canManage ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    onClick={() => void onDelete(l.id)}
                  >
                    ×
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canManage ? (
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={addLine}>
          + Add cost line
        </button>
      ) : null}

      {/* Internal adjustment panel — never appears on the PDF */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderLeft: "3px solid #005B61",
          background: "#F0F9FA",
          borderRadius: 4
        }}
      >
        <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>
          Client adjustment (internal — never shown on quote)
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12 }}>Adjustment %</label>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={quote.adjustmentPct ?? ""}
            disabled={!canManage}
            style={{ width: 120 }}
            onBlur={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              onPatchQuote({ adjustmentPct: v });
            }}
          />
          <label style={{ fontSize: 12 }}>Adjustment $</label>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={quote.adjustmentAmt ?? ""}
            disabled={!canManage}
            style={{ width: 140 }}
            onBlur={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              onPatchQuote({ adjustmentAmt: v });
            }}
          />
          <label style={{ fontSize: 12 }}>Internal note</label>
          <input
            className="s7-input"
            defaultValue={quote.adjustmentNote ?? ""}
            placeholder="e.g. Preferred client -5%"
            disabled={!canManage}
            onBlur={(e) => onPatchQuote({ adjustmentNote: e.target.value || null })}
          />
        </div>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            style={{ marginTop: 8 }}
            onClick={() => void fetchSuggestion()}
          >
            Get suggestion
          </button>
        ) : null}
        {suggestion ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
            Suggested: {suggestion.suggestedAdjustmentPct > 0 ? "+" : ""}
            {suggestion.suggestedAdjustmentPct}% — {suggestion.rationale}
          </p>
        ) : null}
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            columnGap: 10,
            rowGap: 4,
            alignItems: "baseline"
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Base total:</span>
          <span />
          <strong>{fmtCurrency(summary.baseTotalCostLines)}</strong>
          <span style={{ color: "#D97706" }}>
            Adjustment
            {quote.adjustmentPct !== null && quote.adjustmentPct !== undefined
              ? ` (${Number(quote.adjustmentPct) >= 0 ? "+" : ""}${Number(quote.adjustmentPct)}%)`
              : quote.adjustmentAmt !== null && quote.adjustmentAmt !== undefined
                ? ` ($)`
                : ""}
            :
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
            Internal only — not shown on quote
          </span>
          <strong style={{ color: "#D97706" }}>{fmtCurrency(summary.adjustmentAmount)}</strong>
          <span
            style={{
              gridColumn: "1 / -1",
              borderTop: "1px solid var(--border, #e5e7eb)",
              marginTop: 4,
              marginBottom: 4
            }}
          />
          <span style={{ fontWeight: 600 }}>Client sees:</span>
          <span />
          <strong style={{ color: "#005B61", fontSize: 15 }}>
            {fmtCurrency(summary.clientFacingTotal)}
          </strong>
        </div>
      </div>
    </div>
  );
}

// ── Provisional tab ────────────────────────────────────────────────
function ProvisionalTab({
  quote,
  canManage,
  onToggleShow,
  onCreate,
  onPatch,
  onDelete
}: {
  quote: FullQuote;
  canManage: boolean;
  onToggleShow: (v: boolean) => void;
  onCreate: (b: Record<string, unknown>) => Promise<void>;
  onPatch: (id: string, b: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={quote.showProvisional}
          disabled={!canManage}
          onChange={(e) => onToggleShow(e.target.checked)}
        />
        Show on PDF
      </label>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
        <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 4px" }}>Description</th>
            <th style={{ textAlign: "right", padding: "6px 4px", width: 140 }}>Price</th>
            <th style={{ textAlign: "left", padding: "6px 4px", width: 240 }}>Notes</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {quote.provisionalLines.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  defaultValue={l.description}
                  disabled={!canManage}
                  style={{ width: "100%" }}
                  onBlur={(e) =>
                    void onPatch(l.id, { description: e.target.value, price: Number(l.price) })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  type="number"
                  step="0.01"
                  defaultValue={l.price}
                  disabled={!canManage}
                  style={{ width: 130, textAlign: "right" }}
                  onBlur={(e) =>
                    void onPatch(l.id, { description: l.description, price: Number(e.target.value) })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  defaultValue={l.notes ?? ""}
                  disabled={!canManage}
                  onBlur={(e) =>
                    void onPatch(l.id, {
                      description: l.description,
                      price: Number(l.price),
                      notes: e.target.value || null
                    })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                {canManage ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    onClick={() => void onDelete(l.id)}
                  >
                    ×
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canManage ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => void onCreate({ description: "", price: 0 })}
        >
          + Add provisional sum
        </button>
      ) : null}
    </div>
  );
}

// ── Cost Options tab ───────────────────────────────────────────────
function OptionsTab({
  quote,
  canManage,
  onToggleShow,
  onCreate,
  onPatch,
  onDelete
}: {
  quote: FullQuote;
  canManage: boolean;
  onToggleShow: (v: boolean) => void;
  onCreate: (b: Record<string, unknown>) => Promise<void>;
  onPatch: (id: string, b: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const nextLabel = String(quote.costOptions.length + 1);
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={quote.showCostOptions}
          disabled={!canManage}
          onChange={(e) => onToggleShow(e.target.checked)}
        />
        Show on PDF
      </label>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
        <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 4px", width: 60 }}>Label</th>
            <th style={{ textAlign: "left", padding: "6px 4px" }}>Description</th>
            <th style={{ textAlign: "right", padding: "6px 4px", width: 140 }}>Price</th>
            <th style={{ textAlign: "left", padding: "6px 4px", width: 240 }}>Notes</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {quote.costOptions.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  defaultValue={l.label}
                  disabled={!canManage}
                  style={{ width: 50 }}
                  onBlur={(e) =>
                    void onPatch(l.id, {
                      label: e.target.value,
                      description: l.description,
                      price: Number(l.price)
                    })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  defaultValue={l.description}
                  disabled={!canManage}
                  style={{ width: "100%" }}
                  onBlur={(e) =>
                    void onPatch(l.id, {
                      label: l.label,
                      description: e.target.value,
                      price: Number(l.price)
                    })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  type="number"
                  step="0.01"
                  defaultValue={l.price}
                  disabled={!canManage}
                  style={{ width: 130, textAlign: "right" }}
                  onBlur={(e) =>
                    void onPatch(l.id, {
                      label: l.label,
                      description: l.description,
                      price: Number(e.target.value)
                    })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                <input
                  className="s7-input"
                  defaultValue={l.notes ?? ""}
                  disabled={!canManage}
                  onBlur={(e) =>
                    void onPatch(l.id, {
                      label: l.label,
                      description: l.description,
                      price: Number(l.price),
                      notes: e.target.value || null
                    })
                  }
                />
              </td>
              <td style={{ padding: 4 }}>
                {canManage ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    onClick={() => void onDelete(l.id)}
                  >
                    ×
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canManage ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => void onCreate({ label: nextLabel, description: "", price: 0 })}
        >
          + Add cost option
        </button>
      ) : null}
    </div>
  );
}

// ── Assumptions tab ────────────────────────────────────────────────
function AssumptionsTab({
  quote,
  canManage,
  onModeChange,
  onCreate,
  onPatch,
  onDelete,
  onCopyFromTender
}: {
  quote: FullQuote;
  canManage: boolean;
  onModeChange: (m: "free" | "linked") => void;
  onCreate: (b: Record<string, unknown>) => Promise<void>;
  onPatch: (id: string, b: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopyFromTender: () => Promise<void>;
}) {
  const mode: "free" | "linked" = quote.assumptionMode === "linked" ? "linked" : "free";
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <label style={{ fontSize: 13 }}>Mode:</label>
        <select
          className="s7-input"
          value={mode}
          disabled={!canManage}
          onChange={(e) => onModeChange(e.target.value as "free" | "linked")}
        >
          <option value="free">Free-form</option>
          <option value="linked">Linked to cost lines</option>
        </select>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void onCopyFromTender()}>
            Copy from tender assumptions
          </button>
        ) : null}
      </div>
      {mode === "free" ? (
        <FreeAssumptionList
          rows={quote.assumptions}
          canManage={canManage}
          onCreate={onCreate}
          onPatch={onPatch}
          onDelete={onDelete}
        />
      ) : (
        <LinkedAssumptionList
          quote={quote}
          canManage={canManage}
          onCreate={onCreate}
          onPatch={onPatch}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function FreeAssumptionList({
  rows,
  canManage,
  onCreate,
  onPatch,
  onDelete
}: {
  rows: AssumptionRow[];
  canManage: boolean;
  onCreate: (b: Record<string, unknown>) => Promise<void>;
  onPatch: (id: string, b: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const sorted = rows.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {sorted.map((a) => (
          <li key={a.id} style={{ display: "flex", gap: 6, padding: "4px 0" }}>
            <textarea
              className="s7-input"
              defaultValue={a.text}
              rows={2}
              disabled={!canManage}
              style={{ flex: 1 }}
              onBlur={(e) => e.target.value !== a.text && void onPatch(a.id, { text: e.target.value })}
            />
            {canManage ? (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => void onDelete(a.id)}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => void onCreate({ text: "" })}
        >
          + Add assumption
        </button>
      ) : null}
    </div>
  );
}

function LinkedAssumptionList({
  quote,
  canManage,
  onCreate,
  onPatch,
  onDelete
}: {
  quote: FullQuote;
  canManage: boolean;
  onCreate: (b: Record<string, unknown>) => Promise<void>;
  onPatch: (id: string, b: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const byLine = new Map<string | null, AssumptionRow[]>();
  for (const a of quote.assumptions) {
    const k = a.costLineId ?? null;
    const arr = byLine.get(k) ?? [];
    arr.push(a);
    byLine.set(k, arr);
  }
  return (
    <div>
      {quote.costLines.map((cl) => {
        const rows = (byLine.get(cl.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <div
            key={cl.id}
            style={{ borderTop: "1px solid var(--border, #e5e7eb)", padding: "8px 0" }}
          >
            <h5 style={{ margin: "0 0 6px", fontSize: 13 }}>
              Item {cl.label} — {cl.description || "(no description)"}
            </h5>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {rows.map((a) => (
                <li key={a.id} style={{ display: "flex", gap: 6, padding: "3px 0" }}>
                  <textarea
                    className="s7-input"
                    defaultValue={a.text}
                    rows={1}
                    disabled={!canManage}
                    style={{ flex: 1 }}
                    onBlur={(e) => e.target.value !== a.text && void onPatch(a.id, { text: e.target.value })}
                  />
                  {canManage ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      onClick={() => void onDelete(a.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canManage ? (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => void onCreate({ text: "", costLineId: cl.id })}
              >
                + Add for {cl.label}
              </button>
            ) : null}
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", padding: "8px 0" }}>
        <h5 style={{ margin: "0 0 6px", fontSize: 13 }}>General assumptions (unlinked)</h5>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {(byLine.get(null) ?? []).map((a) => (
            <li key={a.id} style={{ display: "flex", gap: 6, padding: "3px 0" }}>
              <textarea
                className="s7-input"
                defaultValue={a.text}
                rows={1}
                disabled={!canManage}
                style={{ flex: 1 }}
                onBlur={(e) => e.target.value !== a.text && void onPatch(a.id, { text: e.target.value })}
              />
              {canManage ? (
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={() => void onDelete(a.id)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => void onCreate({ text: "", costLineId: null })}
          >
            + Add general assumption
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Exclusions tab ─────────────────────────────────────────────────
function ExclusionsTab({
  quote,
  canManage,
  onCreate,
  onPatch,
  onDelete,
  onCopyFromTender
}: {
  quote: FullQuote;
  canManage: boolean;
  onCreate: (b: Record<string, unknown>) => Promise<void>;
  onPatch: (id: string, b: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCopyFromTender: () => Promise<void>;
}) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void onCopyFromTender()}>
            Copy from tender exclusions
          </button>
        ) : null}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {quote.exclusions.map((e) => (
          <li key={e.id} style={{ display: "flex", gap: 6, padding: "4px 0" }}>
            <textarea
              className="s7-input"
              defaultValue={e.text}
              rows={2}
              disabled={!canManage}
              style={{ flex: 1 }}
              onBlur={(ev) => ev.target.value !== e.text && void onPatch(e.id, { text: ev.target.value })}
            />
            {canManage ? (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => void onDelete(e.id)}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => void onCreate({ text: "" })}
        >
          + Add exclusion
        </button>
      ) : null}
    </div>
  );
}

// ── Preview tab ────────────────────────────────────────────────────
function PreviewTab({
  quote,
  summary,
  canManage,
  onDownload,
  onSend
}: {
  quote: FullQuote;
  summary: SummaryResult;
  canManage: boolean;
  onDownload: () => void;
  onSend: () => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={onDownload}
          style={{ background: "#FEAA6D", borderColor: "#FEAA6D", color: "#000" }}
        >
          Download PDF
        </button>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onSend}>
            Send quote
          </button>
        ) : null}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        <p><strong>Quote:</strong> {quote.quoteRef} — Revision {quote.revision}</p>
        <p><strong>Client:</strong> {quote.client.name}</p>
        <h4 style={{ marginBottom: 4 }}>Cost summary</h4>
        <ul style={{ margin: "0 0 8px 16px" }}>
          {quote.costLines.map((l) => (
            <li key={l.id}>
              {l.label}) {l.description} — {fmtCurrency(l.price)}
            </li>
          ))}
        </ul>
        <p>
          Client-facing total:{" "}
          <strong style={{ color: "#005B61" }}>{fmtCurrency(summary.clientFacingTotal)}</strong>
        </p>
        {quote.showProvisional && quote.provisionalLines.length > 0 ? (
          <>
            <h4 style={{ marginBottom: 4 }}>Provisional sums</h4>
            <ul style={{ margin: "0 0 8px 16px" }}>
              {quote.provisionalLines.map((l) => (
                <li key={l.id}>
                  {l.description} — {fmtCurrency(l.price)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {quote.showCostOptions && quote.costOptions.length > 0 ? (
          <>
            <h4 style={{ marginBottom: 4 }}>Cost options</h4>
            <ul style={{ margin: "0 0 8px 16px" }}>
              {quote.costOptions.map((l) => (
                <li key={l.id}>
                  {l.label}) {l.description} — {fmtCurrency(l.price)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Quote Scope Items tab ──────────────────────────────────────────
type QuoteScopeItem = {
  id: string;
  sourceItemId: string | null;
  sourceItemType: string | null;
  label: string | null;
  description: string;
  qty: string | null;
  unit: string | null;
  notes: string | null;
  isVisible: boolean;
  sortOrder: number;
};

type QuoteRowProps = {
  row: QuoteScopeItem;
  canManage: boolean;
  patchRow: (id: string, patch: Record<string, unknown>) => Promise<void>;
  deleteRow: (id: string) => Promise<void>;
  sourceBadge: (row: QuoteScopeItem) => string;
  dragHandle?: React.ReactNode;
  dragStyle?: React.CSSProperties;
  nodeRef?: (node: HTMLTableRowElement | null) => void;
};

function QuoteRowCells({ row, canManage, patchRow, deleteRow, sourceBadge, dragHandle }: QuoteRowProps) {
  return (
    <>
      {dragHandle ? <td style={{ padding: 4, width: 24 }}>{dragHandle}</td> : null}
      <td style={{ padding: 4, textAlign: "center" }}>
        <input
          type="checkbox"
          checked={row.isVisible}
          disabled={!canManage}
          onChange={(e) => void patchRow(row.id, { isVisible: e.target.checked })}
          aria-label="Visible on PDF"
        />
      </td>
      <td style={{ padding: 4 }}>
        <input
          className="s7-input s7-input--sm"
          defaultValue={row.label ?? ""}
          disabled={!canManage}
          onBlur={(e) =>
            (e.target.value || null) !== (row.label ?? null) &&
            void patchRow(row.id, { label: e.target.value || null })
          }
          style={{ width: 70 }}
        />
      </td>
      <td style={{ padding: 4 }}>
        <textarea
          className="s7-input s7-input--sm"
          defaultValue={row.description}
          disabled={!canManage}
          rows={2}
          onBlur={(e) =>
            e.target.value !== row.description &&
            void patchRow(row.id, { description: e.target.value })
          }
          style={{ width: "100%", resize: "vertical", minHeight: 30 }}
        />
      </td>
      <td style={{ padding: 4 }}>
        <input
          className="s7-input s7-input--sm"
          defaultValue={row.qty ?? ""}
          disabled={!canManage}
          onBlur={(e) =>
            (e.target.value || null) !== (row.qty ?? null) &&
            void patchRow(row.id, { qty: e.target.value || null })
          }
          style={{ width: 80, textAlign: "right" }}
        />
      </td>
      <td style={{ padding: 4 }}>
        <input
          className="s7-input s7-input--sm"
          defaultValue={row.unit ?? ""}
          disabled={!canManage}
          onBlur={(e) =>
            (e.target.value || null) !== (row.unit ?? null) &&
            void patchRow(row.id, { unit: e.target.value || null })
          }
          style={{ width: 70 }}
        />
      </td>
      <td style={{ padding: 4 }}>
        <input
          className="s7-input s7-input--sm"
          defaultValue={row.notes ?? ""}
          disabled={!canManage}
          onBlur={(e) =>
            (e.target.value || null) !== (row.notes ?? null) &&
            void patchRow(row.id, { notes: e.target.value || null })
          }
          style={{ width: "100%" }}
        />
      </td>
      <td style={{ padding: 4, fontSize: 11, color: "var(--text-muted)" }}>{sourceBadge(row)}</td>
      <td style={{ padding: 4, textAlign: "right" }}>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => void deleteRow(row.id)}
            aria-label="Delete"
          >
            ×
          </button>
        ) : null}
      </td>
    </>
  );
}

function StaticQuoteRow(props: QuoteRowProps) {
  const { row } = props;
  return (
    <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)", opacity: row.isVisible ? 1 : 0.5 }}>
      <QuoteRowCells {...props} />
    </tr>
  );
}

function SortableQuoteRow(props: QuoteRowProps) {
  const { row } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderTop: "1px solid var(--border, #e5e7eb)",
    opacity: isDragging ? 0.6 : row.isVisible ? 1 : 0.5,
    background: isDragging ? "var(--surface-muted, #f6f6f6)" : undefined
  };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      style={{
        cursor: "grab",
        background: "transparent",
        border: "none",
        padding: 2,
        color: "var(--text-muted)",
        fontSize: 14,
        lineHeight: 1,
        touchAction: "none"
      }}
    >
      ⠿
    </button>
  );
  return (
    <tr ref={setNodeRef} style={style}>
      <QuoteRowCells {...props} dragHandle={handle} />
    </tr>
  );
}

function QuoteScopeTab({
  tenderId,
  quoteId,
  detailLevel,
  canManage,
  onDetailLevelChange
}: {
  tenderId: string;
  quoteId: string;
  detailLevel: "simple" | "detailed";
  canManage: boolean;
  onDetailLevelChange: (v: "simple" | "detailed") => void;
}) {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<QuoteScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grouped, setGrouped] = useState(true);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const base = `/tenders/${tenderId}/quotes/${quoteId}/scope-items`;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(base);
      if (!response.ok) throw new Error(await response.text());
      setRows((await response.json()) as QuoteScopeItem[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenderId, quoteId]);

  const patchRow = async (id: string, patch: Record<string, unknown>) => {
    const response = await authFetch(`${base}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const deleteRow = async (id: string) => {
    if (!window.confirm("Remove this item from the quote?")) return;
    const response = await authFetch(`${base}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const addBlank = async () => {
    const response = await authFetch(base, {
      method: "POST",
      body: JSON.stringify({ description: "New item", isVisible: true })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const reset = async () => {
    if (!window.confirm("This will replace all quote scope items with current scope of works data. Continue?")) return;
    setBusy(true);
    try {
      const response = await authFetch(`${base}/reset`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pushFromScope = async () => {
    setBusy(true);
    try {
      const response = await authFetch(`${base}/push-from-scope`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sourceBadge = (row: QuoteScopeItem): string => {
    if (!row.sourceItemType) return "Manual";
    if (row.sourceItemType === "scope") return row.label ?? "Scope";
    if (row.sourceItemType === "waste") return "Waste";
    if (row.sourceItemType === "cutting") return "Cutting";
    return row.sourceItemType;
  };

  const reorderRows = useCallback(
    async (newRows: QuoteScopeItem[]) => {
      const prev = rows;
      const withOrder = newRows.map((r, i) => ({ ...r, sortOrder: i }));
      setRows(withOrder);
      const response = await authFetch(`${base}/reorder`, {
        method: "POST",
        body: JSON.stringify({
          order: withOrder.map((r) => ({ itemId: r.id, sortOrder: r.sortOrder }))
        })
      });
      if (!response.ok) {
        setError(await response.text());
        setRows(prev);
      }
    },
    [authFetch, base, rows]
  );

  const handleDragEnd = (event: DragEndEvent, source: QuoteScopeItem[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = source.findIndex((r) => r.id === active.id);
    const newIndex = source.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void reorderRows(arrayMove(source, oldIndex, newIndex));
  };

  const renderRow = (row: QuoteScopeItem, draggable: boolean) =>
    draggable && canManage ? (
      <SortableQuoteRow
        key={row.id}
        row={row}
        canManage={canManage}
        patchRow={patchRow}
        deleteRow={deleteRow}
        sourceBadge={sourceBadge}
      />
    ) : (
      <StaticQuoteRow
        key={row.id}
        row={row}
        canManage={canManage}
        patchRow={patchRow}
        deleteRow={deleteRow}
        sourceBadge={sourceBadge}
      />
    );

  const renderHeader = (draggable: boolean) => (
    <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
      <tr>
        {[
          ...(draggable ? [{ label: "", w: 24 }] : []),
          { label: "✓", w: 40 },
          { label: "Label", w: 80 },
          { label: "Description", w: null },
          { label: "Qty", w: 90 },
          { label: "Unit", w: 80 },
          { label: "Notes", w: null },
          { label: "Source", w: 90 },
          { label: "", w: 40 }
        ].map((h, i) => (
          <th
            key={i}
            style={{
              padding: "6px 4px",
              textAlign: "left",
              fontSize: 10,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              width: h.w !== null ? `${h.w}px` : undefined
            }}
          >
            {h.label}
          </th>
        ))}
      </tr>
    </thead>
  );

  const disciplineGroups = useMemo(() => {
    const groups = new Map<string, QuoteScopeItem[]>();
    for (const r of rows) {
      const discKey = r.label ? /^[A-Za-z]+/.exec(r.label)?.[0] ?? "Other" : "Other";
      const arr = groups.get(discKey) ?? [];
      arr.push(r);
      groups.set(discKey, arr);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 12,
          padding: 10,
          background: "var(--surface-subtle, rgba(0,0,0,0.02))",
          borderRadius: 6
        }}
      >
        <label style={{ fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)", marginRight: 6 }}>Quote detail level:</span>
          <select
            className="s7-select s7-input--sm"
            value={detailLevel}
            disabled={!canManage}
            onChange={(e) => onDetailLevelChange(e.target.value as "simple" | "detailed")}
          >
            <option value="simple">Simple (no scope table on PDF)</option>
            <option value="detailed">Detailed (scope table on PDF page 2)</option>
          </select>
        </label>
        <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
          />
          Group by discipline
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {canManage ? (
            <>
              <button
                type="button"
                className="s7-btn s7-btn--secondary s7-btn--sm"
                onClick={() => void pushFromScope()}
                disabled={busy}
              >
                + Copy from scope
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => void reset()}
                disabled={busy}
              >
                Reset from scope
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={() => void addBlank()}
                disabled={busy}
              >
                + Add item
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : detailLevel === "simple" ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Simple mode — scope items are hidden on the client PDF. Only cost lines (A, B, C…)
          appear on page 1. Switch to Detailed to show a scope-of-works table on page 2.
        </p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No items yet. Click "Copy from scope" to import the tender's scope, waste, and cutting
          rows — each becomes an editable client-facing line here.
        </p>
      ) : grouped ? (
        disciplineGroups.map(([group, groupRows]) => (
          <section key={group} style={{ marginBottom: 16 }}>
            <h4 className="s7-type-card-title" style={{ margin: "0 0 6px" }}>
              {group}
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                ({groupRows.length})
              </span>
            </h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                {renderHeader(false)}
                <tbody>{groupRows.map((r) => renderRow(r, false))}</tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, rows)}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              {renderHeader(true)}
              <SortableContext
                items={rows.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>{rows.map((r) => renderRow(r, true))}</tbody>
              </SortableContext>
            </table>
          </div>
        </DndContext>
      )}
    </div>
  );
}
