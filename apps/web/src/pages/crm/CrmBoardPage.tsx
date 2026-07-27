import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  TENDER_STATUS_ACCENT,
  TENDER_STATUS_LABEL,
  type TenderStatus
} from "../tendering/tenderStatusLabels";

// CRM slice 1 — Opportunity kanban board + weighted-forecast summary + lead
// intake side panel. Sits BEFORE Tendering in the sales pipeline; a firmed
// opportunity converts to a Tender from the detail page (no data re-keying).

type Owner = { id: string; firstName: string; lastName: string };
type ClientLite = { id: string; name: string };
type ContactLite = { id: string; firstName: string; lastName: string; email: string | null };
type SiteLite = { id: string; name: string; suburb: string | null };

type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  stage: OpportunityStage;
  probability: number;
  estimatedValue: string | null;
  source: string;
  client: ClientLite;
  contact: ContactLite | null;
  owner: Owner | null;
  expectedCloseDate: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  convertedTenderId: string | null;
  convertedTender: { id: string; tenderNumber: string; status: string } | null;
  createdAt: string;
};

type Lead = {
  id: string;
  title: string;
  status: string;
  source: string;
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  client: ClientLite | null;
  contact: ContactLite | null;
  owner: Owner | null;
  nextActionAt: string | null;
  createdAt: string;
};

type ForecastBucket = { stage: OpportunityStage; count: number; grossValue: number; weightedValue: number };
type ForecastResponse = {
  buckets: ForecastBucket[];
  totals: { count: number; grossValue: number; weightedValue: number };
};

type OpportunityStage = "new" | "qualified" | "quoting" | "won" | "lost";

const STAGES: { key: OpportunityStage; label: string; colour: string }[] = [
  { key: "new", label: "New", colour: "#94a3b8" },
  { key: "qualified", label: "Qualified", colour: "#0ea5e9" },
  { key: "quoting", label: "Quoting", colour: "#eab308" },
  { key: "won", label: "Won", colour: "#16a34a" },
  { key: "lost", label: "Lost", colour: "#dc2626" }
];

const SOURCES = ["referral", "direct", "tender_portal", "cold", "repeat_client", "other"] as const;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

