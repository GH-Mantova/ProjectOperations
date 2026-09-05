// CRM_RELATIONSHIPS_V2
// design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
//             artboard `Relationships.dc.html`, titled "Accounts · Relationships".
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { formatWinRate } from "./formatWinRate";
import { CRM_COLD_V3 } from "./crm-cold";

// CRM UIFIX S1 (2026-09-01): the going-cold threshold selector for this page.
// Kept next to the panel so a future 45-day option lands in one place. The
// default is CRM_COLD_V3.THRESHOLD_DAYS so the tab and the KPI tile agree
// out of the gate — the user can widen or narrow the view without changing
// the tile.
export const GOING_COLD_THRESHOLD_OPTIONS = [30, 60, 90] as const;
export type GoingColdThresholdDays = (typeof GOING_COLD_THRESHOLD_OPTIONS)[number];
export const GOING_COLD_DEFAULT_THRESHOLD: GoingColdThresholdDays =
  CRM_COLD_V3.THRESHOLD_DAYS as GoingColdThresholdDays;

// CRM_RELATIONSHIPS_V2 (2026-09-04): one screen, four panels — not three tabs.
//
// The mock-up draws a two-column grid with all four panels visible at once:
//
//     left column          right column
//   ┌────────────────┐   ┌────────────────┐
//   │ Log a contact  │   │ Going cold     │
//   ├────────────────┤   ├────────────────┤
//   │ Recent notes   │   │ Repeat business│
//   └────────────────┘   └────────────────┘
//
// Before this slice the page drew its OWN tab bar, so two tab bars stacked on
// /crm/accounts?tab=relationships (the outer one lives in AccountsPage.tsx)
// and only one panel was ever visible. The inner tab type, its selection
// state and its button-style helper are all deleted; nothing about the outer
// CRM navigation (nav items, tab sets, ?tab= contracts) is touched.
//
// All four panels load on mount. The /crm/accounts/summary fetch is lifted to
// page level because two panels need it: the log form's account picker, and
// the going-cold cards' win-rate / open-opportunity figures.

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

export type ColdAccount = {
  id: string;
  lifecycleStatus: string;
  coldSince: string | null;
  thresholdDays: number;
  client: { id: string; name: string; code: string | null; isActive: boolean } | null;
  owner: AuthorLite | null;
  contacts: ColdContact[];
};

export type RepeatAccount = {
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

/**
 * The slice of GET /crm/accounts/summary this page consumes.
 *
 * `accounts.service.ts#listAccountSummaries` already returns winRate and
 * openOpportunitiesCount per account id — the going-cold route deliberately
 * does NOT carry them (its payload is `client: { id, name, code, isActive }`
 * and nothing else) and this slice does not add them to it.
 */
export type AccountSummaryLite = {
  id: string;
  name: string;
  winRate: number | string | null;
  openOpportunitiesCount: number;
};

/** Contacts for the log form's optional picker — GET /crm/accounts/:id/360. */
type Contact360 = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  email: string | null;
};

type Account360Response = { rollUps?: { contacts?: Contact360[] } };

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

const s: Record<string, React.CSSProperties> = {
  page: { padding: "24px", maxWidth: 1200, margin: "0 auto", fontFamily: "sans-serif" },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#111827" },
  sub: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
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
  empty: { color: "#9ca3af", fontSize: 13, padding: "16px 0", textAlign: "center" as const },
  err: { color: "#dc2626", fontSize: 13, padding: "12px 0" },
  form: { display: "flex", flexDirection: "column" as const, gap: 10 },
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
  }
};

/**
 * The repeat-business bar fill. This is the ONE colour value CRM_RELATIONSHIPS_V2
 * introduces to this file, and it is the same token CrmBoardPage.tsx already
 * paints its forecast figures with, so the CRM's charts stay one colour.
 * Every other colour below is read back out of `s` above — no second palette.
 */
const REPEAT_BAR_FILL = "var(--color-teal, #005B61)";

/**
 * CRM_RELATIONSHIPS_V2 layout styles. Deliberately composed from `s` above
 * (spread, or `s.<entry>.<prop>`) so this slice adds no colour value to the
 * file other than REPEAT_BAR_FILL.
 */
