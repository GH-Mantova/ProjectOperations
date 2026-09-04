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

const s: Record<string, React.CSSProperties> = {
  page: { padding: "24px", maxWidth: 1240, margin: "0 auto" },
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
  // CRM_ACCOUNT360_V2 — main column + 320px rail, per the mock-up. Wrapping
  // (not a media query) does the collapse: below roughly 900px the rail no
  // longer fits beside a 560px main column and drops under it.
  body: { display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  mainCol: { flex: "1 1 560px", minWidth: 0 },
  rail: { flex: "0 1 320px", minWidth: 280, maxWidth: 320 },
  tileRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  tile: {
    flex: "1 1 140px",
    minWidth: 130,
    padding: "12px 16px",
    borderRadius: 8
  },
  tileValue: { fontSize: 22, fontWeight: 700, lineHeight: 1.15 },
  tileNote: { fontSize: 11, marginTop: 2 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flex: "0 0 auto"
  },
  headerMeta: { fontSize: 12 },
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

// ── CRM_ACCOUNT360_V2 — tones ────────────────────────────────────────────────
//
// Every value here is READ from a style object already defined above. This
// slice introduces no colour of its own: the "overdue" chip is the archived
// banner's own amber used as a fill, "due soon" is that same amber outlined,
// and "on track" is the card's neutral border over the card surface. If the
// app's palette moves, these move with it.
const A360_SURFACE = s.card.background;
const A360_BORDER = s.card.border;
const A360_MUTED = s.label.color;
const A360_INK = s.value.color;
const A360_ACCENT = s.backBtn.color;
const A360_ON_ACCENT = s.badge.color;
const A360_WARN_FILL = s.archivedBanner.background;
const A360_WARN_EDGE = s.archivedBanner.border;
const A360_WARN_INK = s.archivedBanner.color;

const NEXT_ACTION_CHIP: Record<NextActionClass, React.CSSProperties> = {
  overdue: { background: A360_WARN_INK, color: A360_ON_ACCENT, border: A360_WARN_EDGE },
  due_soon: { background: A360_WARN_FILL, color: A360_WARN_INK, border: A360_WARN_EDGE },
  on_track: { background: A360_SURFACE, color: A360_MUTED, border: A360_BORDER },
  none: { background: A360_SURFACE, color: A360_MUTED, border: A360_BORDER }
};

const NEXT_ACTION_CHIP_LABEL: Record<NextActionClass, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  on_track: "On track",
  none: "No due date"
};

/** One KPI tile. `note` carries a cap disclosure when the figure is capped. */
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
    <div style={{ ...s.tile, background: A360_SURFACE, border: A360_BORDER }}>
      <div style={{ ...s.label, marginBottom: 4 }}>{label}</div>
      <div style={{ ...s.tileValue, color: A360_INK }}>{value}</div>
      {note && <div style={{ ...s.tileNote, color: A360_MUTED }}>{note}</div>}
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
    <div style={s.card}>
      <div style={s.cardTitle}>Next action</div>
      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : !task ? (
        <div style={s.empty}>No open task for this account.</div>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: A360_INK, marginBottom: 8 }}>
            {task.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                ...s.badge,
                ...NEXT_ACTION_CHIP[klass],
                borderStyle: "solid"
              }}
            >
              {NEXT_ACTION_CHIP_LABEL[klass]}
            </span>
            <span style={{ fontSize: 12, color: A360_MUTED }}>
              {task.dueAt ? fmtDate(task.dueAt) : "no due date"}
            </span>
          </div>
          <div style={{ ...s.label, marginTop: 12 }}>Owner</div>
          <div style={{ fontSize: 13, color: A360_INK }}>
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

  if (loading) return <div style={s.page}>Loading…</div>;
  if (error) return <div style={s.page}><div style={{ color: "#dc2626" }}>{error}</div></div>;
  if (!account) return null;

  const { client, owner, rollUps } = account;

  // CRM_ACCOUNT360_V2 — tile figures.
  const nextAction = pickNextAction(tasks, account.id);
  const lastContactAt = deriveLastContactAt(rollUps.relationshipNotes, rollUps.commThreads);
  const jobsCapped = rollUps.jobs.length >= ACCOUNT360_ROLLUP_CAPS.JOBS;
  const contractsCapped = rollUps.contracts.length >= ACCOUNT360_ROLLUP_CAPS.CONTRACTS;

  return (
    <div style={s.page}>
      {/* Header — CRM_ACCOUNT360_V2: identity on the left, the mock-up's three
          actions on the right. */}
      <div style={{ ...s.header, flexWrap: "wrap" }}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <div style={{ ...s.avatar, background: A360_ACCENT, color: A360_ON_ACCENT }} aria-hidden="true">
          {initialsFor(client?.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {client?.name ?? "Unnamed Account"}
          </h1>
          <div style={{ ...s.headerMeta, color: A360_MUTED }}>
            {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
            {client?.abn ? ` · ABN ${client.abn}` : ""}
          </div>
        </div>
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

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!account.archivedAt && (
            <button
              onClick={() => setLogOpen(true)}
              style={{ padding: "4px 12px", borderRadius: 6, border: A360_BORDER, background: A360_SURFACE, cursor: "pointer", fontSize: 12 }}
            >
              Log contact
            </button>
          )}
          {/* CRM-S9: the anchored Comms-hub deep link. The mock-up calls this
              control "New thread"; the entityType=ACCOUNT anchor contract behind
              it is unchanged — only the label moves. */}
          <Link
            to={`/crm/comms?entityType=ACCOUNT&entityId=${encodeURIComponent(account.id)}`}
            style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${A360_ACCENT}`, background: A360_SURFACE, color: A360_ACCENT, cursor: "pointer", fontSize: 12, textDecoration: "none" }}
          >
            New thread
          </Link>
          {!editing && !account.archivedAt && (
            <button
              onClick={openEdit}
              style={{ padding: "4px 12px", borderRadius: 6, border: A360_BORDER, background: A360_SURFACE, cursor: "pointer", fontSize: 12 }}
            >
              Edit account
            </button>
          )}
        </div>
      </div>

      {/* KPI tile row — CRM_ACCOUNT360_V2, the mock-up's row under the name.
          "Value" is absent by design: see the NO-OP note in the PR body. */}
      <div style={s.tileRow}>
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

      {account.archivedAt && (
        <div style={s.archivedBanner}>
          This account was archived on {fmtDate(account.archivedAt)}
          {account.archivedBy
            ? ` by ${account.archivedBy.firstName} ${account.archivedBy.lastName}`
            : ""}.
        </div>
      )}

      {/* CRM_ACCOUNT360_V2 — main column + 320px rail. The rail wraps under
          the main column on a narrow viewport. */}
      <div style={s.body}>
        <div style={s.mainCol}>
      {/* Account details — inline-editable (CRM-S5) */}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={s.cardTitle as React.CSSProperties & { marginBottom: 0 }}>Account</div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* CRM_ACCOUNT360_V2: "Open comms" and "Edit" moved to the page
                header, where the mock-up puts them. Archive stays here — it is
                not one of the mock-up's three header actions. */}
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

        <aside style={s.rail}>
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
      <div
        style={{
          background: A360_SURFACE,
          borderRadius: 10,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Log contact — {accountName}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: A360_MUTED, padding: "0 4px" }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ ...s.label, fontWeight: 600, display: "block", marginBottom: 4 }}>Note</span>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              style={{ ...detailFieldStyle, resize: "vertical", boxSizing: "border-box" }}
              placeholder="Call summary, meeting notes, email follow-up…"
            />
          </label>

          {saveError && (
            <div role="alert" style={{ ...s.archivedBanner, marginBottom: 12 }}>{saveError}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "6px 16px", borderRadius: 6, border: A360_BORDER, background: A360_SURFACE, cursor: "pointer", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !body.trim()}
              style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: A360_ACCENT, color: A360_ON_ACCENT, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontSize: 13 }}
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
