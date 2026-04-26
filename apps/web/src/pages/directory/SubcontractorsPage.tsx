import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ContactsTab } from "../../components/contacts/ContactsTab";

type Subcontractor = {
  id: string;
  name: string;
  tradingName: string | null;
  businessType: string;
  entityType: string;
  categories: string[];
  prequalStatus: string;
  isActive: boolean;
  abn: string | null;
  email: string | null;
  phone: string | null;
  physicalSuburb: string | null;
  physicalState: string | null;
  expiryAlerts?: number;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  isPrimary: boolean;
};

type Licence = {
  id: string;
  licenceType: string;
  licenceNumber: string | null;
  issuingAuthority: string | null;
  expiryDate: string | null;
  status: string;
};

type Insurance = {
  id: string;
  insuranceType: string;
  insurerName: string | null;
  policyNumber: string | null;
  coverageAmount: string | null;
  expiryDate: string | null;
  status: string;
};

type SubDocument = {
  id: string;
  documentType: string;
  name: string;
  filePath: string | null;
  uploadedAt: string;
  notes: string | null;
  uploadedBy: { firstName: string; lastName: string } | null;
};

type SubcontractorDetail = Subcontractor & {
  contacts: Contact[];
  licences: Licence[];
  insurances: Insurance[];
  documents: SubDocument[];
  prequalNotes: string | null;
  swmsOnFile: boolean;
  internalNotes: string | null;
};

const DOCUMENT_TYPES: Array<{ value: string; label: string }> = [
  { value: "swms", label: "SWMS" },
  { value: "insurance_certificate", label: "Insurance certificate" },
  { value: "licence", label: "Licence" },
  { value: "rate_card", label: "Rate card" },
  { value: "credit_application", label: "Credit application" },
  { value: "other", label: "Other" }
];