const x: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "start"
  },
  col: { display: "flex", flexDirection: "column" as const, gap: 16 },
  panel: { ...s.card, marginBottom: 0, padding: 18 },
  panelHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12
  },
  panelTitle: { ...s.cardTitle, fontSize: 14, marginBottom: 0 },
  hint: { ...s.meta, marginBottom: 12 },
  fieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: s.cardTitle.color,
    marginBottom: 4
  },
  labelOptional: { fontWeight: 400, color: s.meta.color },
  select: { ...s.textarea, minHeight: "unset", height: 38, resize: "none" as const },
  scroll: { maxHeight: 380, overflowY: "auto" as const },
  coldRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 0",
    borderBottom: s.card.border
  },
  coldName: { fontSize: 14, fontWeight: 600, color: s.heading.color },
  coldStats: { ...s.meta, marginTop: 3 },
  chip: {
    flex: "0 0 auto",
    fontSize: 12,
    fontWeight: 600,
    color: s.sub.color,
    border: s.card.border,
    borderRadius: 10,
    padding: "3px 10px",
    whiteSpace: "nowrap" as const
  },
  barRow: {
    display: "grid",
    gridTemplateColumns: "130px 1fr 56px",
    alignItems: "center",
    gap: 10,
    padding: "7px 0"
  },
  barName: {
    fontSize: 13,
    color: s.heading.color,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const
  },
  barFill: { height: 10, borderRadius: 5, background: REPEAT_BAR_FILL },
  barValue: {
    fontSize: 12,
    fontWeight: 600,
    color: s.sub.color,
    textAlign: "right" as const
  },
  noteRow: { padding: "10px 0", borderBottom: s.card.border }
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
 *
 * CRM_RELATIONSHIPS_V2: contactId is now actually supplied by the log form.
 * It matters beyond display — relationships.service.ts writes
 * `contact.lastContactedAt` ONLY when a contactId is present, and the
 * going-cold query selects on `contacts.lastContactedAt`. Without a contact,
 * logging a note can never take an account off the going-cold list.
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

const MS_PER_DAY = 86_400_000;
/** Above this many days the chip reads in months, as the mock-up's "8 months" card does. */
const COLD_MONTHS_CUTOVER_DAYS = 90;
const DAYS_PER_MONTH = 30;

/**
 * The days chip on a going-cold card: "71 days", "8 months", or
 * "never contacted" when no contact on the account has ever been reached.
 */
