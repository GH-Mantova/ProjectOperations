import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type OwnerKind = "client" | "tender" | "job";

type MessageRow = {
  id: string;
  direction: "outbound" | "inbound";
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  sentBy: { id: string; firstName: string; lastName: string } | null;
};

type ThreadRow = {
  id: string;
  subject: string;
  referenceKey: string;
  participants: string[];
  lastMessageAt: string;
  createdAt: string;
  messages: MessageRow[];
};

type Props = {
  ownerKind: OwnerKind;
  ownerId: string;
  /** Hide the panel until a record has been saved. */
  enabled?: boolean;
};

const dateFmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "");

export function CorrespondencePanel({ ownerKind, ownerId, enabled = true }: Props) {
  const { authFetch } = useAuth();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !ownerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/correspondence/${ownerKind}/${ownerId}`);
      if (!res.ok) throw new Error(await res.text());
      setThreads((await res.json()) as ThreadRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, ownerKind, ownerId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetCompose = () => {
    setTo("");
    setCc("");
    setSubject("");
    setBodyText("");
    setReplyThreadId(null);
    setComposeOpen(false);
  };

  const startReply = (thread: ThreadRow) => {
    setReplyThreadId(thread.id);
    setSubject(`Re: ${thread.subject}`);
    setTo(thread.participants.join(", "));
    setComposeOpen(true);
  };

  const send = async () => {
    setPosting(true);
    setError(null);
    try {
      const toList = to.split(",").map((s) => s.trim()).filter(Boolean);
      const ccList = cc.split(",").map((s) => s.trim()).filter(Boolean);
      if (toList.length === 0) throw new Error("At least one recipient required.");
      if (!subject.trim()) throw new Error("Subject required.");
      if (!bodyText.trim()) throw new Error("Message body required.");
      const res = await authFetch(`/correspondence/${ownerKind}/${ownerId}`, {
        method: "POST",
        body: JSON.stringify({
          to: toList,
          cc: ccList.length ? ccList : undefined,
          subject: subject.trim(),
          bodyText,
          threadId: replyThreadId ?? undefined
        })
      });
      if (!res.ok) throw new Error(await res.text());
      resetCompose();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  if (!enabled) {
    return (
      <section aria-label="Correspondence">
        <h3>Correspondence</h3>
        <p style={{ color: "var(--text-secondary)" }}>Save this record to start an email thread.</p>
      </section>
    );
  }

  return (
    <section aria-label="Correspondence" data-testid="correspondence-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Correspondence</h3>
        <button
          type="button"
          onClick={() => {
            setReplyThreadId(null);
            setSubject("");
            setTo("");
            setCc("");
            setBodyText("");
            setComposeOpen(true);
          }}
          data-testid="correspondence-new"
        >
          New message
        </button>
      </div>

      {error ? <p role="alert" style={{ color: "var(--status-error, #b00020)" }}>{error}</p> : null}
      {loading ? <p>Loading…</p> : null}
      {!loading && threads.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No correspondence yet.</p>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
        {threads.map((thread) => (
          <li
            key={thread.id}
            style={{ border: "1px solid var(--surface-border, #e5e5e5)", borderRadius: 8, padding: 12, marginBottom: 12 }}
            data-testid="correspondence-thread"
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong>{thread.subject}</strong>
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{dateFmt(thread.lastMessageAt)}</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {thread.messages.map((m) => (
                <li
                  key={m.id}
                  style={{
                    padding: 8,
                    borderLeft: `3px solid ${m.direction === "outbound" ? "var(--brand-primary, #3b82f6)" : "var(--status-info, #10b981)"}`,
                    marginBottom: 6
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {m.direction === "outbound" ? "Sent" : "Received"} ·{" "}
                    {m.direction === "outbound" ? m.toAddresses.join(", ") : m.fromAddress} ·{" "}
                    {dateFmt(m.sentAt ?? m.receivedAt ?? m.createdAt)}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{m.bodyText}</div>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => startReply(thread)} data-testid="correspondence-reply">
              Reply
            </button>
          </li>
        ))}
      </ul>

      {composeOpen ? (
        <div
          style={{ marginTop: 12, padding: 12, border: "1px solid var(--surface-border, #e5e5e5)", borderRadius: 8 }}
          data-testid="correspondence-compose"
        >
          <h4 style={{ marginTop: 0 }}>{replyThreadId ? "Reply" : "New message"}</h4>
          <label style={{ display: "block", marginBottom: 6 }}>
            To
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="comma-separated"
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 6 }}>
            Cc
            <input value={cc} onChange={(e) => setCc(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 6 }}>
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 6 }}>
            Message
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={6}
              style={{ display: "block", width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={send} disabled={posting} data-testid="correspondence-send">
              {posting ? "Sending…" : "Send"}
            </button>
            <button type="button" onClick={resetCompose} disabled={posting}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
