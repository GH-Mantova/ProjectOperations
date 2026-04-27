import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { DraftBanner, SaveDraftButton, useFormDraft } from "../../drafts";

// Unified "Clarifications & Communications" section.
// Merges two data sources into one chronological list:
//   • TenderClarification (RFI / Q&A register) — passed in as `rfiItems`
//   • TenderClarificationNote (sent/received comms log) — fetched here
// Each entry has its own delete + edit actions. RFI items are edited via
// the activities PATCH endpoint; notes via the clarification-notes PATCH.

type RfiItem = {
  id: string;
  subject: string;
  response?: string | null;
  status: string;
  createdAt: string;
  dueDate?: string | null;
};

type NoteType = "call" | "email" | "meeting" | "note" | "response";

type NoteItem = {
  id: string;
  direction: "sent" | "received";
  noteType?: string;
  text: string;
  occurredAt: string;
  createdBy: { id: string; firstName: string; lastName: string } | null;
};

type UnifiedEntry =
  | {
      kind: "rfi";
      id: string;
      timestamp: string;
      badge: "RFI";
      status: string;
      dueDate: string | null;
      subject: string;
      response: string | null;
    }
  | {
      kind: "note";
      id: string;
      timestamp: string;
      badge: "Call" | "Email" | "Meeting" | "Note" | "Response";
      noteType: NoteType;
      direction: "sent" | "received";
      text: string;
      createdBy: { firstName: string; lastName: string } | null;
    };

const NOTE_TYPE_OPTIONS: Array<{ value: NoteType; label: string }> = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "response", label: "Response" }
];

// PR B FIX 4 — colour palette matched to project_instructions §13 spec.
const BADGE_PALETTE: Record<UnifiedEntry["badge"], string> = {
  RFI: "#005B61",       // IS teal (brand primary)
  Call: "#3498DB",      // blue
  Email: "#8E44AD",     // purple
  Meeting: "#F39C12",   // amber
  Note: "#95A5A6",      // grey
  Response: "#27AE60"   // green
};

type NoteBadge = "Call" | "Email" | "Meeting" | "Note" | "Response";

function noteTypeToBadge(t: string | undefined): NoteBadge {
  switch ((t ?? "note").toLowerCase()) {
    case "call": return "Call";
    case "email": return "Email";
    case "meeting": return "Meeting";
    case "response": return "Response";
    default: return "Note";
  }
}

