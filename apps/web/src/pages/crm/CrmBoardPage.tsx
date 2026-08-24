import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DontPursueModal } from "./DontPursueModal";
import { LeadsTriageList } from "./LeadsTriageList";
import {
  createEntry,
  listDropReasons,
  listEntries,
  priceIt,
  type DropReason,
  type Entry
} from "./crm-api";

// CRM S4 — triage surface. Replaces the old kanban with a single Triage list:
// two actions per row (Price it → Draft Tender; Don't pursue → reason modal).
// One unified "+ Add new" modal creates a lead or opportunity.

// Canonical page title — matches ShellLayout breadcrumb and sidebar nav label.
// Exported so the regression test can assert it without rendering the component.
export const PAGE_TITLE = "Leads & opportunities";

type SiteLite = { id: string; name: string; suburb: string | null };
type ClientLite = { id: string; name: string };

type ForecastBucket = { stage: string; count: number; grossValue: number; weightedValue: number };
type ForecastResponse = {
  buckets: ForecastBucket[];
  totals: { count: number; grossValue: number; weightedValue: number };
};

const SOURCES = ["referral", "direct", "tender_portal", "cold", "repeat_client", "other"] as const;

function fmtMoney(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

export function CrmBoardContent() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [dropReasons, setDropReasons] = useState<DropReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // + Add new (unified) modal
  const [showAddNew, setShowAddNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newIsLead, setNewIsLead] = useState(true);
  const [newClientId, setNewClientId] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newSource, setNewSource] = useState<string>("other");

  // Don't pursue modal
  const [dontPursueTargetId, setDontPursueTargetId] = useState<string | null>(null);

  // Price it (draft tender) modal
  const [priceTarget, setPriceTarget] = useState<Entry | null>(null);
  const [sites, setSites] = useState<SiteLite[]>([]);
  const [priceSiteId, setPriceSiteId] = useState("");
  const [priceTitle, setPriceTitle] = useState("");
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eRows, fRes, cRes, drRows] = await Promise.all([
        listEntries(authFetch),
        authFetch("/crm/forecast"),
        authFetch("/master-data/clients?pageSize=100").catch(() => null),
        listDropReasons(authFetch).catch(() => [] as DropReason[])
      ]);
      if (!fRes.ok) throw new Error(`Failed to load forecast: ${await fRes.text()}`);
      const fData = (await fRes.json()) as ForecastResponse;
      setEntries(eRows);
      setForecast(fData);
      setDropReasons(drRows);
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

  // "Why we don't pursue" roll-up — group not_pursued by reason label.
  const dropRollup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.stage !== "not_pursued") continue;
      const label = e.dropReason?.label ?? "Unspecified";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  async function handleCreate() {
    if (!newTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createEntry(authFetch, {
        title: newTitle.trim(),
        isLead: newIsLead,
        clientId: newClientId || undefined,
        companyName: newCompany || undefined,
        contactName: newContact || undefined,
        contactEmail: newEmail || undefined,
        estimatedValue: newValue ? Number(newValue) : undefined,
        source: newSource
      });
      setShowAddNew(false);
      resetAddForm();
      await load();
      navigate(`/crm/opportunities/${created.id}`);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function resetAddForm() {
    setNewTitle("");
    setNewIsLead(true);
    setNewClientId("");
    setNewCompany("");
    setNewContact("");
    setNewEmail("");
    setNewValue("");
    setNewSource("other");
  }

  async function openPriceDialog(id: string) {
    const target = entries.find((e) => e.id === id);
    if (!target) return;
    if (!target.client?.id) {
      alert(
        "This entry is not linked to a Client yet. Open it, link a Client, then retry."
      );
      return;
    }
    setPriceTarget(target);
    setPriceSiteId("");
    setPriceTitle(target.title);
    setPriceError(null);
    try {
      const res = await authFetch("/master-data/sites?pageSize=100");
      if (res.ok) {
        const data = (await res.json()) as { items?: SiteLite[] } | SiteLite[];
        setSites(Array.isArray(data) ? data : (data.items ?? []));
      }
    } catch {
      // Site list is best-effort; user can retry if the picker is empty.
    }
  }

  async function handlePriceIt() {
    if (!priceTarget) return;
    if (!priceSiteId) {
      setPriceError("Site is required to create a Tender.");
      return;
    }
    setPricing(true);
    setPriceError(null);
    try {
      const { tenderId } = await priceIt(authFetch, priceTarget.id, priceSiteId, priceTitle.trim() || undefined);
      setPriceTarget(null);
      if (tenderId) {
        navigate(`/tenders/${tenderId}`);
      } else {
        await load();
      }
    } catch (err) {
      setPriceError((err as Error).message);
    } finally {
      setPricing(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 className="s7-type-page-title" style={{ margin: 0 }}>{PAGE_TITLE}</h1>
        <button
          onClick={() => setShowAddNew(true)}
          style={{
            background: "var(--color-orange, #FEAA6D)",
            color: "#000",
            border: "none",
            borderRadius: 6,
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: 600,
            minHeight: 44
          }}
        >
          + Add new
        </button>
      </div>

      {forecast && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, margin: 0 }}>
              Weighted forecast (open pipeline)
            </h2>
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted, #666)" }}>
                Open entries: <strong style={{ color: "#000" }}>{forecast.totals.count}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #666)" }}>
                Gross: <strong style={{ color: "#000" }}>{fmtMoney(forecast.totals.grossValue)}</strong>
              </span>
              <span style={{ color: "var(--text-muted, #666)" }}>
                Weighted: <strong style={{ color: "var(--color-teal, #005B61)" }}>{fmtMoney(forecast.totals.weightedValue)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ color: "var(--text-muted, #666)" }}>Loading CRM data…</p>}
      {error && (
        <div role="alert" style={{ color: "#dc2626", padding: 12, background: "#fef2f2", borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <LeadsTriageList
          entries={entries}
          onOpen={(id) => navigate(`/crm/opportunities/${id}`)}
          onPriceIt={(id) => void openPriceDialog(id)}
          onDontPursue={(id) => setDontPursueTargetId(id)}
        />
      )}

      {!loading && !error && dropRollup.length > 0 && (
        <section style={{ marginTop: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, margin: "0 0 10px" }}>
            Why we don't pursue
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {dropRollup.map(([label, count]) => (
              <div key={label} style={{ background: "#f9fafb", borderRadius: 6, padding: 10, border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted, #666)" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-teal, #005B61)" }}>{count}</div>
              </div>
            ))}
          </div>
          {dropReasons.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-muted, #888)", marginTop: 8 }}>
              Drop reasons will only be shown once configured under Settings.
            </p>
          )}
        </section>
      )}

      {/* + Add new modal (unified lead OR opportunity) */}
      {showAddNew && (
        <Modal onClose={() => setShowAddNew(false)}>
          <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading, Syne)" }}>Add new</h2>
          {createError && <ErrorBox>{createError}</ErrorBox>}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={newIsLead}
                onChange={(e) => setNewIsLead(e.target.checked)}
              />
              This is a lead (unqualified — no client link yet)
            </label>
          </div>

          <Field label="Title *">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="One-line summary"
              style={inputStyle}
            />
          </Field>

          {newIsLead ? (
            <>
              <Field label="Company">
                <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} style={inputStyle} />
              </Field>
              <div style={{ display: "flex", gap: 12 }}>
                <Field label="Contact name">
                  <input type="text" value={newContact} onChange={(e) => setNewContact(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Contact email">
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </>
          ) : (
            <Field label="Client">
              <select value={newClientId} onChange={(e) => setNewClientId(e.target.value)} style={inputStyle}>
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <Field label="Estimated value (AUD)">
              <input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Source">
              <select value={newSource} onChange={(e) => setNewSource(e.target.value)} style={inputStyle}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <ModalActions
            onCancel={() => setShowAddNew(false)}
            onConfirm={() => void handleCreate()}
            confirmLabel={creating ? "Creating…" : "Create"}
            disabled={creating}
          />
        </Modal>
      )}

      {/* Don't pursue modal */}
      {dontPursueTargetId && (
        <DontPursueModal
          entryId={dontPursueTargetId}
          entryTitle={entries.find((e) => e.id === dontPursueTargetId)?.title}
          onClose={() => setDontPursueTargetId(null)}
          onSaved={() => {
            setDontPursueTargetId(null);
            void load();
          }}
        />
      )}

      {/* Price it (draft tender) modal */}
      {priceTarget && (
        <Modal onClose={() => setPriceTarget(null)}>
          <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading, Syne)" }}>Price it — draft tender</h2>
          <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: "var(--text-muted, #666)" }}>
            Creates a <strong>DRAFT</strong> tender from <em>{priceTarget.title}</em> — no data re-keying.
          </p>
          {priceError && <ErrorBox>{priceError}</ErrorBox>}
          <Field label="Site *">
            <select value={priceSiteId} onChange={(e) => setPriceSiteId(e.target.value)} style={inputStyle}>
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.suburb ? ` — ${s.suburb}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tender title">
            <input type="text" value={priceTitle} onChange={(e) => setPriceTitle(e.target.value)} style={inputStyle} />
          </Field>
          <ModalActions
            onCancel={() => setPriceTarget(null)}
            onConfirm={() => void handlePriceIt()}
            confirmLabel={pricing ? "Creating…" : "Create draft tender"}
            disabled={pricing}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Small local UI helpers ────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  boxSizing: "border-box"
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
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ background: "#fff", borderRadius: 8, padding: 28, width: 520, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  disabled
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
      <button
        onClick={onCancel}
        disabled={disabled}
        style={{ padding: "10px 20px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", minHeight: 44 }}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        style={{
          padding: "10px 20px",
          borderRadius: 6,
          border: "none",
          background: "var(--color-orange, #FEAA6D)",
          cursor: "pointer",
          fontWeight: 600,
          minHeight: 44,
          opacity: disabled ? 0.6 : 1
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
