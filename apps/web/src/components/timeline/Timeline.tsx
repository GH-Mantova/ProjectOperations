import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export type TimelineEntityType = "Job" | "Tender" | "Client" | "Contact";
export type TimelineKind =
  | "note"
  | "status"
  | "attachment"
  | "system"
  | "correspondence"
  | "progress";

type TimelineItem = {
  id: string;
  kind: TimelineKind;
  body: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string } | null;
  metadata?: Record<string, unknown>;
};

type Props = {
  entityType: TimelineEntityType;
  entityId: string;
  /** Hide the panel until a record has been saved. */
  enabled?: boolean;
};

const KIND_FILTERS: { key: "all" | TimelineKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "note", label: "Notes" },
  { key: "status", label: "Status" },
  { key: "attachment", label: "Files" },
  { key: "correspondence", label: "Mail" },
  { key: "progress", label: "Progress" },
  { key: "system", label: "System" }
];

const KIND_COLORS: Record<TimelineKind, string> = {
  note: "var(--brand-primary, #3b82f6)",
  status: "var(--status-warning, #f59e0b)",
  attachment: "var(--text-secondary, #6b7280)",
  system: "var(--text-secondary, #6b7280)",
  correspondence: "var(--status-info, #10b981)",
  progress: "var(--brand-secondary, #8b5cf6)"
};

const dateFmt = (iso: string) => new Date(iso).toLocaleString();
const authorName = (a: TimelineItem["author"]) =>
  a ? `${a.firstName} ${a.lastName}`.trim() : "System";

/**
 * D365-style Timeline control. Chronological, filterable stream of every
 * event on a record — notes, status changes, correspondence, attachments,
 * progress entries, system events. Drop-in on any detail page:
 *
 *   <Timeline entityType="Job" entityId={job.id} />
 */
export function Timeline({ entityType, entityId, enabled = true }: Props) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TimelineKind>("all");
  const [noteBody, setNoteBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !entityId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/timeline/${entityType}/${entityId}`);
      if (!res.ok) throw new Error(await res.text());
      const payload = (await res.json()) as { items: TimelineItem[] };
      setItems(payload.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, entityType, entityId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((it) => it.kind === filter)),
    [items, filter]
  );

  const addNote = async () => {
    const trimmed = noteBody.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      const res = await authFetch(`/timeline/${entityType}/${entityId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: trimmed })
      });
      if (!res.ok) throw new Error(await res.text());
      setNoteBody("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  if (!enabled) {
    return (
      <section aria-label="Timeline" data-testid="timeline-panel">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Timeline</h3>
        <p style={{ color: "var(--text-secondary)" }}>Save this record to start its timeline.</p>
      </section>
    );
  }

  return (
    <section aria-label="Timeline" data-testid="timeline-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Timeline</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="Timeline filters">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`timeline-filter-${f.key}`}
              className="s7-btn"
              style={{
                fontSize: 12,
                padding: "4px 10px",
                background: filter === f.key ? "var(--brand-primary, #3b82f6)" : "transparent",
                color: filter === f.key ? "white" : "inherit",
                border: "1px solid var(--surface-border, #e5e5e5)",
                borderRadius: 999,
                cursor: "pointer"
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 10,
          border: "1px solid var(--surface-border, #e5e5e5)",
          borderRadius: 8
        }}
        data-testid="timeline-note-composer"
      >
        <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
          Add a note
        </label>
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={2}
          className="s7-input"
          placeholder="Type a note and press Save…"
          style={{ display: "block", width: "100%", resize: "vertical" }}
          data-testid="timeline-note-input"
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={addNote}
            disabled={posting || noteBody.trim().length === 0}
            data-testid="timeline-note-save"
          >
            {posting ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ color: "var(--status-error, #b00020)", marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      {loading ? <p style={{ marginTop: 8 }}>Loading…</p> : null}
      {!loading && visible.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", marginTop: 12 }}>Nothing on the timeline yet.</p>
      ) : null}

      <ol style={{ listStyle: "none", padding: 0, marginTop: 12 }} data-testid="timeline-list">
        {visible.map((item) => (
          <li
            key={item.id}
            data-testid="timeline-item"
            data-kind={item.kind}
            style={{
              display: "flex",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid var(--surface-border, #eee)"
            }}
          >
            <div
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: KIND_COLORS[item.kind],
                marginTop: 6,
                flex: "0 0 auto"
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong style={{ textTransform: "capitalize" }}>{item.kind}</strong>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{dateFmt(item.createdAt)}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{item.body}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {authorName(item.author)}
                {item.kind === "status" && item.metadata ? (
                  <>
                    {" · "}
                    {(item.metadata.fromStatus as string | undefined) ?? "—"} →{" "}
                    {String(item.metadata.toStatus ?? "")}
                  </>
                ) : null}
                {item.kind === "correspondence" && item.metadata ? (
                  <>
                    {" · "}
                    {String(item.metadata.direction ?? "")}
                  </>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
