// CRM_ACCOUNTS_LIST_V2
// CRM_PARITY_ACCOUNTS_V1 — crmvis-S1: migrated to s7 kit and design tokens.
// design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { formatWinRate } from "./formatWinRate";
import { AccountLinkPreview } from "./AccountLinkPreview";
import { buildCreateNoteBody } from "./RelationshipsPage";
import { CRM_COLD_V3, type ContactState } from "./crm-cold";
import { CrmTabs, type CrmTabDef } from "./CrmTabs";
import "./crm.css";

// Visual parity marker — asserted by done_when (crmvis-S1).
export const CRM_PARITY_ACCOUNTS_V1 = "crmvis-s1";

// Re-exported so the existing computeContactState callers (and its dedicated
// vitest suites) can keep importing CRM_COLD_V3 from this module. The constant
// itself lives at ./crm-cold to keep it off the circular-import path with
// RelationshipsPage.
export { CRM_COLD_V3 };
export type { ContactState };
import {
  createAccount,
  validateCreateAccountForm,
  type AccountLifecycleStatus,
  type AccountSource,
  type AccountType
} from "./crm-api";

// NAV-2: Accounts index — Client-360 landing page.
// Lists all non-archived accounts with summary stats.
// Links each row to AccountDetailPage at /crm/accounts/:id.

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountSummaryRow = {
  id: string;
  name: string;
  abn: string | null;
  type: string;
  lifecycle: "PROSPECT" | "ACTIVE" | "PAST";
  owner: { id: string; firstName: string; lastName: string } | null;
  winRate: number | null;
  openOpportunitiesCount: number;
  lastContactedAt: string | null;
  goingCold: boolean;
  contactState: ContactState;
};

// ── Helper: contact-state logic (pure, exported for unit tests) ───────────────

/**
 * Derives the contact state from a summary row.
 * Mirrors the server-side deriveContactState — exported so the vitest suites
 * can assert the four rules without a DOM or fetch mock.
 *
 * CRM_COLD_V3 rules (2026-09-04), in order:
 *
 *   lifecycle === "PAST"                        -> "PAST"
 *   lastContactedAt === null                    -> "NEVER_CONTACTED"
 *   older than CRM_COLD_V3.THRESHOLD_DAYS       -> "COLD"
 *   otherwise                                   -> "IN_CONTACT"
 *
 * The boundary is STRICT: contacted exactly THRESHOLD_DAYS ago is still
 * "IN_CONTACT"; one millisecond past it is "COLD".
 */
export function computeContactState(
  lifecycle: string,
  lastContactedAt: string | Date | null,
  nowMs = Date.now()
): ContactState {
  if (lifecycle === "PAST") return "PAST";
  if (!lastContactedAt) return "NEVER_CONTACTED";
  const ts =
    typeof lastContactedAt === "string"
      ? new Date(lastContactedAt).getTime()
      : lastContactedAt.getTime();
  // An unparseable date is not evidence of silence — treat it as in contact,
  // exactly as the boolean mirror did before this slice.
  if (!Number.isFinite(ts)) return "IN_CONTACT";
  const diffDays = (nowMs - ts) / (1000 * 60 * 60 * 24);
  return diffDays > CRM_COLD_V3.THRESHOLD_DAYS ? "COLD" : "IN_CONTACT";
}

/**
 * The "Going cold" tile's rendered content. Pure and exported because the web
 * workspace has no jsdom — every web test here is pure logic, so the tile's
 * text is built by a function the suite can call directly.
 *
 * The value counts COLD only. Never-contacted is a separate number and rides
 * on a second sub-line clause that is ABSENT when the count is zero, so the
 * tile never grows a trailing "· 0 never contacted".
 *
 * The accent (the tile's attention colour) follows the cold count alone. An
 * account nobody has contacted yet is a backlog, not an alarm.
 */
