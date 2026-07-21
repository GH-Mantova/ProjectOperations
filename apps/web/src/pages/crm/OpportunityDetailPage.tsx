import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// CRM slice 1 — Opportunity detail. Edit stage/probability/value/next-action
// inline; convert-to-Tender is the marquee action (fires TenderingService
// via /crm/opportunities/:id/convert-to-tender). Requires a siteId.

type Owner = { id: string; firstName: string; lastName: string };
type ClientLite = { id: string; name: string };
type ContactLite = { id: string; firstName: string; lastName: string; email: string | null };
type SiteLite = { id: string; name: string; addressLine1: string | null; suburb: string | null };

type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  stage: "new" | "qualified" | "quoting" | "won" | "lost";
  probability: number;
  estimatedValue: string | null;
  source: string;
  client: ClientLite;
  contact: ContactLite | null;
  owner: Owner | null;
  expectedCloseDate: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  createdAt: string;
  convertedTender: {
    id: string; tenderNumber: string; title: string; status: string;
  } | null;
  sourceLead: { id: string; title: string; status: string } | null;
};

const STAGES = ["new", "qualified", "quoting", "won", "lost"] as const;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}
function fmtMoney(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

export function OpportunityDetailPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Convert-to-tender dialog
  const [showConvert, setShowConvert] = useState(false);
  const [sites, setSites] = useState<SiteLite[]>([]);
  const [convertSiteId, setConvertSiteId] = useState("");
  const [convertTitle, setConvertTitle] = useState("");
  const [convertDueDate, setConvertDueDate] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/crm/opportunities/${id}`);
      if (!res.ok) throw new Error(await res.text());
      setOpp(await res.json() as Opportunity);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    if (!id) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await authFetch(`/crm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      setOpp(await res.json() as Opportunity);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function openConvertDialog() {
    setShowConvert(true);
    setConvertTitle(opp?.title ?? "");
    setConvertError(null);
    try {
      const res = await authFetch("/master-data/sites?pageSize=100");
      if (res.ok) {
        const data = await res.json() as { items?: SiteLite[] } | SiteLite[];
        setSites(Array.isArray(data) ? data : (data.items ?? []));
      }
    } catch {
      // Site list is optional — user can still type a siteId manually if needed.
    }
  }

  async function handleConvert() {
    if (!id) return;
    if (!convertSiteId) {
      setConvertError("Site is required to create a Tender.");
      return;
    }
    setConverting(true); setConvertError(null);
    try {
      const res = await authFetch(`/crm/opportunities/${id}/convert-to-tender`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: convertSiteId,
          title: convertTitle || undefined,
          dueDate: convertDueDate || undefined
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json() as Opportunity;
      setOpp(updated);
      setShowConvert(false);
      if (updated.convertedTender) {
        navigate(`/tenders/${updated.convertedTender.id}`);
      }
    } catch (err) {
      setConvertError((err as Error).message);
    } finally {
      setConverting(false);
    }
  }

  if (loading) return <div style={{ padding: 32 }}>Loading opportunity…</div>;
  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div role="alert" style={{ color: "#dc2626", padding: 12, background: "#fef2f2", borderRadius: 6 }}>
          {error}
        </div>
        <button onClick={() => navigate("/crm")} style={{ marginTop: 12, padding: "8px 14px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
          Back to CRM
        </button>
      </div>
    );
  }
  if (!opp) return <div style={{ padding: 32 }}>Opportunity not found.</div>;

  const value = opp.estimatedValue ? Number(opp.estimatedValue) : 0;
  const weighted = (value * opp.probability) / 100;
  const terminal = opp.stage === "won" || opp.stage === "lost";
  const converted = Boolean(opp.convertedTender);

  return (
    <div style={{ padding: "24px 32px", maxWidth: 960 }}>
      <button
        onClick={() => navigate("/crm")}
        style={{ background: "none", border: "none", color: "var(--text-muted, #666)", cursor: "pointer", marginBottom: 8, padding: 0 }}
      >
        ← Back to CRM
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: "0 0 6px" }}>{opp.title}</h1>
          <div style={{ color: "var(--text-muted, #666)", fontSize: 13 }}>
            {opp.client.name}
            {opp.contact && ` · ${opp.contact.firstName} ${opp.contact.lastName}`}
            {opp.owner && ` · Owner: ${opp.owner.firstName} ${opp.owner.lastName}`}
          </div>
        </div>
        {!converted && !terminal && (
          <button
            onClick={() => void openConvertDialog()}
            style={{
              background: "var(--color-orange, #FEAA6D)", color: "#000", border: "none",
              borderRadius: 6, padding: "10px 20px", cursor: "pointer", fontWeight: 600, minHeight: 44
            }}
          >
            Convert to Tender →
          </button>
        )}
      </div>

      {converted && opp.convertedTender && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: 12, marginBottom: 16 }}>
          <strong style={{ color: "#166534" }}>Converted to tender {opp.convertedTender.tenderNumber}</strong>
          {" · "}
          <button
            onClick={() => navigate(`/tenders/${opp.convertedTender!.id}`)}
            style={{ color: "var(--color-teal, #005B61)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            Open tender
          </button>
        </div>
      )}

      {opp.sourceLead && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: 10, marginBottom: 16, fontSize: 13 }}>
          Qualified from lead: <strong>{opp.sourceLead.title}</strong>
        </div>
      )}

      {saveError && (
        <div role="alert" style={{ color: "#dc2626", padding: 12, background: "#fef2f2", borderRadius: 6, marginBottom: 16 }}>
          {saveError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Main edit panel */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Stage</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {STAGES.map((s) => (
                <button
                  key={s}
                  disabled={terminal || saving || s === opp.stage}
                  onClick={() => void patch({ stage: s })}
                  style={{
                    padding: "6px 12px", borderRadius: 4,
                    border: s === opp.stage ? "2px solid var(--color-teal, #005B61)" : "1px solid #ccc",
                    background: s === opp.stage ? "var(--color-teal, #005B61)" : "#fff",
                    color: s === opp.stage ? "#fff" : "#000",
                    cursor: (terminal || s === opp.stage) ? "not-allowed" : "pointer",
                    opacity: (terminal && s !== opp.stage) ? 0.4 : 1
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {terminal && (
              <div style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 6 }}>
                Stage locked — {opp.stage} on {fmtDate(opp.wonAt ?? opp.lostAt)}.
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Estimated value (AUD)</label>
              <input
                type="number" defaultValue={opp.estimatedValue ?? ""}
                onBlur={(e) => void patch({ estimatedValue: e.target.value })}
                disabled={terminal || saving}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Probability %</label>
              <input
                type="number" min={0} max={100} defaultValue={opp.probability}
                onBlur={(e) => void patch({ probability: Number(e.target.value) })}
                disabled={terminal || saving}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Expected close</label>
              <input
                type="date" defaultValue={toDateInput(opp.expectedCloseDate)}
                onBlur={(e) => void patch({ expectedCloseDate: e.target.value || null })}
                disabled={terminal || saving}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Next action</label>
              <input
                type="date" defaultValue={toDateInput(opp.nextActionAt)}
                onBlur={(e) => void patch({ nextActionAt: e.target.value || null })}
                disabled={terminal || saving}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Next-action note</label>
            <input
              type="text" defaultValue={opp.nextActionNote ?? ""}
              onBlur={(e) => void patch({ nextActionNote: e.target.value || null })}
              placeholder="What's the next step?"
              disabled={terminal || saving}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Description</label>
            <textarea
              defaultValue={opp.description ?? ""}
              onBlur={(e) => void patch({ description: e.target.value || null })}
              rows={4}
              disabled={terminal || saving}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {opp.stage === "lost" && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Lost reason</label>
              <input
                type="text" defaultValue={opp.lostReason ?? ""}
                onBlur={(e) => void patch({ lostReason: e.target.value || null })}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* Summary panel */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 18 }}>
          <h3 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 15, marginTop: 0 }}>Summary</h3>
          <SummaryRow label="Gross value" value={value ? fmtMoney(value) : "-"} />
          <SummaryRow label="Weighted" value={fmtMoney(weighted)} highlight />
          <SummaryRow label="Probability" value={`${opp.probability}%`} />
          <SummaryRow label="Source" value={opp.source} />
          <SummaryRow label="Created" value={fmtDate(opp.createdAt)} />
          {opp.wonAt && <SummaryRow label="Won at" value={fmtDate(opp.wonAt)} />}
          {opp.lostAt && <SummaryRow label="Lost at" value={fmtDate(opp.lostAt)} />}
        </div>
      </div>

      {/* Convert-to-tender modal */}
      {showConvert && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConvert(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 8, padding: 28, width: 520, maxWidth: "90vw" }}>
            <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading, Syne)" }}>Convert to Tender</h2>
            <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: "var(--text-muted, #666)" }}>
              A Tender is created via the standard tendering pipeline. The opportunity is marked <strong>won</strong>{" "}
              and linked to the new tender — no data is re-keyed.
            </p>
            {convertError && (
              <div role="alert" style={{ color: "#dc2626", marginBottom: 12, padding: 8, background: "#fef2f2", borderRadius: 4 }}>
                {convertError}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Site *</label>
              <select value={convertSiteId} onChange={(e) => setConvertSiteId(e.target.value)} style={inputStyle}>
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.suburb ? ` — ${s.suburb}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Tender title</label>
              <input type="text" value={convertTitle} onChange={(e) => setConvertTitle(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Due date</label>
              <input type="date" value={convertDueDate} onChange={(e) => setConvertDueDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConvert(false)} disabled={converting}
                style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", minHeight: 44 }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConvert()} disabled={converting}
                style={{
                  padding: "10px 20px", borderRadius: 6, border: "none",
                  background: "var(--color-orange, #FEAA6D)", cursor: "pointer",
                  fontWeight: 600, minHeight: 44, opacity: converting ? 0.6 : 1
                }}
              >
                {converting ? "Converting…" : "Create Tender"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 4,
  border: "1px solid #ccc", boxSizing: "border-box"
};

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ color: "var(--text-muted, #666)" }}>{label}</span>
      <span style={{ fontWeight: highlight ? 700 : 500, color: highlight ? "var(--color-teal, #005B61)" : "#000" }}>{value}</span>
    </div>
  );
}
