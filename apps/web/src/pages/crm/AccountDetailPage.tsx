import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { formatWinRate } from "./formatWinRate";
import { classifyNextAction, DUE_SOON_MS } from "./tendersRegisterPage.helpers";
import { buildCreateNoteBody } from "./RelationshipsPage";
import {
  archiveAccount,
  buildPatchAccountBody,
  patchAccount,
  unarchiveAccount,
  type AccountLifecycleStatus,
  type AccountSource,
  type AccountType
} from "./crm-api";

// CRM_ACCOUNT360_V2: Account 360 page — KPI tile row, Next-action rail card,
// two-column layout, enriched header with avatar + type + ABN, header actions
// Log contact / New thread / Edit account.
// CRM-1: Client-360 / Account detail page.
// Shows the Account with its linked Client identity, contacts, and
// read-only roll-ups of tenders and jobs. Never edits the transactional
// owners — roll-ups are display-only surfaces.

// Suppress unused-import warning: DUE_SOON_MS is re-exported from helpers to
// confirm we pulled classifyNextAction from the canonical location.
void DUE_SOON_MS;

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

type ContractRow = {
  id: string;
  contractNumber: string;
  contractValue: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  project: { id: string; projectNumber: string; name: string };
};

type OpportunityRow = {
  id: string;
  title: string;
  stage: string;
  probability: number;
  estimatedValue: string | null;
  expectedCloseDate: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
};

type ActivityItem =
  | { kind: "note"; id: string; body: string; createdAt: string; authorName: string; contactName: string | null }
  | { kind: "thread"; id: string; subject: string | null; createdAt: string; authorName: string; firstMessage: string | null };

type RelationshipNoteRow = {
  id: string;
  body: string;
  createdAt: string;
  author: OwnerLite;
  contact: { id: string; firstName: string; lastName: string } | null;
};

type CommThreadRow = {
  id: string;
  subject: string | null;
  createdAt: string;
  createdBy: OwnerLite;
  messages: Array<{ id: string; body: string; createdAt: string }>;
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
    tenderTotal: number;
    jobs: JobRow[];
    contracts: ContractRow[];
    opportunities: OpportunityRow[];
    relationshipNotes: RelationshipNoteRow[];
    commThreads: CommThreadRow[];
  };
};

/** CRM_ACCOUNT360_V2: Open CommTask for this account (earliest-due). */
type NextActionTask = {
  id: string;
  entityId: string;
  title: string;
  dueAt: string | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
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

/** Server cap for jobs roll-up. Tile shows "(showing up to N)" when at limit. */
const JOBS_CAP = 20;
/** Server cap for contracts roll-up. Tile shows "(showing up to N)" when at limit. */
const CONTRACTS_CAP = 50;

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

/**
 * CRM_ACCOUNT360_V2: Format a timestamp as a short relative age, e.g. "4d", "2h", "just now".
 * Used for the Last contact KPI tile.
 */
function fmtRelAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  const hours = Math.floor(mins / 60);
  if (hours < 1) return `${mins}m`;
  const days = Math.floor(hours / 24);
  if (days < 1) return `${hours}h`;
  const weeks = Math.floor(days / 7);
  if (weeks < 1) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 1) return `${weeks}w`;
  return `${months}mo`;
}

/**
 * CRM_ACCOUNT360_V2: Initials avatar from a client name.
 * Takes the first character of each word (up to 2 words).
 */