const BUSINESS_TYPES = [
  { value: "company", label: "Company" },
  { value: "sole_trader", label: "Sole Trader" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust" },
  { value: "private_person", label: "Private Person" }
];
const ENTITY_TYPES = [
  { value: "subcontractor", label: "Subcontractor" },
  { value: "supplier", label: "Supplier" },
  { value: "both", label: "Both" }
];
const PREQUAL_STATUSES = [
  { value: "approved", label: "Approved", color: "#16a34a" },
  { value: "pending", label: "Pending", color: "#f97316" },
  { value: "suspended", label: "Suspended", color: "#dc2626" },
  { value: "rejected", label: "Rejected", color: "#6b7280" }
];

function prequalTone(status: string): string {
  return PREQUAL_STATUSES.find((s) => s.value === status)?.color ?? "#6b7280";
}

function expiryTone(status: string): string {
  if (status === "expired") return "#dc2626";
  if (status === "expiring_soon") return "#f97316";
  return "#16a34a";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function SubcontractorsPage() {
  const { authFetch, user } = useAuth();
  const canManage = Boolean(user?.permissions?.includes("directory.manage"));
  const canAdmin = Boolean(user?.permissions?.includes("directory.admin"));

  const [items, setItems] = useState<Subcontractor[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [prequalFilter, setPrequalFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (prequalFilter) params.set("prequal", prequalFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());
      const response = await authFetch(`/directory?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      setItems((await response.json()) as Subcontractor[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, typeFilter, categoryFilter, prequalFilter, statusFilter, search]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await authFetch("/lists/subcontractor-categories");
      if (!response.ok) return;
      const data = (await response.json()) as { items: Array<{ value: string; label: string }> };
      setCategories(data.items.map((i) => i.label));
    } catch {
      // Non-fatal
    }
  }, [authFetch]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  return (
    <div style={{ padding: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 className="s7-type-page-heading" style={{ margin: 0 }}>
          Subcontractors &amp; Suppliers
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
          Business directory — prequalification, licences, insurances, credit.
        </p>
        <div style={{ marginLeft: "auto" }}>
          {canManage ? (
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => setCreating(true)}
            >
              + New entry
            </button>
          ) : null}
        </div>
      </header>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          padding: 10,
          background: "var(--surface-subtle, rgba(0,0,0,0.02))",
          borderRadius: 6,
          marginBottom: 12
        }}
      >
        <select
          className="s7-select s7-input--sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          className="s7-select s7-input--sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="s7-select s7-input--sm"
          value={prequalFilter}
          onChange={(e) => setPrequalFilter(e.target.value)}
        >
          <option value="">All prequal</option>
          {PREQUAL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          className="s7-select s7-input--sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="">All statuses</option>
        </select>
        <input
          className="s7-input s7-input--sm"
          placeholder="Search name / ABN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No entries match the current filters.</p>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 400px", minWidth: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
                <tr>
                  {["Name", "Type", "Categories", "Prequal", "Alerts", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                        fontSize: 10,
                        textTransform: "uppercase",
                        color: "var(--text-muted)"
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    style={{
                      borderTop: "1px solid var(--border, #e5e7eb)",
                      cursor: "pointer",
                      background: selectedId === row.id ? "var(--surface-muted, #f3f4f6)" : undefined,
                      opacity: row.isActive ? 1 : 0.5
                    }}
                  >
                    <td style={{ padding: "6px 8px" }}>
                      <strong>{row.name}</strong>
                      {row.tradingName ? (
                        <div style={{ color: "var(--text-muted)", fontSize: 11 }}>t/a {row.tradingName}</div>
                      ) : null}
                    </td>
                    <td style={{ padding: "6px 8px", textTransform: "capitalize" }}>{row.entityType}</td>
                    <td style={{ padding: "6px 8px", fontSize: 11 }}>{row.categories.join(", ") || "—"}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          background: prequalTone(row.prequalStatus),
                          color: "#fff",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}
                      >
                        {row.prequalStatus}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {row.expiryAlerts && row.expiryAlerts > 0 ? (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 8px",
                            background: "#f97316",
                            color: "#fff",
                            borderRadius: 999
                          }}
                        >
                          {row.expiryAlerts} expiring
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedId ? (
            <div style={{ flex: "0 0 480px" }}>
              <SubcontractorDetail
                id={selectedId}
                canManage={canManage}
                canAdmin={canAdmin}
                onClose={() => setSelectedId(null)}
                onChanged={() => {
                  void loadList();
                }}
              />
            </div>
          ) : null}
        </div>
      )}

      {creating ? (
        <CreateSubcontractorModal
          categories={categories}
          onClose={() => setCreating(false)}
          onCreated={(newId) => {
            setCreating(false);
            setSelectedId(newId);
            void loadList();
          }}
        />
      ) : null}
    </div>
  );
}

function SubcontractorDetail({
  id,
  canManage,
  canAdmin,
  onClose,
  onChanged
}: {
  id: string;
  canManage: boolean;
  canAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { authFetch } = useAuth();
  const [detail, setDetail] = useState<SubcontractorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "contacts" | "documents">("overview");
  const [docModalOpen, setDocModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/directory/${id}`);
      if (!response.ok) throw new Error(await response.text());
      setDetail((await response.json()) as SubcontractorDetail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // PR D FIX 2 — when promoting to "approved", surface a warning if any of
  // the compliance pillars (documents, active licences, active insurances)
  // are missing. Not a hard block — the admin can still approve, but they
  // do so consciously rather than by accident.
  const updatePrequal = async (status: string) => {
    if (status === "approved" && detail) {
      const missing: string[] = [];
      if (detail.documents.length === 0) missing.push("documents (e.g. SWMS, insurance cert)");
      if (!detail.licences.some((l) => l.status === "active")) missing.push("an active licence");
      if (!detail.insurances.some((i) => i.status === "active")) missing.push("an active insurance");
      if (missing.length > 0) {
        const proceed = window.confirm(
          `Incomplete compliance records — missing: ${missing.join(", ")}.\n\nApprove anyway?`
        );
        if (!proceed) return;
      }
    }
    const notes = window.prompt("Prequalification notes (optional):", detail?.prequalNotes ?? "");
    if (notes === null) return;
    const response = await authFetch(`/directory/${id}/prequal`, {
      method: "PATCH",
      body: JSON.stringify({ prequalStatus: status, prequalNotes: notes || null })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
    onChanged();
  };

  const addDocument = async (body: { documentType: string; name: string; notes: string | null }) => {
    const response = await authFetch(`/directory/${id}/documents`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    await load();
    return true;
  };

  const deleteDocument = async (docId: string) => {
    if (!window.confirm("Delete this document record?")) return;
    const response = await authFetch(`/directory/${id}/documents/${docId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const softDelete = async () => {
    if (!window.confirm("Mark this entry inactive?")) return;
    const response = await authFetch(`/directory/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    onChanged();
    onClose();
  };

  if (loading) return <div className="s7-card"><p>Loading…</p></div>;
  if (error) return <div className="s7-card"><p style={{ color: "var(--status-danger)" }}>{error}</p></div>;
  if (!detail) return null;

  return (
    <div className="s7-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
            {detail.name}
          </h3>
          {detail.tradingName ? (
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
              t/a {detail.tradingName}
            </p>
          ) : null}
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 12, textTransform: "capitalize" }}>
            {detail.entityType} · {detail.businessType.replace(/_/g, " ")}
            {detail.abn ? ` · ABN ${detail.abn}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <PrequalBanner status={detail.prequalStatus} notes={detail.prequalNotes} />

      <nav
        role="tablist"
        style={{ display: "flex", gap: 4, marginTop: 12, borderBottom: "1px solid var(--border, #e5e7eb)" }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={tab === "overview" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "contacts"}
          className={tab === "contacts" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
          onClick={() => setTab("contacts")}
        >
          Contacts ({detail.contacts.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "documents"}
          className={tab === "documents" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
          onClick={() => setTab("documents")}
        >
          Documents ({detail.documents.length})
        </button>
      </nav>

      {tab === "contacts" ? (
        <div style={{ marginTop: 12 }}>
          <ContactsTab
            organisationType={detail.entityType === "supplier" ? "SUPPLIER" : "SUBCONTRACTOR"}
            organisationId={detail.id}
            canManage={canManage}
            onChanged={() => {
              void load();
              onChanged();
            }}
          />
        </div>
      ) : tab === "documents" ? (
        <DocumentsTab
          documents={detail.documents}
          canManage={canManage}
          onAddClick={() => setDocModalOpen(true)}
          onDelete={deleteDocument}
        />
      ) : (
        <>
      <Section title="Contact">
        <dl style={{ margin: 0, fontSize: 13 }}>
          {detail.email ? <DRow label="Email" value={detail.email} /> : null}
          {detail.phone ? <DRow label="Phone" value={detail.phone} /> : null}
          {detail.physicalSuburb ? (
            <DRow
              label="Based"
              value={`${detail.physicalSuburb}${detail.physicalState ? `, ${detail.physicalState}` : ""}`}
            />
          ) : null}
        </dl>
      </Section>

      {detail.categories.length > 0 ? (
        <Section title="Categories">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {detail.categories.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background: "var(--surface-muted, #f3f4f6)",
                  borderRadius: 999
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title={`Licences (${detail.licences.length})`}>
        {detail.licences.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>None recorded.</p>
        ) : (
          detail.licences.map((l) => (
            <div key={l.id} style={{ fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <strong style={{ textTransform: "capitalize" }}>{l.licenceType.replace(/_/g, " ")}</strong>
              {l.licenceNumber ? <span>({l.licenceNumber})</span> : null}
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· Expires {fmtDate(l.expiryDate)}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  padding: "1px 6px",
                  background: expiryTone(l.status),
                  color: "#fff",
                  borderRadius: 999,
                  textTransform: "uppercase"
                }}
              >
                {l.status.replace(/_/g, " ")}
              </span>
            </div>
          ))
        )}
      </Section>

      <Section title={`Insurances (${detail.insurances.length})`}>
        {detail.insurances.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>None recorded.</p>
        ) : (
          detail.insurances.map((ins) => (
            <div key={ins.id} style={{ fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <strong style={{ textTransform: "capitalize" }}>{ins.insuranceType.replace(/_/g, " ")}</strong>
              {ins.insurerName ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· {ins.insurerName}</span> : null}
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>· Expires {fmtDate(ins.expiryDate)}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  padding: "1px 6px",
                  background: expiryTone(ins.status),
                  color: "#fff",
                  borderRadius: 999,
                  textTransform: "uppercase"
                }}
              >
                {ins.status.replace(/_/g, " ")}
              </span>
            </div>
          ))
        )}
      </Section>

      {detail.internalNotes ? (
        <Section title="Internal notes">
          <p style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0 }}>{detail.internalNotes}</p>
        </Section>
      ) : null}
        </>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
        {canAdmin ? (
          <>
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() => void updatePrequal("approved")}
            >
              Approve prequal
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => void updatePrequal("suspended")}
            >
              Suspend
            </button>
            {detail.isActive ? (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => void softDelete()}
                style={{ marginLeft: "auto", color: "var(--status-danger)" }}
              >
                Deactivate
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {docModalOpen ? (
        <DocumentUploadModal
          onClose={() => setDocModalOpen(false)}
          onSubmit={async (body) => {
            const ok = await addDocument(body);
            if (ok) setDocModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function DocumentsTab({
  documents,
  canManage,
  onAddClick,
  onDelete
}: {
  documents: SubDocument[];
  canManage: boolean;
  onAddClick: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {documents.length} document{documents.length === 1 ? "" : "s"}
        </div>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={onAddClick}>
            + Upload document
          </button>
        ) : null}
      </div>
      {documents.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
          No documents — upload SWMS, insurance certs, licences, rate cards.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {["Type", "Name", "Uploaded", "By", ""].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                  <td style={{ padding: "6px 8px", fontSize: 12, textTransform: "capitalize" }}>
                    {(DOCUMENT_TYPES.find((t) => t.value === d.documentType)?.label) ?? d.documentType.replace(/_/g, " ")}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 13 }}>
                    <strong>{d.name}</strong>
                    {d.notes ? (
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{d.notes}</p>
                    ) : null}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(d.uploadedAt)}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12, color: "var(--text-muted)" }}>
                    {d.uploadedBy ? `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}` : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    {canManage ? (
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => void onDelete(d.id)}
                        aria-label="Delete"
                        title="Delete"
                      >×</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DocumentUploadModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (body: { documentType: string; name: string; notes: string | null }) => Promise<void>;
}) {
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].value);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("File name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ documentType, name: name.trim(), notes: notes.trim() || null });
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", justifyContent: "center", alignItems: "center" }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="s7-card"
        style={{ padding: 20, width: "min(440px, 90vw)" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>Upload document</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Records the document metadata. The actual file lives in SharePoint and
          is uploaded separately for now.
        </p>
        <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          <span>Type *</span>
          <select
            className="s7-select"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            required
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          <span>File name *</span>
          <input
            className="s7-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SWMS_concrete_cutting_2026.pdf"
            required
          />
        </label>
        <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          <span>Notes (optional)</span>
          <textarea
            className="s7-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </label>
        {err ? <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{err}</p> : null}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="s7-btn s7-btn--primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function PrequalBanner({ status, notes }: { status: string; notes: string | null }) {
  const colour = prequalTone(status);
  const label =
    status === "approved"
      ? "Prequalified supplier"
      : status === "suspended"
      ? "SUSPENDED — do not engage without approval"
      : status === "rejected"
      ? "Prequalification rejected"
      : "Prequalification pending — review required";
  return (
    <div
      style={{
        borderRadius: 6,
        padding: 10,
        background: `${colour}20`,
        borderLeft: `4px solid ${colour}`,
        margin: "12px 0",
        fontSize: 13
      }}
    >
      <strong>{label}</strong>
      {notes ? <p style={{ margin: "4px 0 0", fontSize: 12 }}>{notes}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 4,
          letterSpacing: 0.4
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <span style={{ color: "var(--text-muted)", minWidth: 70 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function CreateSubcontractorModal({
  categories,
  onClose,
  onCreated
}: {
  categories: string[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    name: "",
    tradingName: "",
    businessType: "company",
    entityType: "subcontractor",
    abn: "",
    email: "",
    phone: "",
    physicalSuburb: "",
    physicalState: "QLD",
    categories: [] as string[]
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("Name required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const response = await authFetch("/directory", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          tradingName: form.tradingName || null,
          abn: form.abn || null,
          email: form.email || null,
          phone: form.phone || null,
          physicalSuburb: form.physicalSuburb || null
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const created = (await response.json()) as { id: string };
      onCreated(created.id);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const isPrivate = form.businessType === "private_person";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="s7-card"
        style={{ padding: 20, width: "min(560px, 90vw)", maxHeight: "90vh", overflow: "auto" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>
          New directory entry
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>{isPrivate ? "Full name" : "Legal name"} *</span>
            <input
              className="s7-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Business type</span>
            <select
              className="s7-select"
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            >
              {BUSINESS_TYPES.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Entity role</span>
            <select
              className="s7-select"
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value })}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          {!isPrivate ? (
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Trading name</span>
              <input
                className="s7-input"
                value={form.tradingName}
                onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
              />
            </label>
          ) : null}
          {!isPrivate ? (
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              <span>ABN</span>
              <input
                className="s7-input"
                value={form.abn}
                onChange={(e) => setForm({ ...form, abn: e.target.value })}
              />
            </label>
          ) : null}
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Email</span>
            <input
              className="s7-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Phone</span>
            <input
              className="s7-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Suburb</span>
            <input
              className="s7-input"
              value={form.physicalSuburb}
              onChange={(e) => setForm({ ...form, physicalSuburb: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>State</span>
            <input
              className="s7-input"
              value={form.physicalState}
              onChange={(e) => setForm({ ...form, physicalState: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Categories (Ctrl/Cmd-click to multi-select)</span>
            <select
              multiple
              className="s7-select"
              value={form.categories}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setForm({ ...form, categories: values });
              }}
              size={Math.min(6, Math.max(3, categories.length))}
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        {err ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{err}</p> : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
            {submitting ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
