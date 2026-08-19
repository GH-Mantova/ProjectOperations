import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";

// CRM-4: Comms hub surface — internal threads + To-Do.
// Anchored to a CRM record via ?entityType=ACCOUNT|TENDER|JOB|CONTRACT&entityId=…
// The decoupled sub-module surfaces two tabs (threads + tasks) so it can
// later lift into its own product without a UI rewrite. Email integration
// is CRM-5 and lives out-of-scope for this slice.

type ActorLite = { id: string; firstName: string; lastName: string };

type Thread = {
  id: string;
  entityType: string;
  entityId: string;
  subject: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  createdBy: ActorLite | null;
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  author: ActorLite | null;
  mentions: string[] | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignee: ActorLite | null;
  createdBy: ActorLite | null;
};

type ThreadDetail = Thread & { messages: Message[]; tasks: Task[] };

const ENTITY_LABEL: Record<string, string> = {
  ACCOUNT: "Account",
  TENDER: "Tender",
  JOB: "Job",
  CONTRACT: "Contract"
};

const STATUS_LABEL: Record<Task["status"], string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
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

const s: Record<string, React.CSSProperties> = {
  page: { padding: "24px", maxWidth: 1080, margin: "0 auto", fontFamily: "sans-serif" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  card: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12, background: "#fff" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 },
  tabs: { display: "flex", gap: 4, marginBottom: 16 },
  tab: { padding: "6px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  input: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, width: "100%" },
  primaryBtn: { padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  secondaryBtn: { padding: "4px 10px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontSize: 12 },
  empty: { color: "#9ca3af", fontSize: 13, padding: "12px 0" },
  msgRow: { padding: "10px 0", borderBottom: "1px solid #f3f4f6" },
  msgHead: { display: "flex", gap: 8, alignItems: "center", marginBottom: 4 },
  msgAuthor: { fontSize: 13, fontWeight: 600, color: "#111827" },
  msgTime: { fontSize: 11, color: "#9ca3af" },
  taskRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }
};

const STATUS_COLOUR: Record<Task["status"], { bg: string; fg: string }> = {
  OPEN: { bg: "#dbeafe", fg: "#1e40af" },
  IN_PROGRESS: { bg: "#fef3c7", fg: "#92400e" },
  DONE: { bg: "#d1fae5", fg: "#065f46" },
  CANCELLED: { bg: "#f3f4f6", fg: "#6b7280" }
};

export function CommsHubPage() {
  const { authFetch } = useAuth();
  const [params] = useSearchParams();
  const entityType = params.get("entityType") ?? "ACCOUNT";
  const entityId = params.get("entityId") ?? "";

  const [tab, setTab] = useState<"threads" | "tasks">("threads");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");

  const anchored = useMemo(
    () => Boolean(entityType && entityId),
    [entityType, entityId]
  );

  const loadThreads = useCallback(async () => {
    if (!anchored) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ entityType, entityId });
      const res = await authFetch(`/crm/comms/threads?${qs.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Thread[] };
      setThreads(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load threads.");
    } finally {
      setLoading(false);
    }
  }, [anchored, authFetch, entityType, entityId]);

  const loadTasks = useCallback(async () => {
    if (!anchored) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ entityType, entityId });
      const res = await authFetch(`/crm/comms/tasks?${qs.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Task[] };
      setTasks(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [anchored, authFetch, entityType, entityId]);

  const openThread = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/crm/comms/threads/${id}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      setSelectedThread(await res.json() as ThreadDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load thread.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (tab === "threads") void loadThreads();
    else void loadTasks();
  }, [tab, loadThreads, loadTasks]);

  const createThread = useCallback(async () => {
    if (!anchored || !newSubject.trim()) return;
    const res = await authFetch(`/crm/comms/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, subject: newSubject.trim() })
    });
    if (res.ok) {
      setNewSubject("");
      await loadThreads();
    } else {
      setError(await readApiErrorMessage(res));
    }
  }, [anchored, authFetch, entityType, entityId, newSubject, loadThreads]);

  const postMessage = useCallback(async () => {
    if (!selectedThread || !newMessage.trim()) return;
    const res = await authFetch(`/crm/comms/threads/${selectedThread.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMessage.trim() })
    });
    if (res.ok) {
      setNewMessage("");
      await openThread(selectedThread.id);
    } else {
      setError(await readApiErrorMessage(res));
    }
  }, [authFetch, selectedThread, newMessage, openThread]);

  const createTask = useCallback(async () => {
    if (!anchored || !newTaskTitle.trim()) return;
    const res = await authFetch(`/crm/comms/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        entityId,
        title: newTaskTitle.trim(),
        dueAt: newTaskDue || null
      })
    });
    if (res.ok) {
      setNewTaskTitle("");
      setNewTaskDue("");
      await loadTasks();
    } else {
      setError(await readApiErrorMessage(res));
    }
  }, [anchored, authFetch, entityType, entityId, newTaskTitle, newTaskDue, loadTasks]);

  const toggleTask = useCallback(async (task: Task) => {
    const nextStatus = task.status === "DONE" ? "OPEN" : "DONE";
    const res = await authFetch(`/crm/comms/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    if (res.ok) await loadTasks();
  }, [authFetch, loadTasks]);

  if (!anchored) {
    return (
      <div style={s.page}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Comms hub</h1>
        <div style={s.card}>
          <div style={s.empty}>
            Missing <code>entityType</code> and <code>entityId</code> query
            parameters. Open this page from a record page (Account / Tender /
            Job / Contract) that anchors the conversation.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Comms hub</h1>
        <span style={{ ...s.badge, background: "#e0e7ff", color: "#3730a3" }}>
          {ENTITY_LABEL[entityType] ?? entityType}
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{entityId}</span>
      </div>

      <div style={s.tabs}>
        {(["threads", "tasks"] as const).map((t) => (
          <button
            key={t}
            style={{
              ...s.tab,
              background: tab === t ? "#6366f1" : "#f3f4f6",
              color: tab === t ? "#fff" : "#374151",
              fontWeight: tab === t ? 700 : 400
            }}
            onClick={() => { setTab(t); setSelectedThread(null); }}
          >
            {t === "threads" ? "Threads" : "To-Do"}
          </button>
        ))}
      </div>

      {error && <div style={{ ...s.card, color: "#dc2626" }}>{error}</div>}

      {tab === "threads" && (
        <>
          <div style={s.card}>
            <div style={s.cardTitle}>New thread</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={s.input}
                placeholder="Subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <button style={s.primaryBtn} onClick={createThread} disabled={loading}>
                Start
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div style={s.card}>
              <div style={s.cardTitle}>Threads ({threads.length})</div>
              {threads.length === 0
                ? <div style={s.empty}>No threads yet.</div>
                : threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => void openThread(t.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 6px",
                        background: selectedThread?.id === t.id ? "#eef2ff" : "transparent",
                        border: "none",
                        borderBottom: "1px solid #f3f4f6",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {t.subject ?? "(no subject)"}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        Updated {fmtDate(t.updatedAt)}
                      </div>
                    </button>
                  ))}
            </div>

            <div style={s.card}>
              {!selectedThread
                ? <div style={s.empty}>Select a thread on the left.</div>
                : (
                  <>
                    <div style={s.cardTitle}>
                      {selectedThread.subject ?? "(no subject)"}
                    </div>
                    <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
                      {selectedThread.messages.length === 0
                        ? <div style={s.empty}>No messages yet.</div>
                        : selectedThread.messages.map((m) => (
                            <div key={m.id} style={s.msgRow}>
                              <div style={s.msgHead}>
                                <span style={s.msgAuthor}>
                                  {m.author
                                    ? `${m.author.firstName} ${m.author.lastName}`
                                    : "Unknown"}
                                </span>
                                <span style={s.msgTime}>{fmtDate(m.createdAt)}</span>
                              </div>
                              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                                {m.body}
                              </div>
                            </div>
                          ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        style={s.input}
                        placeholder="Write a message… use @name to mention"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void postMessage(); }}
                      />
                      <button style={s.primaryBtn} onClick={postMessage}>Post</button>
                    </div>
                  </>
                )
              }
            </div>
          </div>
        </>
      )}

      {tab === "tasks" && (
        <>
          <div style={s.card}>
            <div style={s.cardTitle}>New task</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...s.input, flex: 2 }}
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <input
                style={{ ...s.input, flex: 1 }}
                type="date"
                value={newTaskDue}
                onChange={(e) => setNewTaskDue(e.target.value)}
              />
              <button style={s.primaryBtn} onClick={createTask}>Add</button>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Tasks ({tasks.length})</div>
            {tasks.length === 0
              ? <div style={s.empty}>No tasks yet.</div>
              : tasks.map((t) => (
                  <div key={t.id} style={s.taskRow}>
                    <input
                      type="checkbox"
                      checked={t.status === "DONE"}
                      onChange={() => void toggleTask(t)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: t.status === "DONE" ? "line-through" : "none",
                        color: t.status === "DONE" ? "#9ca3af" : "#111827"
                      }}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{t.description}</div>
                      )}
                    </div>
                    <span style={{
                      ...s.badge,
                      background: STATUS_COLOUR[t.status].bg,
                      color: STATUS_COLOUR[t.status].fg
                    }}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span style={{ fontSize: 11, color: "#6b7280", minWidth: 90, textAlign: "right" }}>
                      {t.dueAt ? `Due ${fmtDate(t.dueAt)}` : "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "#6b7280", minWidth: 100 }}>
                      {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Unassigned"}
                    </span>
                  </div>
                ))}
          </div>
        </>
      )}
    </div>
  );
}
