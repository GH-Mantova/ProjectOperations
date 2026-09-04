// CRM_ACCOUNTS_LIST_V2
// design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { formatWinRate } from "./formatWinRate";
import { AccountLinkPreview } from "./AccountLinkPreview";
import { buildCreateNoteBody } from "./RelationshipsPage";
import { CRM_COLD_V2 } from "./crm-cold";

// Re-exported so the existing computeGoingCold callers (and its dedicated
// vitest suite in AccountsListPage.test.ts) can keep importing CRM_COLD_V2
// from this module. The constant itself lives at ./crm-cold to keep it off
// the circular-import path with RelationshipsPage.
export { CRM_COLD_V2 };
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
};

// ── Helper: goingCold logic (pure, exported for unit tests) ───────────────────

/**
 * Derives the going-cold flag from a summary row.
 * Mirrors the server-side deriveGoingCold — exported so the vitest suite
 * can assert the four cases without a DOM or fetch mock.
 *
 * CRM_COLD_V2 rules (2026-09-01):
 *   - lifecycle === "PAST"        → never cold
 *   - lastContactedAt null        → COLD (if non-PAST) — never-contacted is coldest
 *   - lastContactedAt > 60 days   → cold
 */
export function computeGoingCold(
  lifecycle: string,
  lastContactedAt: string | Date | null,
  nowMs = Date.now()
): boolean {
  if (lifecycle === "PAST") return false;
  if (!lastContactedAt) return CRM_COLD_V2.NULL_IS_COLD;
  const ts =
    typeof lastContactedAt === "string"
      ? new Date(lastContactedAt).getTime()
      : lastContactedAt.getTime();
  if (!Number.isFinite(ts)) return false;
  const diffDays = (nowMs - ts) / (1000 * 60 * 60 * 24);
  return diffDays > CRM_COLD_V2.THRESHOLD_DAYS;
}

