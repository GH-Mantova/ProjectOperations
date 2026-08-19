import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";

// CRM-1: Client-360 / Account detail page.
// Shows the Account with its linked Client identity, contacts, and
// read-only roll-ups of tenders and jobs. Never edits the transactional
// owners — roll-ups are display-only surfaces.

type OwnerLite = { id: string; firstName: string; lastName: string };

type ClientDetail = {
  id: string;
  name: string;
  code: string | null;
  tradingName: string | null;
  abn: string | null;
  acn: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  physicalAddress: string | null;
  physicalSuburb: string | null;
  physicalState: string | null;
  physicalPostcode: string | null;
  industry: string | null;
  winCount: number;
  tenderCount: number;
  winRate: string | null;
  lastTenderAt: string | null;
  lastWonAt: string | null;
  isActive: boolean;
  onHold: boolean;
  onHoldReason: string | null;
};

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  isAccountsContact: boolean;
  isActive: boolean;
};

type TenderRow = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

type JobRow = {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  createdAt: string;
};

type Account360 = {
  id: string;
  clientId: string | null;
  lifecycleStatus: "PROSPECT" | "ACTIVE" | "PAST";
  accountType: string;
  source: string;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: ClientDetail | null;
  owner: OwnerLite | null;
  archivedBy: OwnerLite | null;
  rollUps: {
    contacts: ContactRow[];
    tenders: TenderRow[];
    jobs: JobRow[];
  };
};

const LIFECYCLE_LABEL: Record<string, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  PAST: "Past"
};

const LIFECYCLE_COLOUR: Record<string, string> = {
  PROSPECT: "#6366f1",
  ACTIVE: "#16a34a",
  PAST: "#9ca3af"
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CLIENT: "Client",
  PROSPECT: "Prospect",
  HEAD_CONTRACTOR: "Head contractor",
  SUBCONTRACTOR: "Subcontractor",
  PARTNER: "Partner",
  OTHER: "Other"
};

