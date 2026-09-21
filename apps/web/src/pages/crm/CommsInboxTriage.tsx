// CRM S10 — CommsInboxTriage.
//
// The Inbox tab of the Comms hub (Marco's decision 3, crm-build-order-plan.md).
// In code the boundary stays clean: this component calls /crm/intake/* only.
// Comms owns threads and tasks; intake owns triage. The two modules are wired
// together in CommsHubPage as sibling tabs — they do NOT import each other.
//
// Routes consumed:
//   GET  /crm/intake/open                 — list open leads
//   POST /crm/intake                      — capture a new lead
//   POST /crm/intake/:id/triage           — Price it / Don't pursue
//
// CRM_CHROME_V1 (2026-09-04) adds Archive and Delete. Those are ENTRY verbs,
// not intake verbs: an IntakeLead.id IS an Opportunity id (listOpenLeads
// queries prisma.opportunity with isLead: true), so /crm/entries/:id/archive
// and DELETE /crm/entries/:id address the very same row. The archive modal,
// the governed reason list and the client functions all already shipped on
// /tenders/leads — this mounts them, it does not rebuild them. No second
// archive path, no second reason list, no second empty-entry rule.
//
// CRM_PARITY_INBOX_V1 (crmvis-S7): artboard Intake.dc.html design applied.
// Control row: Anchor chip (label only) + Channel crm-filter-chip select +
// Capture a lead (primary). Card: UNTRIAGED · OLDEST FIRST. Rows carry
// Lead badge (s7-badge--neutral), channel badge (--info/--active), age muted
// (amber when old), note line, Account link, and the triage action buttons
// on the right. No hex literals — all colours via var(--) tokens.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import { type PickerSelection } from "./AnchorPicker";
import { ArchiveEntryModal } from "./ArchiveEntryModal";
import {
  captureLead,
  deleteEntry,
  listDropReasons,
  listOpenLeads,
  triageLead,
  type CaptureLeadBody,
  type DropReason,
  type IntakeCaptureChannel,
  type IntakeLead
} from "./crm-api";
import "./crm.css";

// ── S7 parity marker ──────────────────────────────────────────────────────────
export const CRM_PARITY_INBOX_V1 = "crmvis-s7";

// ── Types ─────────────────────────────────────────────────────────────────────

const CAPTURE_CHANNELS: ReadonlyArray<{ value: IntakeCaptureChannel; label: string }> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "portal", label: "Portal" },
  { value: "referral", label: "Referral" },
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "other", label: "Other" }
];

const CHANNEL_LABEL: Record<IntakeCaptureChannel, string> = {
  email: "Email",
  phone: "Phone",
  portal: "Portal",
  referral: "Referral",
  cold_outreach: "Cold outreach",
  other: "Other"
};

// CRM_PARITY_INBOX_V1: channel badge tone per artboard:
//   email  → info  (blue)
//   phone  → active (teal — the artboard's "Phone" uses --active)
//   rest   → neutral
const CHANNEL_BADGE_TONE: Record<IntakeCaptureChannel, string> = {
  email: "s7-badge--info",
  phone: "s7-badge--active",
  portal: "s7-badge--neutral",
  referral: "s7-badge--neutral",
  cold_outreach: "s7-badge--neutral",
  other: "s7-badge--neutral"
};

