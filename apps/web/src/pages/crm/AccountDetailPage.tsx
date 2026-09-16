import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { formatWinRate } from "./formatWinRate";
import { buildCreateNoteBody } from "./RelationshipsPage";
import { classifyNextAction, type NextActionClass } from "./tendersRegisterPage.helpers";
import {
  archiveAccount,
  buildPatchAccountBody,
  patchAccount,
  unarchiveAccount,
  type AccountLifecycleStatus,
  type AccountSource,
  type AccountType
} from "./crm-api";
import "./crm.css";

// CRM_PARITY_ACCOUNT360_V1 — crmvis-S3: Account 360 migrated to s7 kit.
// design_ref: artboard `Account360.dc.html`, titled "Account 360".
export const CRM_PARITY_ACCOUNT360_V1 = "crmvis-s3";

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

// ── CRM_ACCOUNT360_V2 — pure helpers (exported for the unit suite) ────────────
//
// The 360 payload caps three of its roll-up arrays server-side
// (accounts.service.ts: tenders take 20, jobs take 20, contracts take 50).
// `tenderTotal` is an uncapped count, so the Tenders tile is exact. Jobs and
// Contracts have no uncapped count on the payload, so rather than print a
// number that is silently wrong for a large client, the tile discloses the cap
// ("20+") the moment the array is full. That is the "label it as capped"
// option the prompt offers, taken for both tiles.

export const ACCOUNT360_ROLLUP_CAPS = {
  JOBS: 20,
  CONTRACTS: 50
} as const;

/**
 * Renders a capped array's length. At the cap the true figure is unknown, so
 * the tile says "20+" rather than "20". Below the cap the length is exact.
 */
export function formatCappedCount(length: number, cap: number): string {
  return length >= cap ? `${cap}+` : String(length);
}

/**
 * Last contact = the newest of the account's newest relationship note and its
 * newest comms thread. Both lists arrive ordered createdAt desc from the
 * server, so element 0 of each is the true newest even though both lists are
 * capped — this figure is exact, not an approximation of a capped window.
 */
