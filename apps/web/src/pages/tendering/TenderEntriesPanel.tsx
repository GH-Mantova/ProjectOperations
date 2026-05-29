import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

export type TenderEntryType =
  | "note"
  | "rfi"
  | "email"
  | "call"
  | "meeting"
  | "follow_up"
  | "self_reminder"
  | "task";

export type TenderEntryStatus = "open" | "done" | "cancelled";

export type TenderEntry = {
  id: string;
  tenderId: string;
  type: TenderEntryType;
  subject: string | null;
  body: string;
  dueDate: string | null;
  status: TenderEntryStatus;
  assigneeId: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; firstName: string; lastName: string } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
};

const TYPE_LABEL: Record<TenderEntryType, string> = {
  note: "Note",
  rfi: "RFI",
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  follow_up: "Follow-up",
  self_reminder: "Reminder",
  task: "Task"
};

const TYPE_PALETTE: Record<TenderEntryType, string> = {
  note: "#95A5A6",
  rfi: "#005B61",
  email: "#8E44AD",
  call: "#3498DB",
  meeting: "#F39C12",
  follow_up: "#27AE60",
  self_reminder: "#D35400",
  task: "#C0392B"
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function formatPerson(person: { firstName: string; lastName: string } | null): string {
  if (!person) return "";
  return `${person.firstName} ${person.lastName}`.trim();
}

export function TenderEntriesPanel({ tenderId }: { tenderId: string }) {
  const { authFetch } = useAuth();
  const [entries, setEntries] = useState<TenderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/entries`);
      if (!response.ok) throw new Error(await response.text());
      setEntries((await response.json()) as TenderEntry[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="s7-card" data-testid="tender-entries-panel">
      <div
        className="tender-detail__section-head"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Activity &amp; communications
        </h3>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          disabled
          title="Coming in Phase 6"
        >
          + Add entry
        </button>
      </div>

      {error ? (
        <p style={{ color: "#C0392B", marginTop: 12 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ marginTop: 12, color: "#6B7280" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          heading="No activity yet"
          subtext="Notes, RFIs, calls, meetings, follow-ups, and tasks will appear here once recorded."
        />
      ) : (
        <ul
          className="tender-entries"
          style={{
            listStyle: "none",
            padding: 0,
            margin: "12px 0 0",
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >
          {entries.map((entry) => {
            const palette = TYPE_PALETTE[entry.type];
            return (
              <li
                key={entry.id}
                className="tender-entries__item"
                data-testid="tender-entry-row"
                style={{
                  borderLeft: `4px solid ${palette}`,
                  background: "var(--surface-card, #fff)",
                  padding: "10px 12px",
                  borderRadius: 6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        background: palette,
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em"
                      }}
                    >
                      {TYPE_LABEL[entry.type]}
                    </span>
                    {entry.subject ? (
                      <strong style={{ fontSize: 14 }}>{entry.subject}</strong>
                    ) : null}
                  </div>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{entry.body}</p>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    fontSize: 12,
                    color: "#6B7280"
                  }}
                >
                  {entry.author ? <span>— {formatPerson(entry.author)}</span> : null}
                  {entry.assignee ? <span>→ {formatPerson(entry.assignee)}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
