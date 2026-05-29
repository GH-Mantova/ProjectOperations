import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { OverrideField } from "../../components";
import { ClientQuotesPanel } from "./ClientQuotesPanel";

type Clause = { number: string; heading: string; body: string; isModified?: boolean };
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
  ratesSnapshotAt?: string | null;
  tenderClients?: Array<{
    id: string;
    client: { id: string; name: string };
    contact?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  }>;
};

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
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {!isEditing && (
        <ClientQuotesPanel
          tenderId={tenderId}
          tenderClients={tender.tenderClients ?? []}
          canManage={canManage}
        />
      )}

      {canManage && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {isEditing ? (
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={() => setIsEditing(false)}
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={() => setShowGenerate((v) => !v)}
                style={{ background: "#FEAA6D", borderColor: "#FEAA6D", color: "#000" }}
              >
                Generate Quote
              </button>
            </>
          )}
        </div>
      )}

      {showGenerate && (
        <GenerateQuoteSection
          tenderId={tenderId}
          tenderNumber={tender.tenderNumber}
          ratesSnapshotAt={tender.ratesSnapshotAt ?? null}
          onToast={setToast}
        />
      )}

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

export function TandCSection({
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
        const payloadClauses = next.map(({ isModified, ...rest }) => rest);
        const response = await authFetch(`/tenders/${tenderId}/tandc`, {
          method: "PATCH",
          body: JSON.stringify({ clauses: payloadClauses })
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
              <OverrideField
                isOverridden={!!c.isModified}
                onRevert={() => void resetOne(c.number)}
              >
                <textarea
                  className="s7-input"
                  defaultValue={c.body}
                  disabled={!canManage}
                  onBlur={(e) => updateBody(c.number, e.target.value)}
                  rows={Math.max(3, Math.min(10, c.body.split(/\r?\n/).length + 1))}
                  style={{ width: "100%", minHeight: 80, resize: "vertical", fontSize: 13 }}
                />
              </OverrideField>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GenerateQuoteSection({
  tenderId,
  tenderNumber,
  ratesSnapshotAt,
  onToast
}: {
  tenderId: string;
  tenderNumber: string;
  ratesSnapshotAt: string | null;
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

      {ratesSnapshotAt ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Rates as of {new Date(ratesSnapshotAt).toLocaleDateString("en-AU", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          })}
        </p>
      ) : null}

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