function parseValue(v: string | null): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function CrmBoardContent() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"board" | "leads">("board");

  // Create-opportunity dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newProbability, setNewProbability] = useState<number>(20);
  const [newSource, setNewSource] = useState<string>("other");

  // Create-lead dialog
  const [showLead, setShowLead] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadTitle, setLeadTitle] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadContact, setLeadContact] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSource, setLeadSource] = useState<string>("other");

  // Generate-draft-tender dialog
  const [draftLead, setDraftLead] = useState<Lead | null>(null);
  const [sites, setSites] = useState<SiteLite[]>([]);
  const [draftSiteId, setDraftSiteId] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oRes, lRes, fRes, cRes] = await Promise.all([
        authFetch("/crm/opportunities?limit=200"),
        authFetch("/crm/leads?limit=100"),
        authFetch("/crm/forecast"),
        authFetch("/master-data/clients?pageSize=100").catch(() => null)
      ]);
      if (!oRes.ok) throw new Error(`Failed to load opportunities: ${await oRes.text()}`);
      if (!lRes.ok) throw new Error(`Failed to load leads: ${await lRes.text()}`);
      if (!fRes.ok) throw new Error(`Failed to load forecast: ${await fRes.text()}`);
      const oData = (await oRes.json()) as { items: Opportunity[] };
      const lData = (await lRes.json()) as { items: Lead[] };
      const fData = (await fRes.json()) as ForecastResponse;
      setOpps(oData.items);
      setLeads(lData.items);
      setForecast(fData);
      if (cRes && cRes.ok) {
        const cData = (await cRes.json()) as { items?: ClientLite[] } | ClientLite[];
        setClients(Array.isArray(cData) ? cData : (cData.items ?? []));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const oppsByStage = useMemo(() => {
    const map: Record<OpportunityStage, Opportunity[]> = {
      new: [], qualified: [], quoting: [], won: [], lost: []
    };
    for (const o of opps) map[o.stage].push(o);
    return map;
  }, [opps]);

  async function handleCreate() {
    if (!newTitle.trim() || !newClientId) {
      setCreateError("Title and client are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await authFetch("/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          clientId: newClientId,
          estimatedValue: newValue || undefined,
          probability: newProbability,
          source: newSource
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as Opportunity;
      setShowCreate(false);
      setNewTitle(""); setNewClientId(""); setNewValue(""); setNewProbability(20); setNewSource("other");
      navigate(`/crm/opportunities/${created.id}`);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateLead() {
    if (!leadTitle.trim()) {
      setLeadError("Title is required.");
      return;
    }
    setLeadSaving(true);
    setLeadError(null);
    try {
      const res = await authFetch("/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: leadTitle.trim(),
          companyName: leadCompany || undefined,
          contactName: leadContact || undefined,
          contactEmail: leadEmail || undefined,
          source: leadSource
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setShowLead(false);
      setLeadTitle(""); setLeadCompany(""); setLeadContact(""); setLeadEmail(""); setLeadSource("other");
      await load();
    } catch (err) {
      setLeadError((err as Error).message);
    } finally {
      setLeadSaving(false);
    }
  }

  async function openDraftDialog(lead: Lead) {
    if (!lead.client?.id) {
      alert(
        "This lead is not linked to a Client yet. Open the lead, link it to a Client, then retry."
      );
      return;
    }
    setDraftLead(lead);
    setDraftSiteId("");
    setDraftTitle(lead.title);
    setDraftError(null);
    try {
      const res = await authFetch("/master-data/sites?pageSize=100");
      if (res.ok) {
        const data = (await res.json()) as { items?: SiteLite[] } | SiteLite[];
        setSites(Array.isArray(data) ? data : (data.items ?? []));
      }
    } catch {
      // Site list is best-effort; the dialog still submits with any typed id.
    }
  }

  async function generateDraftTender() {
    if (!draftLead) return;
    if (!draftSiteId) {
      setDraftError("Site is required to create a Tender.");
      return;
    }
    setDraftSaving(true);
    setDraftError(null);
    try {
      const res = await authFetch(`/crm/leads/${draftLead.id}/generate-draft-tender`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: draftSiteId,
          title: draftTitle.trim() || undefined
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const opp = (await res.json()) as Opportunity & {
        convertedTender?: { id: string } | null;
      };
      setDraftLead(null);
      if (opp.convertedTender?.id) {
        navigate(`/tenders/${opp.convertedTender.id}`);
      } else if (opp.convertedTenderId) {
        navigate(`/tenders/${opp.convertedTenderId}`);
      } else {
        await load();
      }
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setDraftSaving(false);
    }
  }

  async function qualifyLead(lead: Lead) {
    const clientId = lead.client?.id;
    if (!clientId) {
      alert(
        "This lead is not linked to a Client yet. Open the lead, link it to a Client, then retry."
      );
      return;
    }
    try {
      const res = await authFetch(`/crm/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId })
      });
      if (!res.ok) throw new Error(await res.text());
      const opp = (await res.json()) as Opportunity;
      navigate(`/crm/opportunities/${opp.id}`);
    } catch (err) {
      alert(`Failed to qualify lead: ${(err as Error).message}`);
    }
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: 0 }}>CRM</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowLead(true)}
            style={{ padding: "10px 18px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", minHeight: 44 }}
          >
            + Capture Lead
          </button>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: "var(--color-orange, #FEAA6D)", color: "#000", border: "none",
              borderRadius: 6, padding: "10px 20px", cursor: "pointer", fontWeight: 600, minHeight: 44
            }}
          >
            + New Opportunity
          </button>
        </div>
      </div>

      {/* Forecast summary */}
      {forecast && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, margin: 0 }}>Weighted forecast (open pipeline)</h2>
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted, #666)" }}>
                Open opportunities: <strong style={{ color: "#000" }}>{forecast.totals.count}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #666)" }}>
                Gross: <strong style={{ color: "#000" }}>{fmtMoney(forecast.totals.grossValue)}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #666)" }}>
                Weighted: <strong style={{ color: "var(--color-teal, #005B61)" }}>{fmtMoney(forecast.totals.weightedValue)}</strong>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {forecast.buckets.map((b) => {
              const stage = STAGES.find((s) => s.key === b.stage);
              const pct = forecast.totals.weightedValue > 0
                ? (b.weightedValue / forecast.totals.weightedValue) * 100
                : 0;
              return (
                <div key={b.stage} style={{ flex: 1, background: "#f6f6f6", borderRadius: 6, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: stage?.colour ?? "#000" }}>{stage?.label ?? b.stage}</span>
                    <span style={{ color: "var(--text-muted, #666)" }}>{b.count}</span>
                  </div>
                  <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, marginBottom: 6, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: stage?.colour ?? "#666" }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #666)" }}>
                    {fmtMoney(b.weightedValue)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
        {[{ k: "board", l: "Pipeline Board" }, { k: "leads", l: `Leads (${leads.length})` }].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as "board" | "leads")}
            style={{
              padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.k ? "2px solid var(--color-orange, #FEAA6D)" : "2px solid transparent",
              fontWeight: tab === t.k ? 600 : 400, minHeight: 44
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-muted, #666)" }}>Loading CRM data…</p>}
      {error && (
        <div role="alert" style={{ color: "#dc2626", padding: 12, background: "#fef2f2", borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Board */}
      {!loading && !error && tab === "board" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {STAGES.map((stage) => {
            const rows = oppsByStage[stage.key];
            const stageGross = rows.reduce((sum, r) => sum + parseValue(r.estimatedValue), 0);
            return (
              <div key={stage.key} style={{ background: "#f6f6f6", borderRadius: 8, padding: 10, minHeight: 300 }}>
                <div style={{ borderBottom: `3px solid ${stage.colour}`, paddingBottom: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ color: stage.colour }}>{stage.label}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted, #666)" }}>
                    {rows.length} · {fmtMoney(stageGross)}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rows.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                      style={{
                        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
                        padding: 10, cursor: "pointer"
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{opp.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted, #666)", marginBottom: 4 }}>
                        {opp.client.name}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span>{opp.estimatedValue ? fmtMoney(parseValue(opp.estimatedValue)) : "-"}</span>
                        <span style={{ color: "var(--text-muted, #666)" }}>{opp.probability}%</span>
                      </div>
                      {opp.nextActionAt && (
                        <div style={{ fontSize: 11, color: "var(--text-muted, #888)", marginTop: 4 }}>
                          Next: {fmtDate(opp.nextActionAt)}
                        </div>
                      )}
                      {opp.convertedTender && (
                        <div style={{ marginTop: 6 }}>
                          <TenderChip
                            tenderId={opp.convertedTender.id}
                            tenderNumber={opp.convertedTender.tenderNumber}
                            status={opp.convertedTender.status}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <div style={{ padding: 8, color: "var(--text-muted, #999)", fontSize: 12, textAlign: "center" }}>
                      No opportunities
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leads */}
      {!loading && !error && tab === "leads" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {leads.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #888)" }}>
              No leads captured yet.{" "}
              <button
                onClick={() => setShowLead(true)}
                style={{ color: "var(--color-orange, #FEAA6D)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Capture the first one.
              </button>
            </div>
          )}
          {leads.map((lead) => (
            <div key={lead.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <strong>{lead.title}</strong>
                  <span style={{ background: "#f3f4f6", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>{lead.status}</span>
                  <span style={{ background: "#e0f2fe", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>{lead.source}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted, #666)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {lead.companyName && <span>Company: {lead.companyName}</span>}
                  {lead.contactName && <span>Contact: {lead.contactName}</span>}
                  {lead.contactEmail && <span>Email: {lead.contactEmail}</span>}
                  {lead.client && <span>Client: {lead.client.name}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lead.status !== "converted" && (
                  <button
                    onClick={() => void qualifyLead(lead)}
                    style={{
                      padding: "8px 14px", borderRadius: 6, border: "1px solid #ccc",
                      background: "#fff", cursor: "pointer",
                      fontWeight: 600, minHeight: 40
                    }}
                  >
                    Qualify → Opportunity
                  </button>
                )}
                <button
                  onClick={() => void openDraftDialog(lead)}
                  style={{
                    padding: "8px 14px", borderRadius: 6, border: "none",
                    background: "var(--color-orange, #FEAA6D)", cursor: "pointer",
                    fontWeight: 600, minHeight: 40
                  }}
                >
                  Generate draft tender
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Opportunity modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading, Syne)" }}>New Opportunity</h2>
          {createError && <ErrorBox>{createError}</ErrorBox>}
          <Field label="Title *">
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                   placeholder="What are they after?" style={inputStyle} />
          </Field>
          <Field label="Client *">
            <select value={newClientId} onChange={(e) => setNewClientId(e.target.value)} style={inputStyle}>
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <Field label="Estimated value (AUD)">
              <input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Probability %">
              <input type="number" min={0} max={100} value={newProbability}
                     onChange={(e) => setNewProbability(Number(e.target.value))} style={inputStyle} />
            </Field>
          </div>
          <Field label="Source">
            <select value={newSource} onChange={(e) => setNewSource(e.target.value)} style={inputStyle}>
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </Field>
          <ModalActions
            onCancel={() => setShowCreate(false)}
            onConfirm={() => void handleCreate()}
            confirmLabel={creating ? "Creating…" : "Create"}
            disabled={creating}
          />
        </Modal>
      )}

      {/* Generate draft tender modal */}
      {draftLead && (
        <Modal onClose={() => setDraftLead(null)}>
          <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading, Syne)" }}>
            Generate draft tender
          </h2>
          <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: "var(--text-muted, #666)" }}>
            Creates a <strong>DRAFT</strong> tender from lead <em>{draftLead.title}</em>. The
            lead is qualified into an Opportunity and converted in one step — no data re-keying.
          </p>
          {draftError && <ErrorBox>{draftError}</ErrorBox>}
          <Field label="Site *">
            <select value={draftSiteId} onChange={(e) => setDraftSiteId(e.target.value)} style={inputStyle}>
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.suburb ? ` — ${s.suburb}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tender title">
            <input type="text" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} style={inputStyle} />
          </Field>
          <ModalActions
            onCancel={() => setDraftLead(null)}
            onConfirm={() => void generateDraftTender()}
            confirmLabel={draftSaving ? "Generating…" : "Generate draft"}
            disabled={draftSaving}
          />
        </Modal>
      )}

      {/* Capture Lead modal */}
      {showLead && (
        <Modal onClose={() => setShowLead(false)}>
          <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading, Syne)" }}>Capture a Lead</h2>
          {leadError && <ErrorBox>{leadError}</ErrorBox>}
          <Field label="Title *">
            <input type="text" value={leadTitle} onChange={(e) => setLeadTitle(e.target.value)}
                   placeholder="One-line summary of the interest" style={inputStyle} />
          </Field>
          <Field label="Company">
            <input type="text" value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} style={inputStyle} />
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <Field label="Contact name">
              <input type="text" value={leadContact} onChange={(e) => setLeadContact(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Contact email">
              <input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <Field label="Source">
            <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} style={inputStyle}>
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </Field>
          <ModalActions
            onCancel={() => setShowLead(false)}
            onConfirm={() => void handleCreateLead()}
            confirmLabel={leadSaving ? "Saving…" : "Capture"}
            disabled={leadSaving}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Small local UI helpers ────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 4,
  border: "1px solid #ccc", boxSizing: "border-box"
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" style={{ color: "#dc2626", marginBottom: 12, padding: 8, background: "#fef2f2", borderRadius: 4 }}>
      {children}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 8, padding: 28, width: 520, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function TenderChip({
  tenderId, tenderNumber, status
}: { tenderId: string; tenderNumber: string; status: string }) {
  const navigate = useNavigate();
  const known = (status in TENDER_STATUS_LABEL) as boolean;
  const label = known ? TENDER_STATUS_LABEL[status as TenderStatus] : status;
  const accent = known ? TENDER_STATUS_ACCENT[status as TenderStatus] : "#6B7280";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); navigate(`/tenders/${tenderId}`); }}
      title={`Open tender ${tenderNumber}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "2px 8px", borderRadius: 999,
        border: `1px solid ${accent}`, background: "#fff",
        color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer",
        maxWidth: "100%"
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {tenderNumber} · {label}
      </span>
    </button>
  );
}

function ModalActions({
  onCancel, onConfirm, confirmLabel, disabled
}: {
  onCancel: () => void; onConfirm: () => void; confirmLabel: string; disabled: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
      <button
        onClick={onCancel} disabled={disabled}
        style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", minHeight: 44 }}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm} disabled={disabled}
        style={{
          padding: "10px 20px", borderRadius: 6, border: "none",
          background: "var(--color-orange, #FEAA6D)", cursor: "pointer",
          fontWeight: 600, minHeight: 44, opacity: disabled ? 0.6 : 1
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