const SOURCE_LABEL: Record<string, string> = {
  REFERRAL: "Referral",
  DIRECT: "Direct",
  TENDER_PORTAL: "Tender portal",
  COLD_OUTREACH: "Cold outreach",
  REPEAT_BUSINESS: "Repeat business",
  OTHER: "Other"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function fmtPct(val: string | null | undefined): string {
  if (val == null) return "—";
  const num = parseFloat(val);
  return Number.isFinite(num) ? `${(num * 100).toFixed(0)}%` : "—";
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "24px", maxWidth: 900, margin: "0 auto", fontFamily: "sans-serif" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#6366f1",
    fontSize: 14,
    padding: 0
  },
  badge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    background: "#fff"
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" },
  label: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  value: { fontSize: 14, color: "#111827", marginBottom: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 600 },
  td: { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", color: "#111827" },
  empty: { color: "#9ca3af", fontSize: 13, padding: "12px 0" },
  archivedBanner: {
    background: "#fef3c7",
    border: "1px solid #fbbf24",
    borderRadius: 6,
    padding: "10px 16px",
    marginBottom: 16,
    fontSize: 13,
    color: "#92400e"
  }
};

export function AccountDetailPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [account, setAccount] = useState<Account360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"contacts" | "tenders" | "jobs">("contacts");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/crm/accounts/${id}/360`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setAccount(await res.json() as Account360);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div style={s.page}>Loading…</div>;
  if (error) return <div style={s.page}><div style={{ color: "#dc2626" }}>{error}</div></div>;
  if (!account) return null;

  const { client, owner, rollUps } = account;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {client?.name ?? "Unnamed Account"}
        </h1>
        <span
          style={{
            ...s.badge,
            background: LIFECYCLE_COLOUR[account.lifecycleStatus] ?? "#6b7280"
          }}
        >
          {LIFECYCLE_LABEL[account.lifecycleStatus] ?? account.lifecycleStatus}
        </span>
        {account.archivedAt && (
          <span style={{ ...s.badge, background: "#9ca3af" }}>Archived</span>
        )}
      </div>

      {account.archivedAt && (
        <div style={s.archivedBanner}>
          This account was archived on {fmtDate(account.archivedAt)}
          {account.archivedBy
            ? ` by ${account.archivedBy.firstName} ${account.archivedBy.lastName}`
            : ""}.
        </div>
      )}

      {/* Account details */}
      <div style={s.card}>
        <div style={s.cardTitle}>Account</div>
        <div style={s.grid2}>
          <div>
            <div style={s.label}>Type</div>
            <div style={s.value}>{ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}</div>
          </div>
          <div>
            <div style={s.label}>Source</div>
            <div style={s.value}>{SOURCE_LABEL[account.source] ?? account.source}</div>
          </div>
          <div>
            <div style={s.label}>Owner</div>
            <div style={s.value}>
              {owner ? `${owner.firstName} ${owner.lastName}` : "—"}
            </div>
          </div>
          <div>
            <div style={s.label}>Created</div>
            <div style={s.value}>{fmtDate(account.createdAt)}</div>
          </div>
          {account.notes && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={s.label}>Notes</div>
              <div style={{ ...s.value, whiteSpace: "pre-wrap" }}>{account.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Client identity */}
      {client && (
        <div style={s.card}>
          <div style={s.cardTitle}>Client identity</div>
          <div style={s.grid2}>
            <div>
              <div style={s.label}>Legal name</div>
              <div style={s.value}>{client.name}</div>
            </div>
            {client.tradingName && (
              <div>
                <div style={s.label}>Trading name</div>
                <div style={s.value}>{client.tradingName}</div>
              </div>
            )}
            {client.abn && (
              <div>
                <div style={s.label}>ABN</div>
                <div style={s.value}>{client.abn}</div>
              </div>
            )}
            {client.acn && (
              <div>
                <div style={s.label}>ACN</div>
                <div style={s.value}>{client.acn}</div>
              </div>
            )}
            {client.industry && (
              <div>
                <div style={s.label}>Industry</div>
                <div style={s.value}>{client.industry}</div>
              </div>
            )}
            {client.email && (
              <div>
                <div style={s.label}>Email</div>
                <div style={s.value}>{client.email}</div>
              </div>
            )}
            {client.phone && (
              <div>
                <div style={s.label}>Phone</div>
                <div style={s.value}>{client.phone}</div>
              </div>
            )}
            {client.website && (
              <div>
                <div style={s.label}>Website</div>
                <div style={s.value}>
                  <a href={client.website} target="_blank" rel="noreferrer">{client.website}</a>
                </div>
              </div>
            )}
            {(client.physicalAddress || client.physicalSuburb) && (
              <div>
                <div style={s.label}>Address</div>
                <div style={s.value}>
                  {[client.physicalAddress, client.physicalSuburb, client.physicalState, client.physicalPostcode]
                    .filter(Boolean).join(", ")}
                </div>
              </div>
            )}
            {client.onHold && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>
                  On hold{client.onHoldReason ? `: ${client.onHoldReason}` : ""}
                </div>
              </div>
            )}
          </div>

          {/* Win/loss roll-up (read-only cache from Client model) */}
          <div style={{ display: "flex", gap: 32, marginTop: 16, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
            <div>
              <div style={s.label}>Tenders</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{client.tenderCount}</div>
            </div>
            <div>
              <div style={s.label}>Wins</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{client.winCount}</div>
            </div>
            <div>
              <div style={s.label}>Win rate</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtPct(client.winRate)}</div>
            </div>
            {client.lastTenderAt && (
              <div>
                <div style={s.label}>Last tender</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(client.lastTenderAt)}</div>
              </div>
            )}
            {client.lastWonAt && (
              <div>
                <div style={s.label}>Last won</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(client.lastWonAt)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roll-up tabs */}
      <div style={s.card}>
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {(["contacts", "tenders", "jobs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: activeTab === tab ? 700 : 400,
                background: activeTab === tab ? "#6366f1" : "#f3f4f6",
                color: activeTab === tab ? "#fff" : "#374151",
                fontSize: 13
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {" "}
              <span style={{ opacity: 0.7 }}>({rollUps[tab].length})</span>
            </button>
          ))}
        </div>

        {activeTab === "contacts" && (
          rollUps.contacts.length === 0
            ? <div style={s.empty}>No contacts linked to this client.</div>
            : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Role</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Phone</th>
                    <th style={s.th}>Primary</th>
                  </tr>
                </thead>
                <tbody>
                  {rollUps.contacts.map((c) => (
                    <tr key={c.id}>
                      <td style={s.td}>{c.firstName} {c.lastName}</td>
                      <td style={s.td}>{c.role ?? "—"}</td>
                      <td style={s.td}>{c.email ?? "—"}</td>
                      <td style={s.td}>{c.phone ?? c.mobile ?? "—"}</td>
                      <td style={s.td}>{c.isPrimary ? "Yes" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}

        {activeTab === "tenders" && (
          rollUps.tenders.length === 0
            ? <div style={s.empty}>No tenders found for this client.</div>
            : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Number</th>
                    <th style={s.th}>Title</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Due</th>
                    <th style={s.th}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rollUps.tenders.map((t) => (
                    <tr key={t.id}>
                      <td style={s.td}>{t.tenderNumber}</td>
                      <td style={s.td}>{t.title}</td>
                      <td style={s.td}>{t.status}</td>
                      <td style={s.td}>{fmtDate(t.dueDate)}</td>
                      <td style={s.td}>{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}

        {activeTab === "jobs" && (
          rollUps.jobs.length === 0
            ? <div style={s.empty}>No jobs found for this client.</div>
            : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Number</th>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rollUps.jobs.map((j) => (
                    <tr key={j.id}>
                      <td style={s.td}>{j.jobNumber}</td>
                      <td style={s.td}>{j.name}</td>
                      <td style={s.td}>{j.status}</td>
                      <td style={s.td}>{fmtDate(j.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}
      </div>
    </div>
  );
}
