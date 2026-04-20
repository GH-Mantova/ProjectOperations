import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type NoteType = "note" | "call" | "email" | "meeting" | "site_visit";

type ClientNote = {
  id: string;
  noteType: NoteType;
  subject: string | null;
  body: string;
  occurredAt: string;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
};

const NOTE_TYPE_ICON: Record<NoteType, string> = {
  note: "📝",
  call: "📞",
  email: "✉",
  meeting: "📅",
  site_visit: "🏗"
};

const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  site_visit: "Site visit"
};

export function TenderClientNotesSection({
  tenderId,
  clientId,
  canManage
}: {
  tenderId: string;
  clientId: string;
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<{
    noteType: NoteType;
    subject: string;
    body: string;
    occurredAt: string;
  }>(() => ({
    noteType: "note",
    subject: "",
    body: "",
    occurredAt: new Date().toISOString().slice(0, 16)
  }));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/clients/${clientId}/notes`);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as ClientNote[];
      setNotes(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, clientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!draft.body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/clients/${clientId}/notes`, {
        method: "POST",
        body: JSON.stringify({
          noteType: draft.noteType,
          subject: draft.subject.trim() || undefined,
          body: draft.body.trim(),
          occurredAt: new Date(draft.occurredAt).toISOString()
        })
      });
      if (!response.ok) throw new Error(await response.text());
      setDraft({
        noteType: "note",
        subject: "",
        body: "",
        occurredAt: new Date().toISOString().slice(0, 16)
      });
      setFormOpen(false);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      const response = await authFetch(`/tenders/${tenderId}/clients/${clientId}/notes/${noteId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await response.text());
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const visible = showAll ? notes : notes.slice(0, 5);

  return (
    <div className="tender-client-notes">
      {error ? (
        <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
      ) : notes.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No interactions logged yet.</p>
      ) : (
        <ul className="tender-client-notes__list">
          {visible.map((note) => (
            <li key={note.id} className="tender-client-notes__item">
              <span aria-hidden className="tender-client-notes__icon">
                {NOTE_TYPE_ICON[note.noteType] ?? "📝"}
              </span>
              <div className="tender-client-notes__body">
                <div className="tender-client-notes__head">
                  <strong>{note.subject ?? NOTE_TYPE_LABEL[note.noteType]}</strong>
                  <span className="tender-client-notes__date">
                    {new Date(note.occurredAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="tender-client-notes__text">{note.body}</p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="tender-client-notes__remove"
                  onClick={() => void remove(note.id)}
                  aria-label="Delete note"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
          {!showAll && notes.length > 5 ? (
            <li>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setShowAll(true)}
                style={{ fontSize: 12 }}
              >
                Show all {notes.length}
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {canManage ? (
        formOpen ? (
          <div className="tender-client-notes__form">
            <label>
              <span>Type</span>
              <select
                className="s7-input s7-input--sm"
                value={draft.noteType}
                onChange={(e) => setDraft((prev) => ({ ...prev, noteType: e.target.value as NoteType }))}
              >
                {(Object.keys(NOTE_TYPE_LABEL) as NoteType[]).map((t) => (
                  <option key={t} value={t}>{NOTE_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Subject (optional)</span>
              <input
                className="s7-input s7-input--sm"
                value={draft.subject}
                onChange={(e) => setDraft((prev) => ({ ...prev, subject: e.target.value }))}
              />
            </label>
            <label>
              <span>Body</span>
              <textarea
                className="s7-input"
                rows={3}
                value={draft.body}
                onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Summary of the interaction…"
              />
            </label>
            <label>
              <span>Occurred at</span>
              <input
                className="s7-input s7-input--sm"
                type="datetime-local"
                value={draft.occurredAt}
                onChange={(e) => setDraft((prev) => ({ ...prev, occurredAt: e.target.value }))}
              />
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={() => void save()}
                disabled={submitting || !draft.body.trim()}
              >
                {submitting ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            onClick={() => setFormOpen(true)}
            style={{ marginTop: 6 }}
          >
            + Log interaction
          </button>
        )
      ) : null}
    </div>
  );
}
