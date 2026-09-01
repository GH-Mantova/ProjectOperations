import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { formatWinRate } from "./formatWinRate";
import { CRM_COLD_V2 } from "./crm-cold";

// CRM UIFIX S1 (2026-09-01): the going-cold threshold selector for this page.
// Kept next to the panel so a future 45-day option lands in one place. The
// default is CRM_COLD_V2.THRESHOLD_DAYS so the tab and the KPI tile agree
// out of the gate — the user can widen or narrow the view without changing
// the tile.
export const GOING_COLD_THRESHOLD_OPTIONS = [30, 60, 90] as const;
export type GoingColdThresholdDays = (typeof GOING_COLD_THRESHOLD_OPTIONS)[number];
export const GOING_COLD_DEFAULT_THRESHOLD: GoingColdThresholdDays =
  CRM_COLD_V2.THRESHOLD_DAYS as GoingColdThresholdDays;

// CRM-2: Relationship intelligence page.
// Surfaces three panels:
//   1. Relationship notes (filterable log — create/view)
//   2. Going cold (accounts/contacts not recently engaged)
//   3. Repeat business (clients with > 1 won tender)

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthorLite = { id: string; firstName: string; lastName: string };
type AccountLite = { id: string; client: { id: string; name: string } | null } | null;
type ContactLite = { id: string; firstName: string; lastName: string } | null;

type RelationshipNote = {
  id: string;
  accountId: string | null;
  contactId: string | null;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: AuthorLite;
  account: AccountLite;
  contact: ContactLite;
};

type NoteListResponse = {
  items: RelationshipNote[];
  total: number;
  page: number;
  limit: number;
};

type ColdContact = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  email: string | null;
  lastContactedAt: string | null;
};

type ColdAccount = {
  id: string;
  lifecycleStatus: string;
  coldSince: string | null;
  thresholdDays: number;
  client: { id: string; name: string; code: string | null; isActive: boolean } | null;
  owner: AuthorLite | null;
  contacts: ColdContact[];
};

type RepeatAccount = {
  id: string;
  lifecycleStatus: string;
  client: {
    id: string;
    name: string;
    code: string | null;
    winCount: number;
    tenderCount: number;
    winRate: string | null;
    lastWonAt: string | null;
    isActive: boolean;
  } | null;
  owner: AuthorLite | null;
};

type Tab = "notes" | "going-cold" | "repeat-business";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// CRM UIFIX S1 (2026-09-01): the private fmtPct helper is gone. #1322 already
// fixed win-rate rendering across the CRM by clamping in formatWinRate.ts and
// documenting "do NOT multiply by one-hundred here" — but a private copy on
// this page multiplied the stored value again and rendered 20000%. The
// server stores win_rate as an already-multiplied percentage. Two wins over
// one tender stored 200 and rendered 20000%. Import the shared helper; never
// introduce a second one.

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  return (await res.json()) as T;
}

// ── Styles ────────────────────────────────────────────────────────────────────

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 20px",
    cursor: "pointer",
    border: "none",
    background: "none",
    fontWeight: active ? 700 : 400,
    color: active ? "#6366f1" : "#374151",
    borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
    marginBottom: -2,
    fontSize: 14
  };
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: "24px", maxWidth: 960, margin: "0 auto", fontFamily: "sans-serif" },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#111827" },
  sub: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  tabs: { display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 20 },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    background: "#fff"
  },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 },
  noteBody: { fontSize: 14, color: "#111827", whiteSpace: "pre-wrap" as const, margin: "6px 0" },
  meta: { fontSize: 12, color: "#9ca3af" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "6px 8px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 600 },
  td: { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", color: "#111827" },
  empty: { color: "#9ca3af", fontSize: 13, padding: "16px 0", textAlign: "center" as const },
  err: { color: "#dc2626", fontSize: 13, padding: "12px 0" },
  form: { display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 20 },
  textarea: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    minHeight: 80,
    resize: "vertical" as const,
    boxSizing: "border-box" as const
  },
  btn: {
    padding: "8px 18px",
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    alignSelf: "flex-start"
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: "#6366f1",
    color: "#fff"
  },
  winBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    background: "#16a34a",
    color: "#fff"
  }
};