// Age threshold in ms beyond which the age text is shown in warning amber.
const AGE_AMBER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const INTAKE_PAGE_SIZE = 25;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAge(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function isAgeOld(iso: string): boolean {
  try {
    return Date.now() - new Date(iso).getTime() > AGE_AMBER_MS;
  } catch {
    return false;
  }
}

// ── CRM_CHROME_V1 — pure row-action logic ─────────────────────────────────────
//
// Exported so the web workspace's pure-unit-test setup (vitest, no jsdom) can
// pin them without rendering. See
// components/__tests__/ShellLayout.crm-chrome.test.ts.

/** The subset of an IntakeLead the empty-entry hint can actually see. */
export type EmptyLeadFields = Pick<IntakeLead, "notes" | "contact" | "account" | "dropReason">;

/**
 * CRM_CHROME_V1 — is this lead empty enough to offer Delete?
 *
 * DELETE /crm/entries/:id is the final word: the server refuses with a 400
 * naming the blocking field when the entry has a description, contact,
 * account, estimatedValue, dropReason, convertedTender or any anchored comms
 * thread. IntakeLead carries only notes, contact, account and dropReason — no
 * estimatedValue and no convertedTender — so this is a HINT, deliberately
 * conservative: Delete is offered only when every field the client can see is
 * empty, and the server's message is surfaced on the row when it still says no.
 */
export function isIntakeLeadEmpty(lead: EmptyLeadFields): boolean {
  return !lead.notes && !lead.contact && !lead.account && !lead.dropReason;
}

/**
 * CRM_CHROME_V1 — which action set does a row show?
 *
 * An empty lead offers Delete alone; every other untriaged row offers
 * Archive · Don't pursue · Price it, in the mock-up's order.
 */
export function leadRowActionSet(lead: EmptyLeadFields): "triage" | "delete" {
  return isIntakeLeadEmpty(lead) ? "delete" : "triage";
}

/**
 * CRM_CHROME_V1 — oldest-createdAt-first ordering for the Inbox page.
 *
 * The header promises "oldest first" and listOpenLeads does not deliver it:
 * the service sorts [{ nextActionAt: asc, nulls last }, { createdAt: desc }],
 * i.e. NEWEST first on the tiebreak. This slice is web-only and must not touch
 * the service, so the promise is kept WITHIN THE PAGE ONLY — it is not a sort
 * across pages until an API slice adds an order parameter.
 *
 * Rows with an equal or unparseable timestamp keep their incoming order; rows
 * with no timestamp at all sort last, since their age is unknown.
 */
export function sortLeadsOldestFirst<T extends { createdAt: string | null }>(rows: T[]): T[] {
  const keyed = rows.map((row, index) => {
    const ms = row.createdAt ? new Date(row.createdAt).getTime() : Number.NaN;
    return { row, index, ms: Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY };
  });
  keyed.sort((a, b) => (a.ms === b.ms ? a.index - b.index : a.ms - b.ms));
  return keyed.map((entry) => entry.row);
}

// ── Don't-pursue modal ────────────────────────────────────────────────────────

function DontPursueDialog(props: {
  lead: IntakeLead;
  reasons: DropReason[];
  onClose: () => void;
  onConfirm: (reasonId: string, detail: string) => void;
  busy: boolean;
}) {
  const [reasonId, setReasonId] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <div className="crm-dialog__backdrop">
      <div className="crm-dialog" style={{ maxWidth: 480 }}>
        <div className="crm-dialog__header">
          <div className="crm-dialog__title">
            Don&apos;t pursue — {props.lead.title}
          </div>
        </div>
        <div className="crm-dialog__body">
          <div style={{ marginBottom: 12 }}>
            <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Reason *
            </label>
            <select
              className="s7-select"
              style={{ width: "100%" }}
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
            >
              <option value="">Select a reason…</option>
              {props.reasons.filter((r) => r.isActive).map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Detail (optional)
            </label>
            <input
              className="s7-input"
              style={{ width: "100%" }}
              placeholder="Additional context…"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>
        </div>
        <div className="crm-dialog__footer">
          <div />
          <div className="crm-dialog__footer-actions">
            <button
              className="s7-btn s7-btn--secondary"
              onClick={props.onClose}
              disabled={props.busy}
            >
              Cancel
            </button>
            <button
              className="s7-btn s7-btn--primary"
              style={{
                background: "var(--status-danger)",
                borderColor: "var(--status-danger)",
                opacity: !reasonId || props.busy ? 0.5 : 1
              }}
              disabled={!reasonId || props.busy}
              onClick={() => props.onConfirm(reasonId, detail)}
            >
              {props.busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Price-it modal (siteId entry) ─────────────────────────────────────────────

function PriceItDialog(props: {
  lead: IntakeLead;
  onClose: () => void;
  onConfirm: (siteId: string, title: string) => void;
  busy: boolean;
}) {
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState(props.lead.title);
  return (
    <div className="crm-dialog__backdrop">
      <div className="crm-dialog" style={{ maxWidth: 480 }}>
        <div className="crm-dialog__header">
          <div className="crm-dialog__title">
            Price it — {props.lead.title}
          </div>
        </div>
        <div className="crm-dialog__body">
          <div style={{ marginBottom: 12 }}>
            <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Site ID *
            </label>
            <input
              className="s7-input"
              style={{ width: "100%" }}
              placeholder="site-…"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Tender title
            </label>
            <input
              className="s7-input"
              style={{ width: "100%" }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <div className="crm-dialog__footer">
          <div />
          <div className="crm-dialog__footer-actions">
            <button
              className="s7-btn s7-btn--secondary"
              onClick={props.onClose}
              disabled={props.busy}
            >
              Cancel
            </button>
            <button
              className="s7-btn s7-btn--primary crm-btn--primary"
              style={{ opacity: !siteId.trim() || props.busy ? 0.5 : 1 }}
              disabled={!siteId.trim() || props.busy}
              onClick={() => props.onConfirm(siteId.trim(), title.trim())}
            >
              {props.busy ? "Creating…" : "Create tender"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Capture-a-lead form ───────────────────────────────────────────────────────
//
// CRM_PARITY_INBOX_V1: the "+ Capture a lead" button lives in the control row
// (wired from CommsInboxTriage, not a standalone card). When closed, just the
// button is visible; when open, the form card expands below the control row.

function CaptureLeadForm(props: {
  onCreated: () => void;
  anchorFilter: PickerSelection | null;
  open: boolean;
  onClose: () => void;
}) {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [channel, setChannel] = useState<IntakeCaptureChannel>("email");
  const [detail, setDetail] = useState("");

  const submit = useCallback(async () => {
    if (!title.trim() || !clientId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const dto: CaptureLeadBody = {
        title: title.trim(),
        clientId: clientId.trim(),
        captureChannel: channel,
        captureDetail: detail.trim() || null
      };
      await captureLead(authFetch, dto);
      setTitle("");
      setClientId("");
      setDetail("");
      setChannel("email");
      props.onClose();
      props.onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture lead.");
    } finally {
      setBusy(false);
    }
  }, [authFetch, channel, clientId, detail, props, title]);

  if (!props.open) return null;

  return (
    <div className="s7-card" style={{ marginBottom: 12, padding: 16 }}>
      <p className="s7-type-card-title" style={{ marginBottom: 12 }}>Capture a lead</p>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
            Title *
          </label>
          <input
            className="s7-input"
            style={{ width: "100%" }}
            placeholder="Lead title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
            Client ID *
          </label>
          <input
            className="s7-input"
            style={{ width: "100%" }}
            placeholder="client-…"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Channel
            </label>
            <select
              className="s7-select"
              style={{ width: "100%" }}
              value={channel}
              onChange={(e) => setChannel(e.target.value as IntakeCaptureChannel)}
            >
              {CAPTURE_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
              Detail (optional)
            </label>
            <input
              className="s7-input"
              style={{ width: "100%" }}
              placeholder="e.g. email subject, referrer name"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>
        </div>
      </div>
      {error && (
        <div style={{ color: "var(--status-danger)", fontSize: 12, marginTop: 8 }}>{error}</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className="s7-btn s7-btn--primary crm-btn--primary"
          style={{ opacity: !title.trim() || !clientId.trim() || busy ? 0.5 : 1 }}
          disabled={!title.trim() || !clientId.trim() || busy}
          onClick={() => void submit()}
        >
          {busy ? "Saving…" : "Capture"}
        </button>
        <button
          className="s7-btn s7-btn--secondary"
          onClick={() => { props.onClose(); setError(null); }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Lead row ──────────────────────────────────────────────────────────────────
//
// CRM_PARITY_INBOX_V1: each row carries:
//   Left: title (600 weight) + Lead badge (s7-badge--neutral) + channel badge
//         (--info/--active) + age muted (amber when old) + note line
//         + Account: <link/label>
//   Right: Archive / Don't pursue (s7-btn--secondary) + Price it
//          (s7-btn--primary crm-btn--primary) or outlined-danger Delete.

function LeadRow(props: {
  lead: IntakeLead;
  reasons: DropReason[];
  onRefresh: () => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  const { lead, reasons, onRefresh } = props;
  const [dialog, setDialog] = useState<"price" | "dont-pursue" | "archive" | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const actionSet = leadRowActionSet(lead);
  const ageOld = isAgeOld(lead.createdAt);

  // CRM_CHROME_V1 — DELETE /crm/entries/:id. The server owns the guard; when
  // it refuses with a 400 naming the blocking field, that message is shown on
  // the row verbatim rather than swallowed.
  const onDelete = useCallback(async () => {
    setBusy(true);
    setRowError(null);
    try {
      await deleteEntry(props.authFetch, lead.id);
      onRefresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }, [lead.id, onRefresh, props.authFetch]);

  const onPriceConfirm = useCallback(async (siteId: string, title: string) => {
    setBusy(true);
    setRowError(null);
    try {
      await triageLead(props.authFetch, lead.id, {
        action: "tender",
        siteId,
        tenderTitle: title || undefined
      });
      setDialog(null);
      onRefresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to triage.");
    } finally {
      setBusy(false);
    }
  }, [lead.id, onRefresh, props.authFetch]);

  const onDontPursueConfirm = useCallback(async (reasonId: string, detail: string) => {
    setBusy(true);
    setRowError(null);
    try {
      await triageLead(props.authFetch, lead.id, {
        action: "dont_pursue",
        dropReasonId: reasonId,
        dropReasonDetail: detail || null
      });
      setDialog(null);
      onRefresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to triage.");
    } finally {
      setBusy(false);
    }
  }, [lead.id, onRefresh, props.authFetch]);

  // Account display — lifecycle status or "no match" hint
  const accountDisplay = lead.account
    ? lead.account.lifecycleStatus
    : lead.client?.name
      ? `No match — will create "${lead.client.name}"`
      : null;

  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        gap: 16,
        alignItems: "flex-start"
      }}
    >
      {/* Left content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title + badges + age */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {lead.title}
          </span>
          {/* Lead type badge — always neutral per artboard */}
          <span className="s7-badge s7-badge--neutral">Lead</span>
          {/* Channel badge */}
          {lead.captureChannel && (
            <span className={`s7-badge ${CHANNEL_BADGE_TONE[lead.captureChannel]}`}>
              {CHANNEL_LABEL[lead.captureChannel]}
            </span>
          )}
          {/* Age — amber when old */}
          <span style={{
            fontSize: 11,
            color: ageOld ? "var(--status-warning)" : "var(--text-muted)"
          }}>
            {fmtAge(lead.createdAt)}
          </span>
        </div>

        {/* Note / excerpt */}
        {(lead.notes || lead.captureDetail) && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
            {lead.notes
              ? (lead.notes.length > 120 ? lead.notes.slice(0, 120) + "…" : lead.notes)
              : lead.captureDetail}
          </div>
        )}

        {/* Account line */}
        {accountDisplay && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Account: <span style={{ color: lead.account ? "var(--brand-primary)" : "var(--text-muted)" }}>
              {accountDisplay}
            </span>
          </div>
        )}

        {rowError && (
          <div style={{ color: "var(--status-danger)", fontSize: 12, marginTop: 4 }}>{rowError}</div>
        )}
      </div>

      {/* Right: action buttons */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
        {actionSet === "delete" ? (
          <button
            className="s7-btn s7-btn--secondary"
            style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}
            onClick={() => void onDelete()}
            disabled={busy}
          >
            Delete
          </button>
        ) : (
          <>
            <button
              className="s7-btn s7-btn--secondary"
              onClick={() => setDialog("archive")}
              disabled={busy}
            >
              Archive
            </button>
            <button
              className="s7-btn s7-btn--secondary"
              style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}
              onClick={() => setDialog("dont-pursue")}
              disabled={busy}
            >
              Don&apos;t pursue
            </button>
            <button
              className="s7-btn s7-btn--primary crm-btn--primary"
              onClick={() => setDialog("price")}
              disabled={busy}
            >
              Price it
            </button>
          </>
        )}
      </div>

      {dialog === "archive" && (
        <ArchiveEntryModal
          entryId={lead.id}
          entryTitle={lead.title}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onRefresh();
          }}
        />
      )}
      {dialog === "price" && (
        <PriceItDialog
          lead={lead}
          onClose={() => setDialog(null)}
          onConfirm={(siteId, title) => void onPriceConfirm(siteId, title)}
          busy={busy}
        />
      )}
      {dialog === "dont-pursue" && (
        <DontPursueDialog
          lead={lead}
          reasons={reasons}
          onClose={() => setDialog(null)}
          onConfirm={(reasonId, detail) => void onDontPursueConfirm(reasonId, detail)}
          busy={busy}
        />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * CommsInboxTriage — the Inbox tab rendered inside CommsHubPage.
 *
 * CRM_PARITY_INBOX_V1 (crmvis-S7): artboard Intake.dc.html design.
 * Control row: Anchor label + Channel crm-filter-chip + Capture a lead.
 * Card: UNTRIAGED · OLDEST FIRST, with artboard-spec row layout.
 *
 * This is lead-intake's screen inside the Comms hub window.
 * It calls /crm/intake/* only. It does NOT import anything from the comms
 * sub-module and MUST NOT (Marco's decision 3).
 *
 * Props:
 *   anchorFilter — the anchor picker selection from the parent (S9 AnchorPicker).
 *     When the user has picked an account/lead, the list is filtered by accountId.
 */
export function CommsInboxTriage(props: {
  anchorFilter: PickerSelection | null;
}) {
  const { authFetch } = useAuth();

  const [leads, setLeads] = useState<IntakeLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [channelFilter, setChannelFilter] = useState<IntakeCaptureChannel | "">("");
  const [reasons, setReasons] = useState<DropReason[]>([]);

  // CRM_PARITY_INBOX_V1: capture form state — open/closed
  const [captureOpen, setCaptureOpen] = useState(false);

  const accountIdFilter = props.anchorFilter?.kind === "entity" && props.anchorFilter.type === "ACCOUNT"
    ? props.anchorFilter.entityId
    : undefined;

  // CRM_CHROME_V1 — the anchor picker offers six types but listOpenLeads
  // accepts ownerId, accountId, captureChannel and search and nothing else.
  // Picking a Tender, Job, Contract or Lead therefore cannot filter this list.
  // Say so instead of leaving the user with no signal either way; do NOT
  // invent a query parameter.
  const unfilterableAnchor =
    props.anchorFilter?.kind === "entity" && props.anchorFilter.type !== "ACCOUNT"
      ? props.anchorFilter
      : null;

  const loadLeads = useCallback(async (targetPage: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: Parameters<typeof listOpenLeads>[1] = {
        page: targetPage,
        limit: INTAKE_PAGE_SIZE
      };
      if (channelFilter) params.captureChannel = channelFilter;
      if (accountIdFilter) params.accountId = accountIdFilter;
      const result = await listOpenLeads(authFetch, params);
      setLeads(result.items);
      setTotal(result.total);
      setPage(targetPage);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, channelFilter, accountIdFilter]);

  // Load drop reasons once.
  useEffect(() => {
    void listDropReasons(authFetch).then(setReasons).catch(() => { /* best-effort */ });
  }, [authFetch]);

  useEffect(() => {
    void loadLeads(1);
  }, [loadLeads]);

  const totalPages = Math.ceil(total / INTAKE_PAGE_SIZE) || 1;

  // CRM_CHROME_V1 — the header promises oldest first, so the page keeps it.
  // Within the page only: listOpenLeads still orders by nextActionAt then
  // createdAt DESC across pages.
  const orderedLeads = useMemo(() => sortLeadsOldestFirst(leads), [leads]);

  // Anchor label text — shown in the "Anchor:" chip legend in the control row.
  const anchorLabel = accountIdFilter
    ? (props.anchorFilter?.kind === "entity" ? props.anchorFilter.label : "Account")
    : "All";

  return (
    <div>
      {/* CRM_PARITY_INBOX_V1 — artboard control row:
          Anchor: All chip (legend) | Channel crm-filter-chip | + Capture a lead */}
      <div style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 12,
        flexWrap: "wrap"
      }}>
        {/* Anchor chip — legend only (the actual anchor filter is driven by
            the parent's AnchorPicker state; we just display it here) */}
        <span
          className={`s7-btn s7-btn--secondary s7-btn--sm crm-filter-chip${accountIdFilter ? " crm-filter-chip--active" : ""}`}
          aria-label="Anchor filter"
        >
          Anchor: {anchorLabel} &#9660;
        </span>

        {/* Channel crm-filter-chip select */}
        <select
          className={`s7-select s7-btn--sm crm-filter-chip${channelFilter ? " crm-filter-chip--active" : ""}`}
          style={{ height: 32, paddingTop: 0, paddingBottom: 0 }}
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as IntakeCaptureChannel | "")}
          aria-label="Channel filter"
        >
          <option value="">Channel: All</option>
          {CAPTURE_CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>Channel: {c.label}</option>
          ))}
        </select>

        {/* Unfilterable anchor hint */}
        {unfilterableAnchor && (
          <span className="s7-badge s7-badge--warning">
            {unfilterableAnchor.label} — Inbox filters by account only
          </span>
        )}

        {/* Lead count */}
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {total} lead{total === 1 ? "" : "s"}
        </span>

        {/* Capture a lead — primary button, rightmost in the control row */}
        <button
          className="s7-btn s7-btn--primary crm-btn--primary"
          style={{ marginLeft: "auto" }}
          onClick={() => setCaptureOpen(true)}
        >
          + Capture a lead
        </button>
      </div>

      {/* Capture form — only when open */}
      <CaptureLeadForm
        anchorFilter={props.anchorFilter}
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCreated={() => void loadLeads(1)}
      />

      {/* List card */}
      <div className="s7-card" style={{ padding: 16 }}>
        {/* CRM_CHROME_V1 / CRM_PARITY_INBOX_V1 — UNTRIAGED · OLDEST FIRST header */}
        <div style={{ marginBottom: 12 }}>
          <span className="s7-type-label" style={{ letterSpacing: "0.04em" }}>
            UNTRIAGED · OLDEST FIRST
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 10 }}>
            page {page} of {totalPages}
          </span>
        </div>

        {loadError && (
          <div style={{ color: "var(--status-danger)", fontSize: 13, marginBottom: 8 }}>
            {loadError}
          </div>
        )}

        {loading
          ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>Loading…</div>
          : orderedLeads.length === 0
            ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No open leads.</div>
            : orderedLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  reasons={reasons}
                  onRefresh={() => void loadLeads(page)}
                  authFetch={authFetch}
                />
              ))
        }

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button
              className="s7-btn s7-btn--secondary"
              disabled={page <= 1 || loading}
              onClick={() => void loadLeads(page - 1)}
            >
              Previous
            </button>
            <button
              className="s7-btn s7-btn--secondary"
              disabled={page >= totalPages || loading}
              onClick={() => void loadLeads(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
