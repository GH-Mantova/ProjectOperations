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

const CHANNEL_COLOUR: Record<IntakeCaptureChannel, { bg: string; fg: string }> = {
  email: { bg: "#dbeafe", fg: "#1e40af" },
  phone: { bg: "#d1fae5", fg: "#065f46" },
  portal: { bg: "#ede9fe", fg: "#5b21b6" },
  referral: { bg: "#fef3c7", fg: "#92400e" },
  cold_outreach: { bg: "#fee2e2", fg: "#991b1b" },
  other: { bg: "#f3f4f6", fg: "#6b7280" }
};

const INTAKE_PAGE_SIZE = 25;

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  card: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12, background: "#fff" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 },
  input: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, width: "100%" },
  select: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 },
  primaryBtn: { padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  actionBtn: { padding: "4px 10px", background: "#f0fdf4", color: "#065f46", border: "1px solid #bbf7d0", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 },
  dontPursueBtn: { padding: "4px 10px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 },
  secondaryBtn: { padding: "4px 10px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontSize: 12 },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 },
  empty: { color: "#9ca3af", fontSize: 13, padding: "12px 0" },
  row: { padding: "12px 0", borderBottom: "1px solid #f3f4f6" },
  rowTitle: { fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 },
  rowMeta: { display: "flex", flexWrap: "wrap" as const, gap: 6, alignItems: "center", marginBottom: 6 },
  rowExcerpt: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  rowActions: { display: "flex", gap: 8 }
};

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

function accountChip(lead: IntakeLead): React.ReactNode {
  if (lead.account) {
    return (
      <span style={{ ...s.badge, background: "#e0e7ff", color: "#3730a3" }}>
        {lead.account.lifecycleStatus}
      </span>
    );
  }
  const name = lead.client?.name ?? "unknown client";
  return (
    <span style={{ ...s.badge, background: "#fef3c7", color: "#92400e" }}>
      no match, will create {name}
    </span>
  );
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
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50
      }}
    >
      <div style={{ background: "#fff", borderRadius: 10, padding: 24, minWidth: 360, maxWidth: 480 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Don't pursue — {props.lead.title}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
            Reason *
          </label>
          <select
            style={{ ...s.select, width: "100%" }}
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
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
            Detail (optional)
          </label>
          <input
            style={s.input}
            placeholder="Additional context…"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={s.secondaryBtn} onClick={props.onClose} disabled={props.busy}>
            Cancel
          </button>
          <button
            style={{ ...s.primaryBtn, background: "#dc2626", opacity: !reasonId || props.busy ? 0.5 : 1 }}
            disabled={!reasonId || props.busy}
            onClick={() => props.onConfirm(reasonId, detail)}
          >
            {props.busy ? "Saving…" : "Confirm"}
          </button>
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
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50
      }}
    >
      <div style={{ background: "#fff", borderRadius: 10, padding: 24, minWidth: 360, maxWidth: 480 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Price it — {props.lead.title}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
            Site ID *
          </label>
          <input
            style={s.input}
            placeholder="site-…"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
            Tender title
          </label>
          <input
            style={s.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button style={s.secondaryBtn} onClick={props.onClose} disabled={props.busy}>
            Cancel
          </button>
          <button
            style={{ ...s.primaryBtn, opacity: !siteId.trim() || props.busy ? 0.5 : 1 }}
            disabled={!siteId.trim() || props.busy}
            onClick={() => props.onConfirm(siteId.trim(), title.trim())}
          >
            {props.busy ? "Creating…" : "Create tender"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Capture-a-lead form ───────────────────────────────────────────────────────

function CaptureLeadForm(props: {
  onCreated: () => void;
  anchorFilter: PickerSelection | null;
}) {
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      props.onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture lead.");
    } finally {
      setBusy(false);
    }
  }, [authFetch, channel, clientId, detail, props, title]);

  if (!open) {
    return (
      <div style={{ marginBottom: 12 }}>
        <button style={s.primaryBtn} onClick={() => setOpen(true)}>
          + Capture a lead
        </button>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Capture a lead</div>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
            Title *
          </label>
          <input
            style={s.input}
            placeholder="Lead title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
            Client ID *
          </label>
          <input
            style={s.input}
            placeholder="client-…"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Channel
            </label>
            <select
              style={{ ...s.select, width: "100%" }}
              value={channel}
              onChange={(e) => setChannel(e.target.value as IntakeCaptureChannel)}
            >
              {CAPTURE_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Detail (optional)
            </label>
            <input
              style={s.input}
              placeholder="e.g. email subject, referrer name"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>
        </div>
      </div>
      {error && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          style={{ ...s.primaryBtn, opacity: !title.trim() || !clientId.trim() || busy ? 0.5 : 1 }}
          disabled={!title.trim() || !clientId.trim() || busy}
          onClick={() => void submit()}
        >
          {busy ? "Saving…" : "Capture"}
        </button>
        <button style={s.secondaryBtn} onClick={() => { setOpen(false); setError(null); }} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Lead row ──────────────────────────────────────────────────────────────────

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

  return (
    <div style={s.row}>
      <div style={s.rowTitle}>{lead.title}</div>
      <div style={s.rowMeta}>
        {lead.captureChannel && (
          <span style={{
            ...s.badge,
            background: CHANNEL_COLOUR[lead.captureChannel].bg,
            color: CHANNEL_COLOUR[lead.captureChannel].fg
          }}>
            {CHANNEL_LABEL[lead.captureChannel]}
          </span>
        )}
        <span style={{ ...s.badge, background: "#f3f4f6", color: "#6b7280" }}>
          {lead.client?.name ?? "Unknown client"}
        </span>
        {accountChip(lead)}
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtAge(lead.createdAt)}</span>
      </div>
      {lead.notes && (
        <div style={s.rowExcerpt}>
          {lead.notes.length > 120 ? lead.notes.slice(0, 120) + "…" : lead.notes}
        </div>
      )}
      {lead.captureDetail && !lead.notes && (
        <div style={s.rowExcerpt}>{lead.captureDetail}</div>
      )}
      {rowError && (
        <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 6 }}>{rowError}</div>
      )}
      {/* CRM_CHROME_V1 — [Archive] [Don't pursue] [Price it] in the mock-up's
          order; [Delete] alone on an empty lead. */}
      <div style={s.rowActions}>
        {actionSet === "delete" ? (
          <button
            style={s.dontPursueBtn}
            onClick={() => void onDelete()}
            disabled={busy}
          >
            Delete
          </button>
        ) : (
          <>
            <button
              style={s.secondaryBtn}
              onClick={() => setDialog("archive")}
              disabled={busy}
            >
              Archive
            </button>
            <button
              style={s.dontPursueBtn}
              onClick={() => setDialog("dont-pursue")}
              disabled={busy}
            >
              Don't pursue
            </button>
            <button
              style={s.actionBtn}
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

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <select
          style={s.select}
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as IntakeCaptureChannel | "")}
        >
          <option value="">All channels</option>
          {CAPTURE_CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {accountIdFilter && (
          <span style={{ ...s.badge, background: "#e0e7ff", color: "#3730a3" }}>
            Filtered by account
          </span>
        )}
        {unfilterableAnchor && (
          <span style={{ ...s.badge, background: CHANNEL_COLOUR.referral.bg, color: CHANNEL_COLOUR.referral.fg }}>
            {unfilterableAnchor.label} — the Inbox can only be filtered by account
          </span>
        )}
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {total} lead{total === 1 ? "" : "s"}
        </span>
      </div>

      {/* Capture form */}
      <CaptureLeadForm
        anchorFilter={props.anchorFilter}
        onCreated={() => void loadLeads(1)}
      />

      {/* List */}
      <div style={s.card}>
        {/* CRM_CHROME_V1 — the mock-up's header. The "oldest first" half is a
            promise the page keeps via sortLeadsOldestFirst, within the page. */}
        <div style={s.cardTitle}>
          Untriaged · oldest first
          <span style={{ fontWeight: 400, color: s.empty.color, marginLeft: 8 }}>
            page {page} of {totalPages}
          </span>
        </div>

        {loadError && (
          <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{loadError}</div>
        )}

        {loading
          ? <div style={s.empty}>Loading…</div>
          : orderedLeads.length === 0
            ? <div style={s.empty}>No open leads.</div>
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
              style={s.secondaryBtn}
              disabled={page <= 1 || loading}
              onClick={() => void loadLeads(page - 1)}
            >
              Previous
            </button>
            <button
              style={s.secondaryBtn}
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