function formatDate(iso: string): string {
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

export function TenderClarificationLog({
  tenderId,
  canManage,
  rfiItems,
  onRfiChanged
}: {
  tenderId: string;
  canManage: boolean;
  rfiItems: RfiItem[];
  onRfiChanged: () => void;
}) {
  const { authFetch, user } = useAuth();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [entryKind, setEntryKind] = useState<"rfi" | "note">("note");
  const [direction, setDirection] = useState<"sent" | "received">("received");
  const [noteType, setNoteType] = useState<NoteType>("note");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [posting, setPosting] = useState(false);

  // PR #111 — one draft per (user, tender) covering whichever entry
  // kind the user is mid-flight on. The draft includes entryKind so
  // restore is faithful regardless of which radio they last chose.
  const draftFormType = "tender_clarification_entry_create";
  const draft = useFormDraft({
    formType: draftFormType,
    contextKey: tenderId,
    schemaVersion: 1,
    getValues: () => ({ entryKind, direction, noteType, subject, text, dueDate, occurredAt }),
    setValues: (d) => {
      const data = d as {
        entryKind: "rfi" | "note";
        direction: "sent" | "received";
        noteType: NoteType;
        subject: string;
        text: string;
        dueDate: string;
        occurredAt: string;
      };
      setEntryKind(data.entryKind);
      setDirection(data.direction);
      setNoteType(data.noteType);
      setSubject(data.subject);
      setText(data.text);
      setDueDate(data.dueDate);
      setOccurredAt(data.occurredAt);
      // Open the form so the user sees their restored values.
      setAdding(true);
    }
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/tenders/${tenderId}/clarification-notes`);
      if (!response.ok) throw new Error(await response.text());
      setNotes((await response.json()) as NoteItem[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const entries: UnifiedEntry[] = [
    ...rfiItems.map<UnifiedEntry>((r) => ({
      kind: "rfi",
      id: r.id,
      timestamp: r.createdAt,
      badge: "RFI",
      status: r.status,
      dueDate: r.dueDate ?? null,
      subject: r.subject,
      response: r.response ?? null
    })),
    ...notes.map<UnifiedEntry>((n) => {
      const badge = noteTypeToBadge(n.noteType);
      const nt: NoteType = badge.toLowerCase() as NoteType;
      return {
        kind: "note",
        id: n.id,
        timestamp: n.occurredAt,
        badge,
        noteType: nt,
        direction: n.direction,
        text: n.text,
        createdBy: n.createdBy
      };
    })
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const resetForm = () => {
    setEntryKind("note");
    setDirection("received");
    setNoteType("note");
    setSubject("");
    setText("");
    setDueDate("");
    setOccurredAt("");
    setAdding(false);
  };

  const submit = async () => {
    setPosting(true);
    setError(null);
    try {
      if (entryKind === "rfi") {
        if (!subject.trim()) throw new Error("Subject is required for RFIs.");
        const response = await authFetch(`/tenders/${tenderId}/clarifications`, {
          method: "POST",
          body: JSON.stringify({
            subject: subject.trim(),
            response: text.trim() || undefined,
            status: "OPEN",
            dueDate: dueDate || undefined
          })
        });
        if (!response.ok) throw new Error(await response.text());
        onRfiChanged();
      } else {
        if (!text.trim()) throw new Error("Text is required for communications.");
        const response = await authFetch(`/tenders/${tenderId}/clarification-notes`, {
          method: "POST",
          body: JSON.stringify({
            direction,
            noteType,
            text: text.trim(),
            date: occurredAt || undefined
          })
        });
        if (!response.ok) throw new Error(await response.text());
        await load();
      }
      await draft.discardDraft();
      resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const deleteEntry = async (entry: UnifiedEntry) => {
    if (!window.confirm("Delete this entry?")) return;
    const path =
      entry.kind === "rfi"
        ? `/tenders/${tenderId}/activities/${encodeURIComponent(`clarification:${entry.id}`)}`
        : `/tenders/${tenderId}/clarification-notes/${entry.id}`;
    const response = await authFetch(path, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    if (entry.kind === "rfi") onRfiChanged();
    else await load();
  };

  const badgeTone = (badge: UnifiedEntry["badge"]) => BADGE_PALETTE[badge];

  return (
    <section className="s7-card">
      <div
        className="tender-detail__section-head"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Clarifications &amp; Communications
        </h3>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => {
              if (adding) {
                resetForm();
              } else {
                setAdding(true);
              }
            }}
          >
            {adding ? "Cancel" : "+ Add entry"}
          </button>
        ) : null}
      </div>

      {!adding && draft.hasDraft ? (
        <DraftBanner
          userId={user?.id ?? null}
          formType={draftFormType}
          onRestore={async () => {
            await draft.restoreDraft();
          }}
          onDiscard={draft.discardDraft}
        />
      ) : null}

      {adding ? (
        <form
          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, display: "inline-flex", flexDirection: "column", gap: 2 }}>
              <span>Type</span>
              <select
                className="s7-select s7-input--sm"
                value={entryKind}
                onChange={(e) => setEntryKind(e.target.value as "rfi" | "note")}
              >
                <option value="note">Communication (sent/received)</option>
                <option value="rfi">RFI (Q&amp;A register)</option>
              </select>
            </label>
            {entryKind === "note" ? (
              <>
                <label style={{ fontSize: 12, display: "inline-flex", flexDirection: "column", gap: 2 }}>
                  <span>Type</span>
                  <select
                    className="s7-select s7-input--sm"
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as NoteType)}
                  >
                    {NOTE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                {/* PR B FIX 4 — Note is an internal log entry; it has no
                    direction. Response is always inbound (the client
                    answering an RFI). All other types keep the toggle. */}
                {noteType !== "note" && noteType !== "response" ? (
                  <label style={{ fontSize: 12, display: "inline-flex", flexDirection: "column", gap: 2 }}>
                    <span>Direction</span>
                    <select
                      className="s7-select s7-input--sm"
                      value={direction}
                      onChange={(e) => setDirection(e.target.value as "sent" | "received")}
                    >
                      <option value="received">Received from client</option>
                      <option value="sent">Sent by IS</option>
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}
            {entryKind === "rfi" ? (
              <label style={{ fontSize: 12, display: "inline-flex", flexDirection: "column", gap: 2 }}>
                <span>Due date (optional)</span>
                <input
                  type="date"
                  className="s7-input s7-input--sm"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            ) : (
              <label style={{ fontSize: 12, display: "inline-flex", flexDirection: "column", gap: 2 }}>
                <span>Date (optional)</span>
                <input
                  type="date"
                  className="s7-input s7-input--sm"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </label>
            )}
          </div>
          {entryKind === "rfi" ? (
            <>
              <input
                className="s7-input"
                placeholder="Question / subject…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <textarea
                className="s7-input"
                rows={3}
                placeholder="Initial response or notes (optional)…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </>
          ) : (
            <textarea
              className="s7-input"
              rows={4}
              placeholder="Message content…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <SaveDraftButton
              onSave={draft.saveDraft}
              lastSavedAt={draft.lastSavedAt}
              disabled={posting}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={resetForm}>
                Cancel
              </button>
              <button
                type="submit"
                className="s7-btn s7-btn--primary"
                disabled={posting || (entryKind === "rfi" ? !subject.trim() : !text.trim())}
              >
                {posting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {error ? (
        <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)", marginTop: 12 }}>Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          heading="No clarifications or communications yet"
          subtext="Log every RFI, email, call, or meeting here for a clean audit trail."
        />
      ) : (
        <ul
          style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 6 }}
        >
          {entries.map((entry) => (
            <ClarificationEntryRow
              key={`${entry.kind}-${entry.id}`}
              entry={entry}
              tenderId={tenderId}
              canManage={canManage}
              badgeTone={badgeTone(entry.badge)}
              onChanged={entry.kind === "rfi" ? onRfiChanged : load}
              onDelete={() => void deleteEntry(entry)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ClarificationEntryRow({
  entry,
  tenderId,
  canManage,
  badgeTone,
  onChanged,
  onDelete
}: {
  entry: UnifiedEntry;
  tenderId: string;
  canManage: boolean;
  badgeTone: string;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const { authFetch } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(
    entry.kind === "rfi" ? (entry.response ?? entry.subject) : entry.text
  );
  const [draftSubject, setDraftSubject] = useState(entry.kind === "rfi" ? entry.subject : "");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setSaveError(null);
    try {
      if (entry.kind === "rfi") {
        const response = await authFetch(
          `/tenders/${tenderId}/activities/${encodeURIComponent(`clarification:${entry.id}`)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: draftSubject.trim() || entry.subject,
              details: draftText.trim() || undefined
            })
          }
        );
        if (!response.ok) throw new Error(await response.text());
      } else {
        const response = await authFetch(
          `/tenders/${tenderId}/clarification-notes/${entry.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ text: draftText.trim() })
          }
        );
        if (!response.ok) throw new Error(await response.text());
      }
      setEditing(false);
      onChanged();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      style={{
        padding: 10,
        border: "1px solid var(--border, #e5e7eb)",
        borderLeft: `4px solid ${badgeTone}`,
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            background: badgeTone,
            color: "#fff",
            borderRadius: 999,
            textTransform: "uppercase",
            letterSpacing: 0.3
          }}
        >
          {entry.badge}
        </span>
        {entry.kind === "rfi" ? (
          <span
            className="s7-badge"
            style={{ fontSize: 11, padding: "2px 8px" }}
          >
            {entry.status}
          </span>
        ) : null}
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {formatDate(entry.timestamp)}
        </span>
        {entry.kind === "note" && entry.noteType !== "note" && entry.noteType !== "response" ? (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            · {entry.direction === "sent" ? "Sent" : "Received"}
          </span>
        ) : null}
        {entry.kind === "note" && entry.createdBy ? (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            · {entry.createdBy.firstName} {entry.createdBy.lastName}
          </span>
        ) : null}
        {entry.kind === "rfi" && entry.dueDate ? (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            · Due {formatDate(entry.dueDate)}
          </span>
        ) : null}
        {canManage && !editing ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => setEditing(true)}
              aria-label="Edit"
              title="Edit"
            >
              ✎
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={onDelete}
              aria-label="Delete"
              title="Delete"
            >
              ×
            </button>
          </span>
        ) : null}
      </div>

      {editing ? (
        <>
          {entry.kind === "rfi" ? (
            <input
              className="s7-input"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              placeholder="Subject"
              disabled={busy}
            />
          ) : null}
          <textarea
            autoFocus
            className="s7-input"
            rows={3}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            disabled={busy}
          />
          {saveError ? (
            <p style={{ color: "var(--status-danger)", fontSize: 12, margin: 0 }}>{saveError}</p>
          ) : null}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => {
                setEditing(false);
                setDraftText(entry.kind === "rfi" ? (entry.response ?? entry.subject) : entry.text);
                setDraftSubject(entry.kind === "rfi" ? entry.subject : "");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              onClick={() => void save()}
              disabled={busy}
            >
              Save
            </button>
          </div>
        </>
      ) : entry.kind === "rfi" ? (
        <>
          <strong>{entry.subject}</strong>
          {entry.response ? (
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{entry.response}</p>
          ) : (
            <p style={{ color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>
              Awaiting response.
            </p>
          )}
        </>
      ) : (
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{entry.text}</p>
      )}
    </li>
  );
}
