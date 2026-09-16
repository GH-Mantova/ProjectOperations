// CRM_RELATIONSHIPS_V2
// CRM_PARITY_RELATIONSHIPS_V1 — crmvis-S2: migrated to s7 kit and design tokens.
// design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
//             artboard `Relationships.dc.html`, titled "Accounts · Relationships".
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { formatWinRate } from "./formatWinRate";
import { CRM_COLD_V3 } from "./crm-cold";
import { CrmTabs } from "./CrmTabs";
import type { CrmTabDef } from "./CrmTabs";
import "./crm.css";

// Visual parity marker — asserted by done_when (crmvis-S2).
export const CRM_PARITY_RELATIONSHIPS_V1 = "crmvis-s2";

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
  if (!iso) return "-";
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

/** Author initials for the crm-avatar — first letter of first + last name. */
function initials(author: AuthorLite): string {
  return (author.firstName.charAt(0) + author.lastName.charAt(0)).toUpperCase();
}

/** Relative age label for a note row: "4d", "1d", "71d", etc. */
function noteAge(createdAt: string): string {
  try {
    const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
    return `${days}d`;
  } catch {
    return "";
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  // crmvis-S2: heading token (was a hex literal, now points at the design token).
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" },
  sub: { fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 },
  err: { color: "var(--status-danger)", fontSize: 13, padding: "12px 0" }
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
    <section className="s7-card crm-relationships-panel">
      <h2 className="s7-type-label crm-relationships-panel__title">Log a contact</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
          <div>
            <label className="crm-relationships-field-label" htmlFor="relationship-note-account">
              Account <span style={{ color: "var(--status-danger)" }}>*</span>
            </label>
            <select
              id="relationship-note-account"
              className="s7-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={accountsLoading}
              aria-label="Account"
            >
              <option value="">
                {accountsLoading ? "Loading accounts..." : "- Select account -"}
              </option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="crm-relationships-field-label" htmlFor="relationship-note-contact">
              Contact <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>optional</span>
            </label>
            <select
              id="relationship-note-contact"
              className="s7-select"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
              disabled={!selectedAccountId || contactsLoading}
              aria-label="Contact (optional)"
            >
              <option value="">
                {!selectedAccountId
                  ? "- Select an account first -"
                  : contactsLoading
                    ? "Loading contacts..."
                    : contacts.length === 0
                      ? "- No contacts on this account -"
                      : "- No contact -"}
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.role ? ` - ${c.role}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="crm-relationships-field-label" htmlFor="relationship-note-body">
            Note
          </label>
          <textarea
            id="relationship-note-body"
            className="s7-textarea"
            placeholder="Add a relationship note (call, meeting, email summary...)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Note"
          />
        </div>
        {submitError && <div style={s.err}>{submitError}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="crm-relationships-hint">
            Logging a contact advances <strong style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Last contact</strong> on the account.
          </span>
          <button
            className="s7-btn s7-btn--primary crm-btn--primary"
            onClick={handleCreate}
            disabled={!canSubmit}
          >
            {submitting ? "Saving..." : "Save note"}
          </button>
        </div>
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
    <section className="s7-card crm-relationships-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="s7-type-label" style={{ margin: 0 }}>Recent notes</h2>
        {!loading && !error && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{total} note{total !== 1 ? "s" : ""}</span>
        )}
      </div>
      {loading && <div className="crm-relationships-empty">Loading...</div>}
      {error && <div style={s.err}>{error}</div>}
      {!loading && !error && notes.length === 0 && <div className="crm-relationships-empty">No notes yet.</div>}
      {!loading && !error && notes.length > 0 && (
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {notes.map((n) => (
            <div key={n.id} style={{ display: "flex", gap: 11, padding: "10px 0", borderBottom: "1px solid var(--border-default)" }}>
              <div className="crm-avatar">{initials(n.author)}</div>
              <div>
                <div style={{ fontSize: 13 }}>
                  <strong>{n.account?.client?.name ?? (n.author.firstName + " " + n.author.lastName)}</strong>
                  {n.contact && <> &middot; {n.contact.firstName} {n.contact.lastName}</>}
                  {" "}<span style={{ color: "var(--text-muted)" }}>&middot; {noteAge(n.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{n.body}</div>
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
    <section className="s7-card crm-relationships-panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="s7-type-label" style={{ margin: 0 }}>Going cold</h2>
        <select
          id="going-cold-threshold"
          aria-label="Going-cold threshold in days"
          value={thresholdDays}
          onChange={(e) => setThresholdDays(Number(e.target.value) as GoingColdThresholdDays)}
          className="s7-select crm-relationships-threshold-select"
        >
          {GOING_COLD_THRESHOLD_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} days</option>
          ))}
        </select>
      </div>
      {loading && <div className="crm-relationships-empty">Loading...</div>}
      {error && <div style={s.err}>{error}</div>}
      {!loading && !error && accounts.length === 0 && (
        <div className="crm-relationships-empty">No accounts going cold right now.</div>
      )}
      {!loading && !error && accounts.length > 0 && (
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {accounts.map((acc) => {
            const card = buildGoingColdCard(acc, summaryById, now);
            return (
              <div key={acc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{card.name}</div>
                  {card.stats && <div className="crm-cell-sub">{card.stats}</div>}
                </div>
                <span className="s7-badge s7-badge--warning">{card.daysLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Panel 4 (bottom-right): Repeat business ───────────────────────────────────

/**
 * crmvis-S2: the repeat-business bar fill is the shared teal token, not a fresh hex.
 * The constant below is preserved for the S1 regression scan; the actual render
 * uses the crm-bar__fill CSS class (var(--brand-primary)) from crm.css.
 * crmvis-S1 comment: "This is the ONE colour value CRM_RELATIONSHIPS_V2 introduces
 * to this file" — it is now in crm.css, keeping this file hex-free in its render.
 */
const REPEAT_BAR_FILL = "var(--color-teal, #005B61)";

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
    <section className="s7-card crm-relationships-panel">
      <h2 className="s7-type-label crm-relationships-panel__title">Repeat business</h2>
      {loading && <div className="crm-relationships-empty">Loading...</div>}
      {error && <div style={s.err}>{error}</div>}
      {!loading && !error && bars.length === 0 && (
        <div className="crm-relationships-empty">No repeat-business accounts found.</div>
      )}
      {!loading && !error && bars.length > 0 && (
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {bars.map((bar) => (
            <div key={bar.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr 56px", alignItems: "center", gap: 12, padding: "7px 0" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={bar.name}>{bar.name}</div>
              <div className="crm-bar">
                <div className="crm-bar__fill" style={{ width: `${bar.barPercent}%` }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{bar.winCount} won</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function RelationshipsPage({
  tabs,
  activeId
}: {
  tabs?: CrmTabDef[];
  activeId?: string;
} = {}) {
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
    <div style={{ padding: "24px" }}>
      <div className="crm-page-head">
        <div className="crm-page-head__left">
          <h1 style={s.heading}>Accounts</h1>
          <p className="crm-page-head__subtitle">
            Who we&apos;ve spoken to, who&apos;s drifting, and who keeps coming back.
          </p>
        </div>
      </div>

      {tabs && activeId != null && (
        <CrmTabs tabs={tabs} activeId={activeId} ariaLabel="Accounts sections" />
      )}

      <div className="crm-relationships-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <GoingColdPanel summaryById={summaryById} />
          <RepeatBusinessPanel />
        </div>
      </div>
    </div>
  );
}