export function deriveLastContactAt(
  relationshipNotes: Array<{ createdAt: string }>,
  commThreads: Array<{ createdAt: string }>
): string | null {
  const candidates = [relationshipNotes[0]?.createdAt, commThreads[0]?.createdAt]
    .filter((iso): iso is string => typeof iso === "string" && iso.length > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((newest, iso) =>
    new Date(iso).getTime() > new Date(newest).getTime() ? iso : newest
  );
}

/**
 * Short relative age, the way the mock-up writes it: "4d", not a date.
 * Sub-hour reads "now"; a year or more reads in years so the tile never grows
 * a four-digit number.
 */
export function formatRelativeAge(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const ms = now.getTime() - then;
  if (ms < 0) return "now";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "now";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days}d`;
  return `${Math.floor(days / 365)}y`;
}

export type Account360Task = {
  id: string;
  entityId: string;
  title: string;
  status: string;
  dueAt: string | null;
  assignee: OwnerLite | null;
};

/**
 * The next action for an account is its earliest-due open CommTask — the same
 * rule the tenders register applies per tender (TendersRegisterPage.tsx:426-460).
 * Tasks with no due date sort last, so a dated commitment always wins.
 */
export function pickNextAction(
  tasks: Account360Task[],
  accountId: string
): Account360Task | null {
  const mine = tasks
    .filter((t) => t.entityId === accountId && t.status === "OPEN")
    .sort((a, b) => {
      const aMs = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bMs = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return aMs - bMs;
    });
  return mine[0] ?? null;
}

/** Initials for the header avatar. No image, no upload, no dependency. */
export function initialsFor(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const LIFECYCLE_LABEL: Record<string, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  PAST: "Past"
};

// crmvis-S3: lifecycle badge class mapping — s7-badge variants per status.
// ACTIVE maps to --active (teal), PROSPECT to --warning (amber),
// PAST to --neutral (grey).
const LIFECYCLE_BADGE_CLASS: Record<string, string> = {
  PROSPECT: "s7-badge s7-badge--warning",
  ACTIVE: "s7-badge s7-badge--active",
  PAST: "s7-badge s7-badge--neutral"
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

// crmvis-S3: the next-action chip maps to s7-badge variants.
// overdue → --danger, due_soon → --warning, on_track / none → --neutral.
const NEXT_ACTION_BADGE_CLASS: Record<NextActionClass, string> = {
  overdue: "s7-badge s7-badge--danger",
  due_soon: "s7-badge s7-badge--warning",
  on_track: "s7-badge s7-badge--neutral",
  none: "s7-badge s7-badge--neutral"
};

const NEXT_ACTION_CHIP_LABEL: Record<NextActionClass, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  on_track: "On track",
  none: "No due date"
};

// crmvis-S3: KPI tile using crm-kpi classes + s7-card surface.
// `note` carries a cap disclosure when the figure is capped.
function KpiTile({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="s7-card crm-kpi">
      <div className="s7-type-label crm-kpi__label">{label}</div>
      <div className="crm-kpi__value">{value}</div>
      {note && <div className="crm-kpi__sub">{note}</div>}
    </div>
  );
}

/**
 * The Next-action card. The due classification is IMPORTED from
 * tendersRegisterPage.helpers — a second copy of the overdue / due-soon
 * thresholds is how this card and the register start disagreeing.
 */
function NextActionCard({
  task,
  loading
}: {
  task: Account360Task | null;
  loading: boolean;
}) {
  const klass: NextActionClass = classifyNextAction(task?.dueAt ?? null, new Date());
  return (
    <div className="s7-card" style={{ marginBottom: 16 }}>
      <div className="s7-type-label" style={{ marginBottom: 12 }}>Next action</div>
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      ) : !task ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No open task for this account.</div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            {task.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className={NEXT_ACTION_BADGE_CLASS[klass]}>
              {NEXT_ACTION_CHIP_LABEL[klass]}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {task.dueAt ? fmtDate(task.dueAt) : "no due date"}
            </span>
          </div>
          <div className="s7-type-label" style={{ marginTop: 12, marginBottom: 4 }}>Owner</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
            {task.assignee
              ? `${task.assignee.firstName} ${task.assignee.lastName}`
              : "Unassigned"}
          </div>
        </>
      )}
    </div>
  );
}

export function AccountDetailPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [account, setAccount] = useState<Account360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"activity" | "contacts" | "tenders" | "jobs" | "contracts" | "opportunities">("activity");

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

  // CRM_ACCOUNT360_V2: the account's open CommTasks, for the Next-action card.
  const [tasks, setTasks] = useState<Account360Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);

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

  // CRM_ACCOUNT360_V2: open tasks anchored to this account. Same read the
  // tenders register uses per tender (TendersRegisterPage.tsx:426-460), with
  // entityType=ACCOUNT. Enhancement-only: a failure never becomes a page error.
  const loadTasks = useCallback(async () => {
    if (!id) return;
    setTasksLoading(true);
    try {
      const res = await authFetch(
        `/crm/comms/tasks?entityType=ACCOUNT&entityId=${encodeURIComponent(id)}&status=OPEN&limit=100`
      );
      if (res.ok) {
        const body = await res.json() as { items: Account360Task[] };
        setTasks(body.items ?? []);
      }
    } catch {
      // Next-action data is enhancement-only.
    } finally {
      setTasksLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

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

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) return <div style={{ padding: 24, color: "var(--status-danger)" }}>{error}</div>;
  if (!account) return null;

  const { client, owner, rollUps } = account;

  // CRM_ACCOUNT360_V2 — tile figures.
  const nextAction = pickNextAction(tasks, account.id);
  const lastContactAt = deriveLastContactAt(rollUps.relationshipNotes, rollUps.commThreads);
  const jobsCapped = rollUps.jobs.length >= ACCOUNT360_ROLLUP_CAPS.JOBS;
  const contractsCapped = rollUps.contracts.length >= ACCOUNT360_ROLLUP_CAPS.CONTRACTS;

  // crmvis-S3: tab counts for the feed strip.
  function tabCount(tab: "activity" | "contacts" | "tenders" | "jobs" | "contracts" | "opportunities"): number | string {
    if (tab === "activity") return rollUps.relationshipNotes.length + rollUps.commThreads.length;
    if (tab === "tenders") return rollUps.tenderTotal;
    if (tab === "contacts") return rollUps.contacts.length;
    if (tab === "jobs") return formatCappedCount(rollUps.jobs.length, ACCOUNT360_ROLLUP_CAPS.JOBS);
    if (tab === "contracts") return formatCappedCount(rollUps.contracts.length, ACCOUNT360_ROLLUP_CAPS.CONTRACTS);
    return rollUps.opportunities.length;
  }

  const TABS: Array<{ id: "activity" | "contacts" | "tenders" | "jobs" | "contracts" | "opportunities"; label: string }> = [
    { id: "activity", label: "Activity" },
    { id: "contacts", label: "Contacts" },
    { id: "tenders", label: "Tenders" },
    { id: "jobs", label: "Jobs" },
    { id: "contracts", label: "Contracts" },
    { id: "opportunities", label: "Opportunities" }
  ];

  return (
    <div style={{ padding: "24px", maxWidth: 1240, margin: "0 auto" }}>

      {/* ── Header — crmvis-S3: crm-page-head, crm-avatar--lg, s7-badge lifecycle ── */}
      {/* Relocated from: inline flex div (~L615), backBtn (~L291/L616), avatar
          inline style (~L337/L617), badge inline style (~L299/L629) */}
      <div className="crm-page-head" style={{ alignItems: "center", flexWrap: "wrap" }}>
        {/* Left: avatar + name + lifecycle badge + type·ABN muted line */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 0" }}>
          <div className="crm-avatar crm-avatar--lg" aria-hidden="true">
            {initialsFor(client?.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 className="s7-type-page-title" style={{ margin: 0 }}>
              {client?.name ?? "Unnamed Account"}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
              {client?.abn ? ` · ABN ${client.abn}` : ""}
            </div>
          </div>
          <span className={LIFECYCLE_BADGE_CLASS[account.lifecycleStatus] ?? "s7-badge s7-badge--neutral"}>
            {LIFECYCLE_LABEL[account.lifecycleStatus] ?? account.lifecycleStatus}
          </span>
          {account.archivedAt && (
            <span className="s7-badge s7-badge--neutral">Archived</span>
          )}
        </div>

        {/* Right: header actions — Log contact, New thread, Edit account */}
        <div className="crm-page-head__actions">
          {!account.archivedAt && (
            <button
              className="s7-btn s7-btn--secondary"
              onClick={() => setLogOpen(true)}
            >
              Log contact
            </button>
          )}
          {/* CRM-S9: the anchored Comms-hub deep link. The mock-up calls this
              control "New thread"; the entityType=ACCOUNT anchor contract behind
              it is unchanged — only the label moves. */}
          <Link
            to={`/crm/comms?entityType=ACCOUNT&entityId=${encodeURIComponent(account.id)}`}
            className="s7-btn s7-btn--secondary"
            style={{ textDecoration: "none" }}
          >
            New thread
          </Link>
          {!editing && !account.archivedAt && (
            <button
              className="s7-btn s7-btn--primary crm-btn--primary"
              onClick={openEdit}
            >
              Edit account
            </button>
          )}
        </div>
      </div>

      {/* ── KPI tile row — crmvis-S3: s7-card-grid--kpi, five tiles (no Value) ──
          Residual content gap: no "Value" figure exists on the 360 payload today.
          Five tiles are rendered; a crm-kpi-grid--6 class would apply when Value
          is added in a future slice. */}
      <div className="s7-card-grid s7-card-grid--kpi" style={{ marginBottom: 20 }}>
        <KpiTile label="Tenders" value={String(rollUps.tenderTotal)} />
        <KpiTile label="Win rate" value={formatWinRate(client?.winRate ?? null)} />
        <KpiTile
          label="Jobs"
          value={formatCappedCount(rollUps.jobs.length, ACCOUNT360_ROLLUP_CAPS.JOBS)}
          note={jobsCapped ? `capped at ${ACCOUNT360_ROLLUP_CAPS.JOBS} by the 360 payload` : undefined}
        />
        <KpiTile
          label="Contracts"
          value={formatCappedCount(rollUps.contracts.length, ACCOUNT360_ROLLUP_CAPS.CONTRACTS)}
          note={contractsCapped ? `capped at ${ACCOUNT360_ROLLUP_CAPS.CONTRACTS} by the 360 payload` : undefined}
        />
        <KpiTile label="Last contact" value={formatRelativeAge(lastContactAt)} />
      </div>

      {/* ── Archived banner — crmvis-S3: var(--status-warning) token ── */}
      {/* Relocated from: archivedBanner inline style (~L349) which used hex literals */}
      {account.archivedAt && (
        <div className="crm-archived-banner" style={{ marginBottom: 16 }}>
          This account was archived on {fmtDate(account.archivedAt)}
          {account.archivedBy
            ? ` by ${account.archivedBy.firstName} ${account.archivedBy.lastName}`
            : ""}.
        </div>
      )}

      {/* ── Body: main column + 320px rail ──────────────────────────────────── */}
      {/* Relocated from: s.body, s.mainCol, s.rail inline styles (~L322-L327) */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>

        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>

          {/* ── Feed card: tab strip + activity feed ────────────────────────
              crmvis-S3: relocated Account + Client identity cards to the rail.
              The main column is now the feed card with the crm-tab strip. */}
          <div className="s7-card" style={{ marginBottom: 16 }}>

            {/* Tab strip — crm-tab buttons (inline state, not CrmTabs router component
                because these are local state tabs not route-level tabs) */}
            <div className="crm-tabs" style={{ margin: "-16px -20px 16px", padding: "0 20px" }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`crm-tab${activeTab === tab.id ? " crm-tab--on" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  <span className="crm-tab__count">({tabCount(tab.id)})</span>
                </button>
              ))}
            </div>

            {/* Activity heading + feed */}
            {activeTab === "activity" && (
              <>
                <div className="s7-type-label" style={{ marginBottom: 12 }}>
                  Notes, threads and emails, merged
                </div>
                <ActivityTab
                  relationshipNotes={rollUps.relationshipNotes}
                  commThreads={rollUps.commThreads}
                />
              </>
            )}

            {activeTab === "contacts" && (
              rollUps.contacts.length === 0
                ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No contacts linked to this client.</div>
                : (
                  <table className="s7-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Primary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollUps.contacts.map((c) => (
                        <tr key={c.id}>
                          <td>{c.firstName} {c.lastName}</td>
                          <td>{c.role ?? "—"}</td>
                          <td>{c.email ?? "—"}</td>
                          <td>{c.phone ?? c.mobile ?? "—"}</td>
                          <td>{c.isPrimary ? "Yes" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}

            {activeTab === "tenders" && (
              rollUps.tenders.length === 0
                ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No tenders found for this client.</div>
                : (
                  <>
                    <table className="s7-table" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th>Number</th>
                          <th>Title</th>
                          <th>Status</th>
                          <th>Due</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rollUps.tenders.map((t) => (
                          <tr key={t.id}>
                            <td>{t.tenderNumber}</td>
                            <td>{t.title}</td>
                            <td>{t.status}</td>
                            <td>{fmtDate(t.dueDate)}</td>
                            <td>{fmtDate(t.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rollUps.tenders.length < rollUps.tenderTotal && (
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
                        Showing {rollUps.tenders.length} of {rollUps.tenderTotal}
                      </div>
                    )}
                  </>
                )
            )}

            {activeTab === "jobs" && (
              rollUps.jobs.length === 0
                ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No jobs found for this client.</div>
                : (
                  <table className="s7-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollUps.jobs.map((j) => (
                        <tr key={j.id}>
                          <td>{j.jobNumber}</td>
                          <td>{j.name}</td>
                          <td>{j.status}</td>
                          <td>{fmtDate(j.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}

            {activeTab === "contracts" && (
              rollUps.contracts.length === 0
                ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No contracts found for this client.</div>
                : (
                  <table className="s7-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Number</th>
                        <th>Project</th>
                        <th>Value</th>
                        <th>Status</th>
                        <th>Start</th>
                        <th>End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollUps.contracts.map((c) => (
                        <tr key={c.id}>
                          <td>{c.contractNumber}</td>
                          <td>{c.project.name}</td>
                          <td>{formatDecimal(c.contractValue)}</td>
                          <td>{c.archivedAt ? "Archived" : c.status}</td>
                          <td>{fmtDate(c.startDate)}</td>
                          <td>{fmtDate(c.endDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}

            {activeTab === "opportunities" && (
              rollUps.opportunities.length === 0
                ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No opportunities linked to this account.</div>
                : (
                  <table className="s7-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Stage</th>
                        <th>Probability</th>
                        <th>Value</th>
                        <th>Close date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rollUps.opportunities.map((o) => (
                        <tr key={o.id}>
                          <td>{o.title}</td>
                          <td>{o.stage}</td>
                          <td>{o.probability}%</td>
                          <td>{o.estimatedValue ? formatDecimal(o.estimatedValue) : "—"}</td>
                          <td>{fmtDate(o.expectedCloseDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}
          </div>
        </div>

        {/* ── Rail (320px): ACCOUNT card + NEXT ACTION card ─────────────── */}
        {/* Relocated from: aside with s.rail inline style (~L1170) */}
        <aside style={{ flex: "0 1 320px", minWidth: 280, maxWidth: 320 }}>

          {/* ACCOUNT card — Lifecycle / Type / Owner read-only + edit form.
              crmvis-S3 note: Lifecycle / Type / Owner rendered as read-only
              labels here because the inline PATCH handler (CRM-S5) opens a
              full edit form — the s7-select inline swap is not this slice's
              scope (noted in PR body). */}
          <div className="s7-card" style={{ marginBottom: 16 }}>
            <div className="s7-type-label" style={{ marginBottom: 12 }}>Account</div>

            {saveError && (
              <div role="alert" style={{ color: "var(--status-danger)", fontSize: 13, marginBottom: 12, padding: "8px 10px", background: "color-mix(in srgb, var(--status-danger) 8%, transparent)", borderRadius: "var(--radius-md)" }}>
                {saveError}
              </div>
            )}

            {editing ? (
              /* Edit form — CRM-S5 */
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px 0" }}>
                  <label style={{ display: "block" }}>
                    <div className="s7-type-label" style={{ marginBottom: 4 }}>Lifecycle</div>
                    <select
                      className="s7-select"
                      value={editLifecycle}
                      onChange={(e) => setEditLifecycle(e.target.value as AccountLifecycleStatus)}
                    >
                      {LIFECYCLE_OPTIONS_DETAIL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "block", marginTop: 8 }}>
                    <div className="s7-type-label" style={{ marginBottom: 4 }}>Type</div>
                    <select
                      className="s7-select"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as AccountType)}
                    >
                      {ACCOUNT_TYPE_OPTIONS_DETAIL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "block", marginTop: 8 }}>
                    <div className="s7-type-label" style={{ marginBottom: 4 }}>Source</div>
                    <select
                      className="s7-select"
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value as AccountSource)}
                    >
                      {ACCOUNT_SOURCE_OPTIONS_DETAIL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <div style={{ marginTop: 8 }}>
                    <div className="s7-type-label" style={{ marginBottom: 4 }}>Owner</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {owner ? `${owner.firstName} ${owner.lastName}` : "—"}
                      <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        (Owner editing requires users.view permission — available in a future slice)
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div className="s7-type-label" style={{ marginBottom: 4 }}>Created</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{fmtDate(account.createdAt)}</div>
                  </div>
                </div>
                <label style={{ display: "block", marginTop: 8 }}>
                  <div className="s7-type-label" style={{ marginBottom: 4 }}>Notes</div>
                  <textarea
                    className="s7-textarea"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    placeholder="Notes about this account…"
                  />
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    className="s7-btn s7-btn--primary crm-btn--primary"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="s7-btn s7-btn--secondary"
                    onClick={() => { setEditing(false); setSaveError(null); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read-only view */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div className="s7-type-label" style={{ marginBottom: 2 }}>Lifecycle</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {LIFECYCLE_LABEL[account.lifecycleStatus] ?? account.lifecycleStatus}
                  </div>
                </div>
                <div>
                  <div className="s7-type-label" style={{ marginBottom: 2 }}>Type</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
                  </div>
                </div>
                <div>
                  <div className="s7-type-label" style={{ marginBottom: 2 }}>Owner</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {owner ? `${owner.firstName} ${owner.lastName}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="s7-type-label" style={{ marginBottom: 2 }}>Source</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {SOURCE_LABEL[account.source] ?? account.source}
                  </div>
                </div>
                {client && (
                  <div>
                    <div className="s7-type-label" style={{ marginBottom: 2 }}>Linked client</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      <Link
                        to={`/crm/clients/${client.id}`}
                        style={{ color: "var(--brand-primary)", textDecoration: "none" }}
                      >
                        {client.name} ›
                      </Link>
                    </div>
                  </div>
                )}
                <div>
                  <div className="s7-type-label" style={{ marginBottom: 2 }}>Created</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{fmtDate(account.createdAt)}</div>
                </div>
                {account.notes && (
                  <div>
                    <div className="s7-type-label" style={{ marginBottom: 2 }}>Notes</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{account.notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* Archive confirm prompt */}
            {archiveConfirm && (
              <div role="alert" style={{ marginTop: 12, padding: "12px 14px", background: "color-mix(in srgb, var(--status-warning) 10%, transparent)", border: "1px solid var(--status-warning)", borderRadius: "var(--radius-md)" }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-primary)" }}>
                  Archive this account? It will be hidden from the list but not deleted.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="s7-btn s7-btn--primary crm-btn--primary"
                    onClick={() => void handleArchive()}
                    disabled={archiving}
                  >
                    {archiving ? "Archiving…" : "Yes, archive"}
                  </button>
                  <button
                    className="s7-btn s7-btn--secondary"
                    onClick={() => setArchiveConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Client identity facts — second labelled group in the same card */}
            {client && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <div className="s7-type-label" style={{ marginBottom: 10 }}>Client identity</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div className="s7-type-label" style={{ marginBottom: 2 }}>Legal name</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{client.name}</div>
                  </div>
                  {client.tradingName && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Trading name</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{client.tradingName}</div>
                    </div>
                  )}
                  {client.abn && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>ABN</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{client.abn}</div>
                    </div>
                  )}
                  {client.acn && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>ACN</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{client.acn}</div>
                    </div>
                  )}
                  {client.industry && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Industry</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{client.industry}</div>
                    </div>
                  )}
                  {client.email && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Email</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{client.email}</div>
                    </div>
                  )}
                  {client.phone && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Phone</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{client.phone}</div>
                    </div>
                  )}
                  {client.website && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Website</div>
                      <div style={{ fontSize: 13 }}>
                        <a href={client.website} target="_blank" rel="noreferrer" style={{ color: "var(--brand-primary)" }}>{client.website}</a>
                      </div>
                    </div>
                  )}
                  {(client.physicalAddress || client.physicalSuburb) && (
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Address</div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        {[client.physicalAddress, client.physicalSuburb, client.physicalState, client.physicalPostcode]
                          .filter(Boolean).join(", ")}
                      </div>
                    </div>
                  )}
                  {client.onHold && (
                    <div>
                      <div style={{ color: "var(--status-danger)", fontWeight: 600, fontSize: 13 }}>
                        On hold{client.onHoldReason ? `: ${client.onHoldReason}` : ""}
                      </div>
                    </div>
                  )}
                  {/* Win/loss roll-up — outcomes, wins, last tender */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Outcomes</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{client.tenderCount}</div>
                    </div>
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Wins</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{client.winCount}</div>
                    </div>
                    <div>
                      <div className="s7-type-label" style={{ marginBottom: 2 }}>Win rate</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{formatWinRate(client.winRate)}</div>
                    </div>
                    {client.lastTenderAt && (
                      <div>
                        <div className="s7-type-label" style={{ marginBottom: 2 }}>Last tender</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmtDate(client.lastTenderAt)}</div>
                      </div>
                    )}
                    {client.lastWonAt && (
                      <div>
                        <div className="s7-type-label" style={{ marginBottom: 2 }}>Last won</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{fmtDate(client.lastWonAt)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Archive / Unarchive verb — s7-btn--ghost at card foot */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              {!account.archivedAt ? (
                <button
                  className="s7-btn s7-btn--ghost"
                  onClick={() => setArchiveConfirm(true)}
                  disabled={archiving}
                  style={{ color: "var(--status-warning)" }}
                >
                  Archive
                </button>
              ) : (
                <button
                  className="s7-btn s7-btn--ghost"
                  onClick={() => void handleUnarchive()}
                  disabled={archiving}
                  style={{ color: "var(--brand-primary)" }}
                >
                  {archiving ? "Restoring…" : "Unarchive"}
                </button>
              )}
            </div>
          </div>

          {/* NEXT ACTION card */}
          <NextActionCard task={nextAction} loading={tasksLoading} />

        </aside>
      </div>

      {logOpen && client && (
        <LogContactModal
          accountId={account.id}
          accountName={client.name}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); void load(); void loadTasks(); }}
        />
      )}
    </div>
  );
}

// ── Log-contact modal (CRM_ACCOUNT360_V2) ────────────────────────────────────
//
// The Accounts list has had this control on every row since CRM-S6; the 360
// page for the same account did not. The note BODY BUILDER is imported from
// RelationshipsPage — `buildCreateNoteBody` — so there is exactly one place
// that decides what a relationship note looks like on the wire. Only the form
// shell is local, because the list's shell is not exported and this slice may
// not touch that file.

function LogContactModal({
  accountId,
  accountName,
  onClose,
  onSaved
}: {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="s7-card" style={{ width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Log contact — {accountName}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="s7-btn s7-btn--ghost"
            style={{ fontSize: 20, padding: "0 4px", color: "var(--text-muted)" }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13, color: "var(--text-secondary)" }}>Note</span>
            <textarea
              ref={textareaRef}
              className="s7-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              placeholder="Call summary, meeting notes, email follow-up…"
            />
          </label>

          {saveError && (
            <div role="alert" className="crm-archived-banner" style={{ marginBottom: 12 }}>{saveError}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="s7-btn s7-btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="s7-btn s7-btn--primary crm-btn--primary"
              disabled={saving || !body.trim()}
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
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
        {/* M365 notice — shipped wording preserved verbatim */}
        <div className="crm-note" style={{ marginBottom: 12 }}>
          Email capture is pending M365 provisioning — email threads will appear here once connected.
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No activity recorded for this account yet.</div>
      </div>
    );
  }

  return (
    <div>
      {/* M365 notice — always shown so the label is visible. Shipped wording preserved. */}
      <div className="crm-note" style={{ marginBottom: 12 }}>
        Email capture pending M365 provisioning — email threads not yet shown here.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={`${item.kind}-${item.id}`}
            style={{
              borderLeft: `3px solid ${item.kind === "note" ? "var(--brand-primary)" : "var(--status-active)"}`,
              paddingLeft: 12,
              paddingTop: 4,
              paddingBottom: 4
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: item.kind === "note" ? "var(--brand-primary)" : "var(--status-active)", textTransform: "uppercase" }}>
                {item.kind === "note" ? "Note" : "Thread"}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {fmtDate(item.createdAt)} — {item.authorName}
              </span>
              {item.kind === "note" && item.contactName && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>re: {item.contactName}</span>
              )}
            </div>
            {item.kind === "note" && (
              <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{item.body}</div>
            )}
            {item.kind === "thread" && (
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                <strong>{item.subject ?? "(no subject)"}</strong>
                {item.firstMessage && (
                  <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{item.firstMessage.slice(0, 120)}{item.firstMessage.length > 120 ? "…" : ""}</div>
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