function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "24px", maxWidth: 900, margin: "0 auto" },
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
  const [activeTab, setActiveTab] = useState<"activity" | "contacts" | "tenders" | "jobs" | "contracts" | "opportunities">("activity");

  /** CRM_ACCOUNT360_V2: Earliest open CommTask for this account. */
  const [nextAction, setNextAction] = useState<NextActionTask | null>(null);

  /** CRM_ACCOUNT360_V2: Log-contact modal state. */
  const [logContactOpen, setLogContactOpen] = useState(false);

  // CRM-S5: inline-edit state.
  const [editing, setEditing] = useState(false);
  const [editLifecycle, setEditLifecycle] = useState<AccountLifecycleStatus>("PROSPECT");
  const [editType, setEditType] = useState<AccountType>("CLIENT");
  const [editSource, setEditSource] = useState<AccountSource>("OTHER");
  const [editNotes, setEditNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

  // CRM_ACCOUNT360_V2: Fetch open CommTasks for this account and keep earliest-due.
  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await authFetch(
          `/crm/comms/tasks?entityType=ACCOUNT&entityId=${encodeURIComponent(id)}&status=OPEN&limit=50`
        );
        if (!res.ok) return;
        const body = await res.json() as {
          items: Array<{
            id: string;
            entityId: string;
            title: string;
            dueAt: string | null;
            status: string;
            assignee: { id: string; firstName: string; lastName: string } | null;
          }>
        };
        const open = body.items.filter((t) => t.status === "OPEN");
        if (open.length === 0) { setNextAction(null); return; }
        // Keep earliest-due (matching TendersRegisterPage logic exactly).
        const sorted = [...open].sort((a, b) => {
          const aMs = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
          const bMs = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
          return aMs - bMs;
        });
        const first = sorted[0];
        if (first) setNextAction(first);
      } catch {
        // Next-action is enhancement-only; do not surface as page error.
      }
    })();
  }, [authFetch, id]);

  // CRM-S5: open the edit form, seeded from current account data.
  function openEdit() {
    if (!account) return;
    setEditLifecycle(account.lifecycleStatus);
    setEditType(account.accountType as AccountType);
    setEditSource(account.source as AccountSource);
    setEditNotes(account.notes ?? "");
    setSaveError(null);
    setEditing(true);
  }

  // CRM-S5: save the edit form — sends only changed fields.
  async function handleSave() {
    if (!account || !id) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = buildPatchAccountBody(
        {
          lifecycleStatus: account.lifecycleStatus,
          accountType: account.accountType as AccountType,
          source: account.source as AccountSource,
          notes: account.notes
        },
        {
          lifecycleStatus: editLifecycle,
          accountType: editType,
          source: editSource,
          notes: editNotes.trim() || null
        }
      );
      await patchAccount(authFetch, id, body);
      setEditing(false);
      void load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // CRM-S5: soft-archive the account.
  async function handleArchive() {
    if (!id) return;
    setArchiving(true);
    setSaveError(null);
    try {
      await archiveAccount(authFetch, id);
      setArchiveConfirm(false);
      void load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to archive.");
    } finally {
      setArchiving(false);
    }
  }

  // CRM-S5: restore a soft-archived account.
  async function handleUnarchive() {
    if (!id) return;
    setArchiving(true);
    setSaveError(null);
    try {
      await unarchiveAccount(authFetch, id);
      void load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to unarchive.");
    } finally {
      setArchiving(false);
    }
  }

  if (loading) return <div style={s.page}>Loading…</div>;
  if (error) return <div style={s.page}><div style={{ color: "#dc2626" }}>{error}</div></div>;
  if (!account) return null;

  const { client, owner, rollUps } = account;

  // CRM_ACCOUNT360_V2: Derive Last contact from the two ordered lists.
  // Both lists are server-ordered createdAt DESC, so first element is newest.
  const lastNoteAt = rollUps.relationshipNotes[0]?.createdAt ?? null;
  const lastThreadAt = rollUps.commThreads[0]?.createdAt ?? null;
  let lastContactAt: string | null = null;
  if (lastNoteAt && lastThreadAt) {
    lastContactAt = new Date(lastNoteAt) >= new Date(lastThreadAt) ? lastNoteAt : lastThreadAt;
  } else {
    lastContactAt = lastNoteAt ?? lastThreadAt;
  }

  // CRM_ACCOUNT360_V2: Classify next action for chip rendering.
  const naClass = classifyNextAction(nextAction?.dueAt ?? null, new Date());

  return (
    <div style={s.page}>
      {/* CRM_ACCOUNT360_V2: responsive rail — collapses to single column on narrow viewports */}
      <style>{`
        @media (max-width: 768px) {
          .account360-rail {
            width: 100% !important;
          }
          .account360-layout {
            flex-direction: column !important;
          }
        }
      `}</style>
      {/* CRM_ACCOUNT360_V2: Enriched page header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>

        {/* Avatar — initials from client name */}
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--brand-primary, #005B61)",
            color: "var(--text-inverse, #fff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          {nameInitials(client?.name ?? "?")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              {client?.name ?? "Unnamed Account"}
            </h1>
            {/* Account type */}
            <span style={{ fontSize: 12, color: "var(--text-secondary, #6b7280)", fontWeight: 500 }}>
              {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
            </span>
            {/* Lifecycle badge */}
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
          {/* ABN in header identity line */}
          {client?.abn && (
            <div style={{ fontSize: 12, color: "var(--text-muted, #9ca3af)", marginTop: 2 }}>
              ABN {client.abn}
            </div>
          )}
        </div>

        {/* CRM_ACCOUNT360_V2: Header actions — Log contact | New thread | Edit account */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {/* Log contact — posts through buildCreateNoteBody (same body builder as AccountsListPage) */}
          {!account.archivedAt && (
            <button
              onClick={() => setLogContactOpen(true)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid var(--border-default, #d1d5db)",
                background: "var(--surface-card, #fff)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary, #111827)"
              }}
            >
              Log contact
            </button>
          )}
          {/* New thread — relabelled deep-link into Comms hub (same contract as before) */}
          <Link
            to={`/crm/comms?entityType=ACCOUNT&entityId=${encodeURIComponent(account.id)}`}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--brand-primary, #6366f1)",
              background: "var(--brand-primary-light, #eef2ff)",
              color: "var(--brand-primary, #3730a3)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none"
            }}
          >
            New thread
          </Link>
          {/* Edit account */}
          {!editing && !account.archivedAt && (
            <button
              onClick={openEdit}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid var(--border-default, #d1d5db)",
                background: "var(--surface-card, #fff)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary, #111827)"
              }}
            >
              Edit account
            </button>
          )}
        </div>
      </div>

      {account.archivedAt && (
        <div style={s.archivedBanner}>
          This account was archived on {fmtDate(account.archivedAt)}
          {account.archivedBy
            ? ` by ${account.archivedBy.firstName} ${account.archivedBy.lastName}`
            : ""}.
        </div>
      )}

      {/* CRM_ACCOUNT360_V2: KPI tile row — directly under the account name */}
      <KpiTileRow
        tenderTotal={rollUps.tenderTotal}
        winRate={client?.winRate ?? null}
        jobsCount={rollUps.jobs.length}
        contractsCount={rollUps.contracts.length}
        lastContactAt={lastContactAt}
      />

      {/* CRM_ACCOUNT360_V2: Two-column layout — main + 320px right rail */}
      <div
        className="account360-layout"
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start"
        }}
      >
        {/* ── Main column ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Account details — inline-editable (CRM-S5) */}
          <div style={s.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={s.cardTitle as React.CSSProperties & { marginBottom: 0 }}>Account</div>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Archive / Unarchive */}
                {!account.archivedAt ? (
                  <button
                    onClick={() => setArchiveConfirm(true)}
                    disabled={archiving}
                    style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #fbbf24", background: "#fffbeb", color: "#92400e", cursor: "pointer", fontSize: 12 }}
                  >
                    Archive
                  </button>
                ) : (
                  <button
                    onClick={() => void handleUnarchive()}
                    disabled={archiving}
                    style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #6366f1", background: "#eef2ff", color: "#4338ca", cursor: "pointer", fontSize: 12 }}
                  >
                    {archiving ? "Restoring…" : "Unarchive"}
                  </button>
                )}
              </div>
            </div>

            {/* Archive confirm prompt */}
            {archiveConfirm && (
              <div role="alert" style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 6, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#92400e" }}>
                  Archive this account? It will be hidden from the list but not deleted.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => void handleArchive()}
                    disabled={archiving}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#f59e0b", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12 }}
                  >
                    {archiving ? "Archiving…" : "Yes, archive"}
                  </button>
                  <button
                    onClick={() => setArchiveConfirm(false)}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {saveError && (
              <div role="alert" style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, padding: "8px 10px", background: "#fef2f2", borderRadius: 6 }}>
                {saveError}
              </div>
            )}

            {editing ? (
              /* Edit form */
              <div>
                <div style={s.grid2}>
                  <label style={{ display: "block" }}>
                    <div style={s.label}>Lifecycle</div>
                    <select
                      value={editLifecycle}
                      onChange={(e) => setEditLifecycle(e.target.value as AccountLifecycleStatus)}
                      style={detailFieldStyle}
                    >
                      {LIFECYCLE_OPTIONS_DETAIL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "block" }}>
                    <div style={s.label}>Type</div>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as AccountType)}
                      style={detailFieldStyle}
                    >
                      {ACCOUNT_TYPE_OPTIONS_DETAIL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "block" }}>
                    <div style={s.label}>Source</div>
                    <select
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value as AccountSource)}
                      style={detailFieldStyle}
                    >
                      {ACCOUNT_SOURCE_OPTIONS_DETAIL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <div>
                    <div style={s.label}>Owner</div>
                    <div style={{ ...s.value, fontSize: 12, color: "#6b7280" }}>
                      {owner ? `${owner.firstName} ${owner.lastName}` : "—"}
                      <span style={{ display: "block", fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        (Owner editing requires users.view permission — available in a future slice)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={s.label}>Created</div>
                    <div style={s.value}>{fmtDate(account.createdAt)}</div>
                  </div>
                </div>
                <label style={{ display: "block", marginTop: 8 }}>
                  <div style={s.label}>Notes</div>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    style={{ ...detailFieldStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
                    placeholder="Notes about this account…"
                  />
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontSize: 13 }}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setSaveError(null); }}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read-only view */
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
            )}
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
                  <div style={s.label}>Outcomes recorded</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{client.tenderCount}</div>
                </div>
                <div>
                  <div style={s.label}>Wins</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{client.winCount}</div>
                </div>
                <div>
                  <div style={s.label}>Win rate</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{formatWinRate(client.winRate)}</div>
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
            <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
              {(["activity", "contacts", "tenders", "jobs", "contracts", "opportunities"] as const).map((tab) => {
                let count: number | string;
                if (tab === "activity") {
                  count = rollUps.relationshipNotes.length + rollUps.commThreads.length;
                } else if (tab === "tenders") {
                  count = rollUps.tenderTotal;
                } else if (tab === "contacts") {
                  count = rollUps.contacts.length;
                } else if (tab === "jobs") {
                  count = rollUps.jobs.length;
                } else if (tab === "contracts") {
                  count = rollUps.contracts.length;
                } else {
                  count = rollUps.opportunities.length;
                }
                const label = tab === "activity" ? "Activity" : tab.charAt(0).toUpperCase() + tab.slice(1);
                return (
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
                    {label}
                    {" "}
                    <span style={{ opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Activity tab: notes + threads merged newest-first */}
            {activeTab === "activity" && (
              <ActivityTab
                relationshipNotes={rollUps.relationshipNotes}
                commThreads={rollUps.commThreads}
              />
            )}

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
                  <>
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
                    {rollUps.tenders.length < rollUps.tenderTotal && (
                      <div style={{ ...s.empty, marginTop: 8 }}>
                        Showing {rollUps.tenders.length} of {rollUps.tenderTotal}
                      </div>
                    )}
                  </>
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

            {activeTab === "contracts" && (
              rollUps.contracts.length === 0
                ? <div style={s.empty}>No contracts found for this client.</div>
                : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Number</th>
                        <th style={s.th}>Project</th>
                        <th style={s.th}>Value</th>
                        <th style={s.th}>Status</th>
                        <th style={s.th}>Start</th>
                        <th style={s.th}>End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollUps.contracts.map((c) => (
                        <tr key={c.id}>
                          <td style={s.td}>{c.contractNumber}</td>
                          <td style={s.td}>{c.project.name}</td>
                          <td style={s.td}>{formatDecimal(c.contractValue)}</td>
                          <td style={s.td}>{c.archivedAt ? "Archived" : c.status}</td>
                          <td style={s.td}>{fmtDate(c.startDate)}</td>
                          <td style={s.td}>{fmtDate(c.endDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}

            {activeTab === "opportunities" && (
              rollUps.opportunities.length === 0
                ? <div style={s.empty}>No opportunities linked to this account.</div>
                : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Title</th>
                        <th style={s.th}>Stage</th>
                        <th style={s.th}>Probability</th>
                        <th style={s.th}>Value</th>
                        <th style={s.th}>Close date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollUps.opportunities.map((o) => (
                        <tr key={o.id}>
                          <td style={s.td}>{o.title}</td>
                          <td style={s.td}>{o.stage}</td>
                          <td style={s.td}>{o.probability}%</td>
                          <td style={s.td}>{o.estimatedValue ? formatDecimal(o.estimatedValue) : "—"}</td>
                          <td style={s.td}>{fmtDate(o.expectedCloseDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}
          </div>
        </div>

        {/* ── Right rail — 320px ── */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            // Collapse to full width on narrow viewports (inline media-query
            // not possible; component uses a CSS class for this).
          }}
          className="account360-rail"
        >
          {/* CRM_ACCOUNT360_V2: Next-action card */}
          <NextActionCard nextAction={nextAction} naClass={naClass} />
        </div>
      </div>

      {/* CRM_ACCOUNT360_V2: Log-contact modal */}
      {logContactOpen && id && (
        <LogContactModal
          accountId={id}
          accountName={client?.name ?? "this account"}
          authFetch={authFetch}
          onClose={() => setLogContactOpen(false)}
          onSaved={() => { setLogContactOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

// ── CRM_ACCOUNT360_V2: KPI tile row ──────────────────────────────────────────

/**
 * KPI tiles directly under the account name.
 * Mock-up order: Tenders | Value | Win rate | Jobs | Contracts | Last contact
 *
 * Value: NO-OP — tender select has no money field (accounts.service.ts:356-364).
 *   Needs an API read slice before this tile can be built.
 * Jobs: capped at 20 (accounts.service.ts:384). Tile shows "(≤20)" when at cap
 *   so the user is never shown a silently wrong count.
 * Contracts: capped at 50 (accounts.service.ts:497). Tile shows "(≤50)" when at cap.
 */
function KpiTileRow({
  tenderTotal,
  winRate,
  jobsCount,
  contractsCount,
  lastContactAt
}: {
  tenderTotal: number;
  winRate: string | null;
  jobsCount: number;
  contractsCount: number;
  lastContactAt: string | null;
}) {
  const jobsLabel = jobsCount === JOBS_CAP ? `${jobsCount} (≤${JOBS_CAP})` : String(jobsCount);
  const contractsLabel = contractsCount === CONTRACTS_CAP ? `${contractsCount} (≤${CONTRACTS_CAP})` : String(contractsCount);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 16,
        flexWrap: "wrap"
      }}
      aria-label="KPI tile row"
      data-testid="kpi-tile-row"
    >
      <KpiTile label="Tenders" value={String(tenderTotal)} />
      {/* Value tile: NO-OP — no tender value on the Account 360 payload */}
      <KpiTile label="Win rate" value={formatWinRate(winRate)} />
      <KpiTile label="Jobs" value={jobsLabel} />
      <KpiTile label="Contracts" value={contractsLabel} />
      <KpiTile label="Last contact" value={fmtRelAge(lastContactAt)} />
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--border-default, #e5e7eb)",
        borderRadius: 8,
        padding: "12px 16px",
        background: "var(--surface-card, #fff)",
        minWidth: 100,
        flex: "1 1 auto"
      }}
      data-testid={`kpi-tile-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div style={{ fontSize: 11, color: "var(--text-secondary, #6b7280)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary, #111827)", lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

// ── CRM_ACCOUNT360_V2: Next-action card ──────────────────────────────────────

type NextActionClass = ReturnType<typeof classifyNextAction>;

function NextActionCard({
  nextAction,
  naClass
}: {
  nextAction: NextActionTask | null;
  naClass: NextActionClass;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border-default, #e5e7eb)",
        borderRadius: 8,
        padding: 16,
        background: "var(--surface-card, #fff)",
        marginBottom: 16
      }}
      data-testid="next-action-card"
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary, #374151)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" } as React.CSSProperties}>
        Next action
      </div>
      {nextAction ? (
        <>
          <div style={{ fontSize: 14, color: "var(--text-primary, #111827)", marginBottom: 8, fontWeight: 500 }}>
            {nextAction.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Due chip — same classification as TendersRegisterPage, same colours */}
            {naClass === "overdue" && (
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "rgba(239,68,68,0.12)",
                  color: "var(--status-danger, #991b1b)",
                  fontSize: 11,
                  fontWeight: 600
                }}
                aria-label="overdue"
                data-testid="na-chip-overdue"
              >
                Overdue
              </span>
            )}
            {naClass === "due_soon" && (
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "rgba(245,158,11,0.12)",
                  color: "var(--status-warning, #92400e)",
                  fontSize: 11,
                  fontWeight: 600
                }}
                aria-label="due soon"
                data-testid="na-chip-due-soon"
              >
                Due soon
              </span>
            )}
            {naClass === "on_track" && nextAction.dueAt && (
              <span style={{ fontSize: 12, color: "var(--text-secondary, #6b7280)" }}>
                Due {new Date(nextAction.dueAt).toLocaleDateString("en-AU")}
              </span>
            )}
            {!nextAction.dueAt && (
              <span style={{ fontSize: 12, color: "var(--text-muted, #9ca3af)" }}>No due date</span>
            )}
            {nextAction.assignee && (
              <span style={{ fontSize: 12, color: "var(--text-secondary, #6b7280)" }}>
                · {nextAction.assignee.firstName} {nextAction.assignee.lastName}
              </span>
            )}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-muted, #9ca3af)" }}>
          No open tasks for this account.
        </div>
      )}
    </div>
  );
}

// ── CRM_ACCOUNT360_V2: Log-contact modal ─────────────────────────────────────

/**
 * Posts through buildCreateNoteBody from RelationshipsPage — the same body
 * builder AccountsListPage uses. One implementation, not two.
 */
function LogContactModal({
  accountId,
  accountName,
  authFetch,
  onClose,
  onSaved
}: {
  accountId: string;
  accountName: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!body.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = buildCreateNoteBody({ body: body.trim(), accountId });
      const res = await authFetch("/crm/relationships/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Log contact for ${accountName}`}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: "var(--surface-card, #fff)",
          border: "1px solid var(--border-default, #e5e7eb)",
          borderRadius: 10,
          padding: 24,
          width: 420,
          maxWidth: "90vw"
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px", color: "var(--text-primary, #111827)" }}>
          Log contact — {accountName}
        </h2>
        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary, #6b7280)", marginBottom: 4 }}>Note</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              border: "1px solid var(--border-default, #d1d5db)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 13,
              resize: "vertical",
              boxSizing: "border-box",
              background: "var(--surface-card, #fff)",
              color: "var(--text-primary, #111827)"
            }}
            placeholder="What happened in this contact?"
          />
        </label>
        {saveError && (
          <div role="alert" style={{ color: "var(--status-danger, #dc2626)", fontSize: 13, marginBottom: 10 }}>
            {saveError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-default, #d1d5db)",
              background: "var(--surface-card, #fff)",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text-primary, #111827)"
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={saving || !body.trim()}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--brand-primary, #6366f1)",
              color: "var(--text-inverse, #fff)",
              cursor: saving || !body.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 13
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────────

function ActivityTab({
  relationshipNotes,
  commThreads
}: {
  relationshipNotes: RelationshipNoteRow[];
  commThreads: CommThreadRow[];
}) {
  // Merge notes and threads into a single timeline sorted newest-first.
  const items: ActivityItem[] = [
    ...relationshipNotes.map((n): ActivityItem => ({
      kind: "note",
      id: n.id,
      body: n.body,
      createdAt: n.createdAt,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
      contactName: n.contact ? `${n.contact.firstName} ${n.contact.lastName}` : null
    })),
    ...commThreads.map((t): ActivityItem => ({
      kind: "thread",
      id: t.id,
      subject: t.subject,
      createdAt: t.createdAt,
      authorName: `${t.createdBy.firstName} ${t.createdBy.lastName}`,
      firstMessage: t.messages[0]?.body ?? null
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (items.length === 0) {
    return (
      <div>
        <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 16, padding: "8px 12px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
          Email capture is pending M365 provisioning — email threads will appear here once connected.
        </div>
        <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>No activity recorded for this account yet.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Email empty-state notice — always shown so the label is visible */}
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, padding: "6px 10px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
        Email capture pending M365 provisioning — email threads not yet shown here.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            style={{ borderLeft: `3px solid ${item.kind === "note" ? "#6366f1" : "#16a34a"}`, paddingLeft: 12, paddingTop: 4, paddingBottom: 4 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: item.kind === "note" ? "#6366f1" : "#16a34a", textTransform: "uppercase" }}>
                {item.kind === "note" ? "Note" : "Thread"}
              </span>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                {fmtDate(item.createdAt)} — {item.authorName}
              </span>
              {item.kind === "note" && item.contactName && (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>re: {item.contactName}</span>
              )}
            </div>
            {item.kind === "note" && (
              <div style={{ fontSize: 13, color: "#111827", whiteSpace: "pre-wrap" }}>{item.body}</div>
            )}
            {item.kind === "thread" && (
              <div style={{ fontSize: 13, color: "#111827" }}>
                <strong>{item.subject ?? "(no subject)"}</strong>
                {item.firstMessage && (
                  <div style={{ color: "#6b7280", marginTop: 2 }}>{item.firstMessage.slice(0, 120)}{item.firstMessage.length > 120 ? "…" : ""}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(num);
}

// ── Edit-form option lists (CRM-S5) ───────────────────────────────────────────

const LIFECYCLE_OPTIONS_DETAIL: Array<{ value: AccountLifecycleStatus; label: string }> = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAST", label: "Past" }
];

const ACCOUNT_TYPE_OPTIONS_DETAIL: Array<{ value: AccountType; label: string }> = [
  { value: "CLIENT", label: "Client" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "HEAD_CONTRACTOR", label: "Head contractor" },
  { value: "SUBCONTRACTOR", label: "Subcontractor" },
  { value: "PARTNER", label: "Partner" },
  { value: "OTHER", label: "Other" }
];

const ACCOUNT_SOURCE_OPTIONS_DETAIL: Array<{ value: AccountSource; label: string }> = [
  { value: "REFERRAL", label: "Referral" },
  { value: "DIRECT", label: "Direct" },
  { value: "TENDER_PORTAL", label: "Tender portal" },
  { value: "COLD_OUTREACH", label: "Cold outreach" },
  { value: "REPEAT_BUSINESS", label: "Repeat business" },
  { value: "OTHER", label: "Other" }
];

const detailFieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 5,
  border: "1px solid #d1d5db",
  fontSize: 13,
  background: "#fff",
  marginTop: 2
};