export function buildGoingColdTile(
  rows: Array<Pick<AccountSummaryRow, "contactState">>
): { label: string; value: number; subLine: string; accent: boolean } {
  const cold = rows.filter((r) => r.contactState === "COLD").length;
  const never = rows.filter((r) => r.contactState === "NEVER_CONTACTED").length;
  const base = `no contact in ${CRM_COLD_V3.THRESHOLD_DAYS} days`;
  return {
    label: "Going cold",
    value: cold,
    subLine: never > 0 ? `${base} · ${never} never contacted` : base,
    accent: cold > 0
  };
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const LIFECYCLE_LABEL: Record<string, string> = {
  PROSPECT: "Prospect",
  ACTIVE: "Active",
  PAST: "Past"
};

const LIFECYCLE_BADGE_MOD: Record<string, string> = {
  PROSPECT: "warning",
  ACTIVE: "active",
  PAST: "neutral"
};

// ── Options for modals / filters ───────────────────────────────────────────────

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "CLIENT", label: "Client" },
  { value: "PROSPECT", label: "Prospect" },
  { value: "HEAD_CONTRACTOR", label: "Head contractor" },
  { value: "SUBCONTRACTOR", label: "Subcontractor" },
  { value: "PARTNER", label: "Partner" },
  { value: "OTHER", label: "Other" }
];

const ACCOUNT_SOURCE_OPTIONS: Array<{ value: AccountSource; label: string }> = [
  { value: "REFERRAL", label: "Referral" },
  { value: "DIRECT", label: "Direct" },
  { value: "TENDER_PORTAL", label: "Tender portal" },
  { value: "COLD_OUTREACH", label: "Cold outreach" },
  { value: "REPEAT_BUSINESS", label: "Repeat business" },
  { value: "OTHER", label: "Other" }
];

const LIFECYCLE_OPTIONS: Array<{ value: AccountLifecycleStatus; label: string }> = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAST", label: "Past" }
];

type ClientOption = { id: string; name: string };

// ── New-account modal ─────────────────────────────────────────────────────────

function NewAccountModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { authFetch } = useAuth();

  const [clientId, setClientId] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("CLIENT");
  const [source, setSource] = useState<AccountSource>("OTHER");
  const [lifecycleStatus, setLifecycleStatus] = useState<AccountLifecycleStatus>("PROSPECT");
  const [notes, setNotes] = useState("");

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Load clients for the client-link dropdown.
  useEffect(() => {
    setClientsLoading(true);
    void authFetch("/clients?page=1&pageSize=200&isActive=true")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { items?: ClientOption[] } | ClientOption[];
        const items = Array.isArray(data) ? data : (data.items ?? []);
        setClients(items as ClientOption[]);
      })
      .finally(() => setClientsLoading(false));
  }, [authFetch]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateCreateAccountForm({ clientId: clientId || null });
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const acc = await createAccount(authFetch, {
        clientId: clientId || null,
        accountType,
        source,
        lifecycleStatus,
        notes: notes.trim() || null
      });
      onCreated(acc.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New account"
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
        className="s7-card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 28
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>New account</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            style={{ fontSize: 20 }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {/* Client link — required (gives the account its name) */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Client link <span style={{ color: "var(--status-danger)" }}>*</span>
            </span>
            <select
              ref={firstInputRef}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              disabled={clientsLoading}
              className="s7-select"
            >
              <option value="">— Select a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {clientsLoading && (
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "block" }}>Loading clients…</span>
            )}
          </label>

          {/* Lifecycle */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Lifecycle
            </span>
            <select
              value={lifecycleStatus}
              onChange={(e) => setLifecycleStatus(e.target.value as AccountLifecycleStatus)}
              className="s7-select"
            >
              {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Type */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Type
            </span>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="s7-select"
            >
              {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Source */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Source
            </span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as AccountSource)}
              className="s7-select"
            >
              {ACCOUNT_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Notes */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="s7-textarea"
              placeholder="Optional notes about this account…"
            />
          </label>

          {formError && (
            <div
              role="alert"
              style={{
                color: "var(--status-danger)",
                fontSize: 13,
                marginBottom: 12,
                padding: "8px 10px",
                background: "color-mix(in srgb, var(--status-danger) 8%, transparent)",
                borderRadius: "var(--radius-md)"
              }}
            >
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              className="s7-btn s7-btn--secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="s7-btn s7-btn--primary crm-btn--primary"
            >
              {saving ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Log-contact modal (CRM-S6) ────────────────────────────────────────────────
// Reuses buildCreateNoteBody from RelationshipsPage so the note creation logic
// lives in exactly one place. Do NOT duplicate the note form.

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
      // accountId is non-null here (button is per-row, row always has an id).
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
        className="s7-card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 28
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Log contact — {accountName}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            style={{ fontSize: 20 }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Note <span style={{ color: "var(--status-danger)" }}>*</span>
            </span>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              className="s7-textarea"
              placeholder="Call summary, meeting notes, email follow-up…"
            />
          </label>

          {saveError && (
            <div
              role="alert"
              style={{
                color: "var(--status-danger)",
                fontSize: 13,
                marginBottom: 12,
                padding: "8px 10px",
                background: "color-mix(in srgb, var(--status-danger) 8%, transparent)",
                borderRadius: "var(--radius-md)"
              }}
            >
              {saveError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              className="s7-btn s7-btn--secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !body.trim()}
              className="s7-btn s7-btn--primary crm-btn--primary"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

/**
 * Exports the currently filtered rows as a client-side CSV.
 * Column order matches the rendered table:
 * Account, ABN, Lifecycle, Owner, Open opps, Win rate, Last contact
 */
function exportCsv(filtered: AccountSummaryRow[]): void {
  const header = ["Account", "ABN", "Lifecycle", "Owner", "Open opps", "Win rate", "Last contact"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = filtered.map((r) => [
    esc(r.name),
    esc(r.abn ?? ""),
    esc(LIFECYCLE_LABEL[r.lifecycle] ?? r.lifecycle),
    esc(r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : ""),
    String(r.openOpportunitiesCount),
    esc(formatWinRate(r.winRate)),
    esc(fmtRelative(r.lastContactedAt))
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "accounts.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return "Today";
    if (days === 1) return "1d ago";
    if (days < 30) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (days < 90) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AccountsListPage({
  tabs,
  activeId
}: {
  tabs?: CrmTabDef[];
  activeId?: string;
} = {}) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AccountSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CRM-S4: unlinked client count for the banner.
  const [unlinkedCount, setUnlinkedCount] = useState<number | null>(null);
  const [showLinkPreview, setShowLinkPreview] = useState(false);

  // CRM-S5: new account modal.
  const [showNewAccount, setShowNewAccount] = useState(false);

  // CRM-S6: log-contact modal — stores the account row being contacted.
  const [logContactRow, setLogContactRow] = useState<{ id: string; name: string } | null>(null);

  // Filter state — client-side over the already-loaded rows.
  const [searchText, setSearchText] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, linkRes] = await Promise.all([
        authFetch("/crm/accounts/summary"),
        authFetch("/crm/accounts/link-preview")
      ]);
      if (!summaryRes.ok) throw new Error(await readApiErrorMessage(summaryRes));
      setRows((await summaryRes.json()) as AccountSummaryRow[]);
      if (linkRes.ok) {
        const linkRows = (await linkRes.json()) as Array<{ existingAccountId: string | null }>;
        setUnlinkedCount(linkRows.filter((r) => r.existingAccountId === null).length);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived stat tiles ─────────────────────────────────────────────────────

  const totalAccounts = rows.length;
  const openOppsTotal = rows.reduce((sum, r) => sum + r.openOpportunitiesCount, 0);
  // CRM_COLD_V3: the tile counts COLD only, and carries the never-contacted
  // count on a second sub-line clause. buildGoingColdTile owns both.
  const goingColdTile = buildGoingColdTile(rows);
  // unlinkedCount comes from the link-preview fetch.

  // ── Client-side filtering ──────────────────────────────────────────────────

  const filteredRows = rows.filter((r) => {
    if (searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(term)) return false;
    }
    if (lifecycleFilter !== "ALL" && r.lifecycle !== lifecycleFilter) return false;
    if (ownerFilter !== "ALL") {
      if (ownerFilter === "UNASSIGNED") {
        if (r.owner !== null) return false;
      } else {
        if (r.owner?.id !== ownerFilter) return false;
      }
    }
    return true;
  });

  // Distinct owner list built from the loaded rows (no extra API call).
  const ownerOptions = Array.from(
    new Map(
      rows
        .filter((r) => r.owner !== null)
        .map((r) => [r.owner!.id, r.owner!])
    ).values()
  ).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  // CRM-S4: render the link-preview overlay when open.
  if (showLinkPreview) {
    return (
      <div style={{ padding: "24px 32px" }}>
        <button
          onClick={() => setShowLinkPreview(false)}
          className="s7-btn s7-btn--secondary"
          style={{ marginBottom: 16 }}
        >
          &larr; Back to accounts list
        </button>
        <AccountLinkPreview
          onDone={() => {
            setShowLinkPreview(false);
            void load();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* crm-page-head: title + subtitle left, actions right */}
      <div className="crm-page-head">
        <div className="crm-page-head__left">
          <h1 className="s7-type-page-title" style={{ margin: 0 }}>Accounts</h1>
          <p className="crm-page-head__subtitle">
            Every organisation you tender to, subcontract under, or have worked for.
          </p>
        </div>
        <div className="crm-page-head__actions">
          <button
            onClick={() => exportCsv(filteredRows)}
            className="s7-btn s7-btn--secondary"
          >
            Export
          </button>
          <button
            onClick={() => setShowNewAccount(true)}
            className="s7-btn s7-btn--primary crm-btn--primary"
          >
            + New account
          </button>
        </div>
      </div>

      {/* CrmTabs — rendered here so AccountsPage owns count data */}
      {tabs && activeId != null && (
        <CrmTabs tabs={tabs} activeId={activeId} ariaLabel="Accounts sections" />
      )}

      {/* Loading / error */}
      {loading && (
        <p style={{ color: "var(--text-muted)" }}>Loading accounts…</p>
      )}
      {error && (
        <div
          role="alert"
          style={{
            color: "var(--status-danger)",
            padding: 12,
            background: "color-mix(in srgb, var(--status-danger) 8%, transparent)",
            borderRadius: "var(--radius-md)",
            marginBottom: 16
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* KPI tiles — four s7-card crm-kpi cards */}
          <div className="s7-card-grid s7-card-grid--kpi" style={{ marginBottom: 24 }}>
            {/* Accounts */}
            <div className="s7-card crm-kpi">
              <span className="s7-type-label crm-kpi__label">Accounts</span>
              <span className="crm-kpi__value">{totalAccounts}</span>
              <span className="crm-kpi__sub">all non-archived</span>
            </div>

            {/* Open opportunities */}
            <div className="s7-card crm-kpi">
              <span className="s7-type-label crm-kpi__label">Open opportunities</span>
              <span className="crm-kpi__value">{openOppsTotal}</span>
              <span className="crm-kpi__sub">across all accounts</span>
            </div>

            {/* Going cold */}
            <div className={`s7-card crm-kpi${goingColdTile.accent ? " crm-kpi--warning" : ""}`}>
              <span className="s7-type-label crm-kpi__label">{goingColdTile.label}</span>
              <span className="crm-kpi__value">{goingColdTile.value}</span>
              <span className="crm-kpi__sub">{goingColdTile.subLine}</span>
            </div>

            {/* Unlinked clients */}
            <div className={`s7-card crm-kpi${(unlinkedCount ?? 0) > 0 ? " crm-kpi--danger" : ""}`}>
              <span className="s7-type-label crm-kpi__label">Unlinked clients</span>
              <span className="crm-kpi__value">{unlinkedCount ?? 0}</span>
              <span className="crm-kpi__sub">
                {(unlinkedCount ?? 0) === 0 ? "no account row yet" : `${unlinkedCount} need linking`}
              </span>
            </div>
          </div>

          {/* CRM-S4: unlinked-clients banner */}
          {unlinkedCount !== null && unlinkedCount > 0 && (
            <div className="crm-alert--warning">
              <span className="crm-alert--warning__text">
                <strong>{unlinkedCount} client{unlinkedCount !== 1 ? "s have" : " has"} no account.</strong>{" "}
                Review and commit the link — this is a one-time catch-up.
              </span>
              <button
                onClick={() => setShowLinkPreview(true)}
                className="s7-btn s7-btn--secondary s7-btn--sm"
                style={{ whiteSpace: "nowrap" }}
              >
                Review and link &rarr;
              </button>
            </div>
          )}

          {/* Filter + table card */}
          <div className="s7-card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Filter row */}
            <div style={{ display: "flex", gap: 8, padding: "16px 20px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search accounts"
                className="s7-input"
                style={{ flex: "1 1 200px" }}
              />
              <select
                value={lifecycleFilter}
                onChange={(e) => setLifecycleFilter(e.target.value)}
                className="s7-btn s7-btn--secondary s7-btn--sm crm-filter-chip"
                style={{ height: "var(--density-control-height)" }}
              >
                <option value="ALL">Lifecycle: All ▾</option>
                {LIFECYCLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="s7-btn s7-btn--secondary s7-btn--sm crm-filter-chip"
                style={{ height: "var(--density-control-height)" }}
              >
                <option value="ALL">Owner: All ▾</option>
                <option value="UNASSIGNED">Unassigned</option>
                {ownerOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>
                ))}
              </select>
            </div>

            {/* Empty state */}
            {rows.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)"
                }}
              >
                <p style={{ marginBottom: 16 }}>No accounts yet.</p>
                <button
                  onClick={() => setShowNewAccount(true)}
                  className="s7-btn s7-btn--primary crm-btn--primary"
                >
                  + Create your first account
                </button>
              </div>
            ) : (
              /* Accounts table — columns per mock-up:
                 Account (name + ABN) | Lifecycle | Owner | Open opps | Win rate | Last contact | [Log contact] */
              <div className="s7-table-scroll">
                <table className="s7-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Lifecycle</th>
                      <th>Owner</th>
                      <th style={{ textAlign: "right" }}>Open opps</th>
                      <th style={{ textAlign: "right" }}>Win rate</th>
                      <th>Last contact</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => navigate(`/crm/accounts/${row.id}`)}
                        className="s7-table__row--clickable"
                      >
                        {/* Account — name (600) + crm-cell-sub ABN */}
                        <td>
                          <span
                            style={{ fontWeight: 600, color: "var(--brand-primary)", cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/accounts/${row.id}`);
                            }}
                          >
                            {row.name}
                          </span>
                          {row.abn && (
                            <div className="crm-cell-sub">ABN {row.abn}</div>
                          )}
                        </td>

                        {/* Lifecycle — s7-badge via LIFECYCLE_LABEL, never raw uppercase */}
                        <td>
                          <span className={`s7-badge s7-badge--${LIFECYCLE_BADGE_MOD[row.lifecycle] ?? "neutral"}`}>
                            {LIFECYCLE_LABEL[row.lifecycle] ?? row.lifecycle}
                          </span>
                        </td>

                        {/* Owner */}
                        <td>
                          {row.owner
                            ? `${row.owner.firstName} ${row.owner.lastName}`
                            : <span style={{ color: "var(--text-muted)" }}>Unassigned</span>
                          }
                        </td>

                        {/* Open opportunities */}
                        <td style={{ textAlign: "right" }}>{row.openOpportunitiesCount}</td>

                        {/* Win rate */}
                        <td style={{ textAlign: "right" }}>{formatWinRate(row.winRate)}</td>

                        {/* Last contact — with GOING COLD (s7-badge--warning) and
                            NEVER CONTACTED (s7-badge--neutral) states */}
                        <td>
                          <div>{fmtRelative(row.lastContactedAt)}</div>
                          {row.contactState === "COLD" && (
                            <span
                              aria-label="Going cold"
                              className="s7-badge s7-badge--warning"
                              style={{ marginTop: 4 }}
                            >
                              GOING COLD
                            </span>
                          )}
                          {/* CRM_COLD_V3: never-contacted is its own state and
                              reads deliberately quieter than the cold chip —
                              same slot, same shape, neutral badge. A backlog, not an alarm. */}
                          {row.contactState === "NEVER_CONTACTED" && (
                            <span
                              aria-label="Never contacted"
                              className="s7-badge s7-badge--neutral"
                              style={{ marginTop: 4 }}
                            >
                              Never contacted
                            </span>
                          )}
                        </td>

                        {/* CRM-S6: Log contact */}
                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{ textAlign: "right" }}
                        >
                          <button
                            aria-label={`Log contact for ${row.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogContactRow({ id: row.id, name: row.name });
                            }}
                            className="s7-btn s7-btn--secondary s7-btn--sm"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            Log contact
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* CRM-S5: new account modal */}
      {showNewAccount && (
        <NewAccountModal
          onClose={() => setShowNewAccount(false)}
          onCreated={(id) => {
            setShowNewAccount(false);
            void load();
            navigate(`/crm/accounts/${id}`);
          }}
        />
      )}

      {/* CRM-S6: log-contact modal */}
      {logContactRow && (
        <LogContactModal
          accountId={logContactRow.id}
          accountName={logContactRow.name}
          onClose={() => setLogContactRow(null)}
          onSaved={() => {
            setLogContactRow(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