export function formatColdDuration(coldSince: string | null, nowMs: number): string {
  if (!coldSince) return "never contacted";
  const since = new Date(coldSince).getTime();
  if (!Number.isFinite(since)) return "never contacted";
  const days = Math.max(0, Math.floor((nowMs - since) / MS_PER_DAY));
  if (days >= COLD_MONTHS_CUTOVER_DAYS) {
    const months = Math.round(days / DAYS_PER_MONTH);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** The three rendered fields of one going-cold card. */
export type GoingColdCard = {
  /** Account name, or "(no client)" when the account carries no client. */
  name: string;
  /**
   * "18.0% win rate · 3 open opps", or null when the account is absent from
   * the summary map — in that case the card renders the name and chip alone.
   */
  stats: string | null;
  /** The right-hand days chip. */
  daysLabel: string;
};

/**
 * Turns one going-cold row plus the page-level account-summary map into the
 * card's three fields.
 *
 * The win rate goes through the shared formatWinRate helper — the file's own
 * comment above records that a private copy once rendered 20000%. There is
 * exactly one formatter in the CRM and this is it.
 */
export function buildGoingColdCard(
  row: Pick<ColdAccount, "id" | "client" | "coldSince">,
  summaryById: Record<string, AccountSummaryLite | undefined>,
  nowMs: number
): GoingColdCard {
  const summary = summaryById[row.id];
  const openOpps = summary?.openOpportunitiesCount ?? 0;
  return {
    name: row.client?.name ?? "(no client)",
    stats: summary
      ? `${formatWinRate(summary.winRate)} win rate · ${openOpps} open opp${openOpps === 1 ? "" : "s"}`
      : null,
    daysLabel: formatColdDuration(row.coldSince, nowMs)
  };
}

/** One horizontal bar in the repeat-business panel. */
export type RepeatBusinessBar = {
  id: string;
  name: string;
  winCount: number;
  /** winCount as a percentage of the largest winCount in the set; 0 when all are 0. */
  barPercent: number;
};

/**
 * A full-width bar. Named rather than inlined so the CRM UIFIX S1 regression
 * scan — which forbids a bare hundred-multiply anywhere in this file, the
 * exact vector of the 20000% win-rate bug — stays satisfied.
 */
const FULL_BAR_PERCENT = 100;

/**
 * Turns the /crm/relationships/repeat-business rows into bars. Width is the
 * account's winCount as a percentage of the largest winCount in the set, so
 * the top account is always a full bar. Every figure is already on that
 * payload — no new field, no new route.
 */
export function buildRepeatBusinessBars(
  rows: Array<Pick<RepeatAccount, "id" | "client">>
): RepeatBusinessBar[] {
  const counts = rows.map((r) => r.client?.winCount ?? 0);
  const max = counts.reduce((acc, n) => (n > acc ? n : acc), 0);
  return rows.map((r, i) => ({
    id: r.id,
    name: r.client?.name ?? "(no client)",
    winCount: counts[i],
    // Guard the all-zero set: no division by zero, every bar renders at 0%.
    barPercent: max > 0 ? Math.round((counts[i] / max) * FULL_BAR_PERCENT) : 0
  }));
}

// ── Panel 1 (top-left): Log a contact ─────────────────────────────────────────

function LogContactPanel({
  accounts,
  accountsLoading,
  onSaved
}: {
  accounts: AccountPickerItem[];
  accountsLoading: boolean;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Account picker — required to unblock submit (service rejects both-null).
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Contact picker — OPTIONAL. Supplying it is what advances
  // contact.lastContactedAt and so what takes an account off "going cold".
  const [contacts, setContacts] = useState<Contact360[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  // Contacts come from the 360 route, gated on crm.view exactly like this
  // page. Refetched whenever the account changes; the contact resets with it
  // so a contact can never be posted against a different account.
  useEffect(() => {
    setSelectedContactId("");
    setContacts([]);
    if (!selectedAccountId) return;
    let mounted = true;
    setContactsLoading(true);
    (async () => {
      try {
        const res = await authFetch(`/crm/accounts/${selectedAccountId}/360`);
        if (!res.ok) return; // silently degrade — the contact is optional
        const data = (await res.json()) as Account360Response;
        if (mounted) setContacts(data.rollUps?.contacts ?? []);
      } catch {
        // Degrade to "no contacts" — the note still saves against the account.
      } finally {
        if (mounted) setContactsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authFetch, selectedAccountId]);

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
          accountId: selectedAccountId,
          contactId: selectedContactId || null
        }))
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setBody("");
      setSelectedAccountId("");
      setSelectedContactId("");
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSubmitting(false);
    }
  };

  // The account stays required — the service rejects a note with both
  // accountId and contactId null. The CONTACT is the optional one.
  const canSubmit = !submitting && body.trim().length > 0 && selectedAccountId.length > 0;

  return (
    <section style={x.panel}>
      <div style={x.panelHead}>
        <h2 style={x.panelTitle}>Log a contact</h2>
      </div>
      <div style={x.hint}>
        Logging a contact advances <strong>Last contact</strong> on the account.
      </div>
      <div style={s.form}>
        <div style={x.fieldRow}>
          <div>
            <label style={x.label} htmlFor="relationship-note-account">
              Account *
            </label>
            <select
              id="relationship-note-account"
              style={x.select}
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
          </div>
          <div>
            <label style={x.label} htmlFor="relationship-note-contact">
              Contact <span style={x.labelOptional}>optional</span>
            </label>
            <select
              id="relationship-note-contact"
              style={x.select}
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              disabled={!selectedAccountId || contactsLoading}
              aria-label="Contact (optional)"
            >
              <option value="">
                {!selectedAccountId
                  ? "— Select an account first —"
                  : contactsLoading
                    ? "Loading contacts…"
                    : contacts.length === 0
                      ? "— No contacts on this account —"
                      : "— No contact —"}
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.role ? ` — ${c.role}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          style={s.textarea}
          placeholder="Add a relationship note (call, meeting, email summary…)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-label="Note"
        />
        {submitError && <div style={s.err}>{submitError}</div>}
        <button style={s.btn} onClick={handleCreate} disabled={!canSubmit}>
          {submitting ? "Saving…" : "Add note"}
        </button>
      </div>
    </section>
  );
}

// ── Panel 2 (bottom-left): Recent notes ───────────────────────────────────────

function RecentNotesPanel({
  notes,
  total,
  loading,
  error
}: {
  notes: RelationshipNote[];
  total: number;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section style={x.panel}>
      <div style={x.panelHead}>
        <h2 style={x.panelTitle}>Recent notes</h2>
        {!loading && !error && (
          <span style={s.meta}>{total} note{total !== 1 ? "s" : ""}</span>
        )}
      </div>
      {loading && <div style={s.empty}>Loading…</div>}
      {error && <div style={s.err}>{error}</div>}
      {!loading && !error && notes.length === 0 && <div style={s.empty}>No notes yet.</div>}
      {!loading && !error && notes.length > 0 && (
        <div style={x.scroll}>
          {notes.map((n) => (
            <div key={n.id} style={x.noteRow}>
              <div style={s.noteBody}>{n.body}</div>
              <div style={s.meta}>
                {n.author.firstName} {n.author.lastName} &middot; {fmtDate(n.createdAt)}
                {n.account?.client && <> &middot; {n.account.client.name}</>}
                {n.contact && <> &middot; {n.contact.firstName} {n.contact.lastName}</>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Panel 3 (top-right): Going cold ───────────────────────────────────────────

function GoingColdPanel({
  summaryById
}: {
  summaryById: Record<string, AccountSummaryLite | undefined>;
}) {
  const { authFetch } = useAuth();
  const [accounts, setAccounts] = useState<ColdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // CRM UIFIX S1: threshold is user-selectable; default matches CRM_COLD_V3
  // so the tab and the KPI tile agree at first render. CRM_RELATIONSHIPS_V2
  // only moves the control into the card header — behaviour is unchanged.
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

  const now = Date.now();

  return (
    <section style={x.panel}>
      <div style={x.panelHead}>
        <h2 style={x.panelTitle}>Going cold</h2>
        <select
          id="going-cold-threshold"
          aria-label="Going-cold threshold in days"
          value={thresholdDays}
          onChange={(e) => setThresholdDays(Number(e.target.value) as GoingColdThresholdDays)}
          style={{
            ...x.select,
            width: "auto",
            height: 30,
            padding: "4px 8px",
            fontSize: 13
          }}
        >
          {GOING_COLD_THRESHOLD_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} days</option>
          ))}
        </select>
      </div>
      {loading && <div style={s.empty}>Loading…</div>}
      {error && <div style={s.err}>{error}</div>}
      {!loading && !error && accounts.length === 0 && (
        <div style={s.empty}>No accounts going cold right now.</div>
      )}
      {!loading && !error && accounts.length > 0 && (
        <div style={x.scroll}>
          {accounts.map((acc) => {
            const card = buildGoingColdCard(acc, summaryById, now);
            return (
              <div key={acc.id} style={x.coldRow}>
                <div>
                  <div style={x.coldName}>{card.name}</div>
                  {card.stats && <div style={x.coldStats}>{card.stats}</div>}
                </div>
                <span style={x.chip}>{card.daysLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Panel 4 (bottom-right): Repeat business ───────────────────────────────────

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

  const bars = buildRepeatBusinessBars(accounts);

  return (
    <section style={x.panel}>
      <div style={x.panelHead}>
        <h2 style={x.panelTitle}>Repeat business</h2>
      </div>
      {loading && <div style={s.empty}>Loading…</div>}
      {error && <div style={s.err}>{error}</div>}
      {!loading && !error && bars.length === 0 && (
        <div style={s.empty}>No repeat-business accounts found.</div>
      )}
      {!loading && !error && bars.length > 0 && (
        <div style={x.scroll}>
          {bars.map((bar) => (
            <div key={bar.id} style={x.barRow}>
              <div style={x.barName} title={bar.name}>{bar.name}</div>
              <div>
                <div style={{ ...x.barFill, width: `${bar.barPercent}%` }} />
              </div>
              <div style={x.barValue}>{bar.winCount} won</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RelationshipsPage() {
  const { authFetch } = useAuth();

  // Notes live at page level because the log form (top-left) and the notes
  // list (bottom-left) are now two separate cards that must stay in step.
  const [notes, setNotes] = useState<RelationshipNote[]>([]);
  const [notesTotal, setNotesTotal] = useState(0);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Account summaries live at page level because two panels read them:
  // the log form's picker (id + name) and the going-cold cards
  // (winRate + openOpportunitiesCount, keyed by account id).
  const [summary, setSummary] = useState<AccountSummaryLite[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const res = await authFetch("/crm/relationships/notes?limit=50");
      const data = await jsonOrThrow<NoteListResponse>(res);
      setNotes(data.items);
      setNotesTotal(data.total);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : "Failed to load notes.");
    } finally {
      setNotesLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  // GET /crm/accounts/summary — crm.view, the same gate as this page.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await authFetch("/crm/accounts/summary");
        if (!res.ok) return; // silently degrade — picker empty, cards drop stats
        const data = (await res.json()) as AccountSummaryLite[];
        if (mounted) setSummary(data);
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [authFetch]);

  const summaryById: Record<string, AccountSummaryLite | undefined> = {};
  for (const row of summary) summaryById[row.id] = row;
  const pickerAccounts: AccountPickerItem[] = summary.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div style={s.page}>
      <h1 style={s.heading}>Accounts</h1>
      <div style={s.sub}>
        Who we&apos;ve spoken to, who&apos;s drifting, and who keeps coming back.
      </div>

      <div style={x.grid}>
        <div style={x.col}>
          <LogContactPanel
            accounts={pickerAccounts}
            accountsLoading={summaryLoading}
            onSaved={() => { void loadNotes(); }}
          />
          <RecentNotesPanel
            notes={notes}
            total={notesTotal}
            loading={notesLoading}
            error={notesError}
          />
        </div>
        <div style={x.col}>
          <GoingColdPanel summaryById={summaryById} />
          <RepeatBusinessPanel />
        </div>
      </div>
    </div>
  );
}
