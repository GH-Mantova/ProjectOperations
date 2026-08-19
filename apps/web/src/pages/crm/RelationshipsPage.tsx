import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";

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

function fmtPct(val: string | null | undefined): string {
  if (val == null) return "—";
  const num = parseFloat(val);
  return Number.isFinite(num) ? `${(num * 100).toFixed(0)}%` : "—";
}

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

  const handleCreate = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await authFetch("/crm/relationships/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // account-level note only — the user hasn't picked a specific account/contact here.
        // For a full UX the form would include account/contact pickers; keeping minimal per scope.
        body: JSON.stringify({ body: body.trim(), accountId: null, contactId: null })
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setBody("");
      void loadNotes();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={s.form}>
        <textarea
          style={s.textarea}
          placeholder="Add a relationship note (call, meeting, email summary…)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {submitError && <div style={s.err}>{submitError}</div>}
        <button style={s.btn} onClick={handleCreate} disabled={submitting || !body.trim()}>
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch("/crm/relationships/going-cold?thresholdDays=30");
        const data = await jsonOrThrow<ColdAccount[]>(res);
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
    return <div style={s.empty}>No accounts going cold right now.</div>;

  return (
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
            <td style={s.td}>{fmtPct(acc.client?.winRate)}</td>
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