// ── Exported body builders (pure — testable without React) ────────────────────

type AccountPickerItem = { id: string; name: string };

/**
 * Builds the JSON body for POST /crm/relationships/notes.
 *
 * Guard rule (mirrors relationships.service.ts:58-62):
 *   A note must carry at least one of accountId or contactId.
 *   Sending both as null throws BadRequestException("A note must be linked to
 *   at least one of: accountId, contactId.") — that is why the caller must
 *   supply a real accountId before the submit button is enabled.
 */
export function buildCreateNoteBody(args: {
  body: string;
  accountId: string;
  contactId?: string | null;
}): {
  body: string;
  accountId: string;
  contactId: string | null;
} {
  // accountId is required (non-nullable string at the call-site).
  // contactId is optional and defaults to null.
  return {
    body: args.body,
    accountId: args.accountId,
    contactId: args.contactId ?? null
  };
}

// ── Notes panel ───────────────────────────────────────────────────────────────

function NotesPanel() {
  const { authFetch } = useAuth();
  const [notes, setNotes] = useState<RelationshipNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Account picker — required to unblock submit (service rejects both-null).
  const [accounts, setAccounts] = useState<AccountPickerItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [accountsLoading, setAccountsLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/crm/relationships/notes?limit=50");
      const data = await jsonOrThrow<NoteListResponse>(res);
      setNotes(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  // Load account summary list for the picker (crm.view — same gate as this page).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch("/crm/accounts/summary");
        if (!res.ok) return; // silently degrade — picker shows empty
        const data = await res.json() as AccountPickerItem[];
        if (mounted) setAccounts(data);
      } finally {
        if (mounted) setAccountsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [authFetch]);

  const handleCreate = async () => {
    if (!body.trim() || !selectedAccountId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch("/crm/relationships/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCreateNoteBody({
          body: body.trim(),
          accountId: selectedAccountId
        }))
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setBody("");
      setSelectedAccountId("");
      void loadNotes();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && body.trim().length > 0 && selectedAccountId.length > 0;

  return (
    <div>
      <div style={s.form}>
        <select
          style={{ ...s.textarea, minHeight: "unset", height: 38, resize: "none" }}
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          disabled={accountsLoading}
          aria-label="Account"
        >
          <option value="">
            {accountsLoading ? "Loading accounts…" : "— Select account —"}
          </option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>{acc.name}</option>
          ))}
        </select>
        <textarea
          style={s.textarea}
          placeholder="Add a relationship note (call, meeting, email summary…)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {submitError && <div style={s.err}>{submitError}</div>}
        <button style={s.btn} onClick={handleCreate} disabled={!canSubmit}>
          {submitting ? "Saving…" : "Add note"}
        </button>
      </div>
      {loading && <div style={s.empty}>Loading…</div>}
      {error && <div style={s.err}>{error}</div>}
      {!loading && !error && (
        <>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
            {total} note{total !== 1 ? "s" : ""}
          </div>
          {notes.length === 0 && <div style={s.empty}>No notes yet.</div>}
          {notes.map((n) => (
            <div key={n.id} style={s.card}>
              <div style={s.noteBody}>{n.body}</div>
              <div style={s.meta}>
                {n.author.firstName} {n.author.lastName} &middot; {fmtDate(n.createdAt)}
                {n.account?.client && <> &middot; {n.account.client.name}</>}
                {n.contact && <> &middot; {n.contact.firstName} {n.contact.lastName}</>}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Going cold panel ──────────────────────────────────────────────────────────

function GoingColdPanel() {
  const { authFetch } = useAuth();
  const [accounts, setAccounts] = useState<ColdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // CRM UIFIX S1: threshold is user-selectable; default matches CRM_COLD_V2
  // so the tab and the KPI tile agree at first render.
  const [thresholdDays, setThresholdDays] = useState<GoingColdThresholdDays>(
    GOING_COLD_DEFAULT_THRESHOLD
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await authFetch(
          `/crm/relationships/going-cold?thresholdDays=${thresholdDays}`
        );
        const data = await jsonOrThrow<ColdAccount[]>(res);
        if (mounted) setAccounts(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [authFetch, thresholdDays]);

  const selector = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <label htmlFor="going-cold-threshold" style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
        Threshold:
      </label>
      <select
        id="going-cold-threshold"
        aria-label="Going-cold threshold in days"
        value={thresholdDays}
        onChange={(e) => setThresholdDays(Number(e.target.value) as GoingColdThresholdDays)}
        style={{
          padding: "6px 10px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 13,
          background: "#fff"
        }}
      >
        {GOING_COLD_THRESHOLD_OPTIONS.map((n) => (
          <option key={n} value={n}>{n} days</option>
        ))}
      </select>
    </div>
  );

  if (loading) return <>{selector}<div style={s.empty}>Loading…</div></>;
  if (error) return <>{selector}<div style={s.err}>{error}</div></>;
  if (accounts.length === 0)
    return <>{selector}<div style={s.empty}>No accounts going cold right now.</div></>;

  return (
    <>
      {selector}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Account</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Owner</th>
            <th style={s.th}>Cold contacts</th>
            <th style={s.th}>Cold since</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((acc) => (
            <tr key={acc.id}>
              <td style={s.td}>{acc.client?.name ?? "(no client)"}</td>
              <td style={s.td}>{acc.lifecycleStatus}</td>
              <td style={s.td}>
                {acc.owner ? `${acc.owner.firstName} ${acc.owner.lastName}` : "—"}
              </td>
              <td style={s.td}>
                {acc.contacts.map((c) => (
                  <div key={c.id} style={{ fontSize: 12 }}>
                    {c.firstName} {c.lastName}
                    {c.lastContactedAt
                      ? ` (last: ${fmtDate(c.lastContactedAt)})`
                      : " (never contacted)"}
                  </div>
                ))}
              </td>
              <td style={s.td}>{fmtDate(acc.coldSince)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── Repeat business panel ─────────────────────────────────────────────────────

function RepeatBusinessPanel() {
  const { authFetch } = useAuth();
  const [accounts, setAccounts] = useState<RepeatAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch("/crm/relationships/repeat-business");
        const data = await jsonOrThrow<RepeatAccount[]>(res);
        if (mounted) setAccounts(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [authFetch]);

  if (loading) return <div style={s.empty}>Loading…</div>;
  if (error) return <div style={s.err}>{error}</div>;
  if (accounts.length === 0)
    return <div style={s.empty}>No repeat-business accounts found.</div>;

  return (
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Account</th>
          <th style={s.th}>Status</th>
          <th style={s.th}>Owner</th>
          <th style={s.th}>Wins</th>
          <th style={s.th}>Tenders</th>
          <th style={s.th}>Win rate</th>
          <th style={s.th}>Last won</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((acc) => (
          <tr key={acc.id}>
            <td style={s.td}>{acc.client?.name ?? "(no client)"}</td>
            <td style={s.td}>{acc.lifecycleStatus}</td>
            <td style={s.td}>
              {acc.owner ? `${acc.owner.firstName} ${acc.owner.lastName}` : "—"}
            </td>
            <td style={s.td}>
              {acc.client != null ? (
                <span style={s.winBadge}>{acc.client.winCount}</span>
              ) : "—"}
            </td>
            <td style={s.td}>{acc.client?.tenderCount ?? "—"}</td>
            <td style={s.td}>{formatWinRate(acc.client?.winRate)}</td>
            <td style={s.td}>{fmtDate(acc.client?.lastWonAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RelationshipsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("notes");

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Relationship intelligence</h1>
      <div style={s.sub}>
        Log notes, spot accounts going cold, and surface repeat-business opportunities.
      </div>

      <div style={s.tabs}>
        <button style={tabStyle(activeTab === "notes")} onClick={() => setActiveTab("notes")}>
          Notes
        </button>
        <button style={tabStyle(activeTab === "going-cold")} onClick={() => setActiveTab("going-cold")}>
          Going cold
        </button>
        <button style={tabStyle(activeTab === "repeat-business")} onClick={() => setActiveTab("repeat-business")}>
          Repeat business
        </button>
      </div>

      {activeTab === "notes" && <NotesPanel />}
      {activeTab === "going-cold" && <GoingColdPanel />}
      {activeTab === "repeat-business" && <RepeatBusinessPanel />}
    </div>
  );
}