// ── New-account modal ─────────────────────────────────────────────────────────

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
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>New account</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280", padding: "0 4px" }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {/* Client link — required (gives the account its name) */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Client link <span style={{ color: "#dc2626" }}>*</span>
            </span>
            <select
              ref={firstInputRef}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              disabled={clientsLoading}
              style={fieldStyle}
            >
              <option value="">— Select a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {clientsLoading && (
              <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, display: "block" }}>Loading clients…</span>
            )}
          </label>

          {/* Lifecycle */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Lifecycle
            </span>
            <select value={lifecycleStatus} onChange={(e) => setLifecycleStatus(e.target.value as AccountLifecycleStatus)} style={fieldStyle}>
              {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Type */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Type
            </span>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} style={fieldStyle}>
              {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Source */}
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Source
            </span>
            <select value={source} onChange={(e) => setSource(e.target.value as AccountSource)} style={fieldStyle}>
              {ACCOUNT_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {/* Notes */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ ...fieldStyle, resize: "vertical" }}
              placeholder="Optional notes about this account…"
            />
          </label>

          {formError && (
            <div role="alert" style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, padding: "8px 10px", background: "#fef2f2", borderRadius: 6 }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}
            >
              {saving ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 13,
  background: "#fff",
  boxSizing: "border-box"
};

// ── Constants ──────────────────────────────────────────────────────────────────

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

// ── Stat tile helper ──────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  subLine,
  accent
}: {
  label: string;
  value: string | number;
  subLine?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: accent ? "#fff7ed" : "#fff",
        border: `1px solid ${accent ? "#fed7aa" : "#e5e7eb"}`,
        borderRadius: 8,
        padding: 16,
        minWidth: 140
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ? "#ea580c" : "#111827" }}>{value}</div>
      {subLine && (
        <div style={{ fontSize: 11, color: "var(--text-muted, #9ca3af)", marginTop: 2 }}>{subLine}</div>
      )}
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
        style={{
          background: "#fff",
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
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280", padding: "0 4px" }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              Note <span style={{ color: "#dc2626" }}>*</span>
            </span>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              style={{ ...fieldStyle, resize: "vertical" }}
              placeholder="Call summary, meeting notes, email follow-up…"
            />
          </label>

          {saveError && (
            <div role="alert" style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, padding: "8px 10px", background: "#fef2f2", borderRadius: 6 }}>
              {saveError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !body.trim()}
              style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}
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

// ── Component ─────────────────────────────────────────────────────────────────

export function AccountsListPage() {
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
  const goingColdCount = rows.filter((r) => r.goingCold).length;
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
          style={{
            marginBottom: 16,
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
            fontSize: 13
          }}
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
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20
        }}
      >
        <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: 0 }}>
          Accounts
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => exportCsv(filteredRows)}
            style={{
              padding: "10px 18px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              minHeight: 44,
              fontSize: 14
            }}
          >
            Export
          </button>
          <button
            onClick={() => setShowNewAccount(true)}
            style={{
              padding: "10px 18px",
              borderRadius: 6,
              border: "none",
              background: "#6366f1",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
              fontSize: 14
            }}
          >
            + New account
          </button>
        </div>
      </div>

      {/* Loading / error */}
      {loading && (
        <p style={{ color: "var(--text-muted, #666)" }}>Loading accounts…</p>
      )}
      {error && (
        <div
          role="alert"
          style={{
            color: "#dc2626",
            padding: 12,
            background: "#fef2f2",
            borderRadius: 6,
            marginBottom: 16
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stat tiles — mock-up's four */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <StatTile label="Accounts" value={totalAccounts} subLine="all non-archived" />
            <StatTile label="Open opportunities" value={openOppsTotal} subLine="across all accounts" />
            <StatTile
              label="Going cold"
              value={goingColdCount}
              subLine={`no contact in ${CRM_COLD_V2.THRESHOLD_DAYS} days`}
              accent={goingColdCount > 0}
            />
            <StatTile
              label="Unlinked clients"
              value={unlinkedCount ?? 0}
              subLine="no account row yet"
              accent={(unlinkedCount ?? 0) > 0}
            />
          </div>

          {/* CRM-S4: banner — shown when clients exist with no account.
              Disappears once the count reaches 0 (all clients linked). */}
          {unlinkedCount !== null && unlinkedCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                marginBottom: 20
              }}
            >
              <span style={{ fontSize: 13, color: "#92400e" }}>
                <strong>{unlinkedCount} client{unlinkedCount !== 1 ? "s have" : " has"} no account.</strong>{" "}
                Review and commit the link — this is a one-time catch-up.
              </span>
              <button
                onClick={() => setShowLinkPreview(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #f97316",
                  background: "#fff",
                  color: "#ea580c",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  minHeight: 36
                }}
              >
                Review and link &rarr;
              </button>
            </div>
          )}

          {/* Filter row — search + lifecycle + owner */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search accounts"
              style={{
                flex: "1 1 200px",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 13,
                background: "#fff"
              }}
            />
            <select
              value={lifecycleFilter}
              onChange={(e) => setLifecycleFilter(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 13,
                background: "#fff"
              }}
            >
              <option value="ALL">Lifecycle: All</option>
              {LIFECYCLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 13,
                background: "#fff"
              }}
            >
              <option value="ALL">Owner: All</option>
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
                color: "var(--text-muted, #888)",
                background: "#fff",
                border: "1px dashed #e5e7eb",
                borderRadius: 8
              }}
            >
              <p style={{ marginBottom: 16 }}>No accounts yet.</p>
              <button
                onClick={() => setShowNewAccount(true)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "#6366f1",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14
                }}
              >
                + Create your first account
              </button>
            </div>
          ) : (
            /* Accounts table — columns per mock-up:
               Account (name + ABN) | Lifecycle | Owner | Open opps | Win rate | Last contact | [Log contact] */
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                overflow: "hidden"
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f6f6f6", textAlign: "left" }}>
                    <th style={thStyle}>Account</th>
                    <th style={thStyle}>Lifecycle</th>
                    <th style={thStyle}>Owner</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Open opps</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Win rate</th>
                    <th style={thStyle}>Last contact</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/crm/accounts/${row.id}`)}
                      style={{
                        borderTop: "1px solid #f3f4f6",
                        cursor: "pointer",
                        transition: "background 0.1s"
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "";
                      }}
                    >
                      {/* Account — name + ABN sub-line */}
                      <td style={tdStyle}>
                        <span
                          style={{ color: "#6366f1", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/accounts/${row.id}`);
                          }}
                        >
                          {row.name}
                        </span>
                        {row.abn && (
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                            ABN {row.abn}
                          </div>
                        )}
                      </td>
                      {/* Lifecycle badge */}
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 12,
                            background: LIFECYCLE_COLOUR[row.lifecycle] ?? "#9ca3af",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600
                          }}
                        >
                          {LIFECYCLE_LABEL[row.lifecycle] ?? row.lifecycle}
                        </span>
                      </td>
                      {/* Owner */}
                      <td style={tdStyle}>
                        {row.owner
                          ? `${row.owner.firstName} ${row.owner.lastName}`
                          : <span style={{ color: "#9ca3af" }}>—</span>
                        }
                      </td>
                      {/* Open opportunities */}
                      <td style={{ ...tdStyle, textAlign: "right" }}>{row.openOpportunitiesCount}</td>
                      {/* Win rate */}
                      <td style={{ ...tdStyle, textAlign: "right" }}>{formatWinRate(row.winRate)}</td>
                      {/* Last contact — with GOING COLD chip inside the cell */}
                      <td style={tdStyle}>
                        <div>{fmtRelative(row.lastContactedAt)}</div>
                        {row.goingCold && (
                          <span
                            aria-label="Going cold"
                            style={{
                              display: "inline-block",
                              marginTop: 4,
                              padding: "2px 10px",
                              borderRadius: 12,
                              background: "#fff7ed",
                              border: "1px solid #fed7aa",
                              color: "#ea580c",
                              fontSize: 11,
                              fontWeight: 600
                            }}
                          >
                            Going cold
                          </span>
                        )}
                      </td>
                      {/* CRM-S6: Log contact — opens note form pre-filled for this account */}
                      <td
                        style={tdStyle}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          aria-label={`Log contact for ${row.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLogContactRow({ id: row.id, name: row.name });
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 5,
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 12,
                            color: "#374151",
                            whiteSpace: "nowrap"
                          }}
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

// ── Table styles ──────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
