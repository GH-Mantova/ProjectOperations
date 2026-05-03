import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  appendAssistantMessage,
  appendUserMessage,
  buildRetryHistory,
  readSSEStream,
  type ChatMessage,
  type ChatStatus
} from "./chat-helpers";

type SendOptions = {
  subMode?: string;
};

export type ConversationSummary = {
  id: string;
  personaSlug: string;
  subMode: string;
  contextKey: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string | null;
};

type Scope = {
  personaSlug: string | null;
  subMode: string | undefined;
  contextKey: string | null;
};

// §5A.1 PR 10 — extended with conversation persistence. The hook now:
//   - Loads the most recent conversation for (personaSlug, subMode,
//     contextKey) on scope change
//   - Tracks the current conversationId; the chat endpoint emits it as
//     the first SSE event so we know which thread an exchange landed in
//   - Exposes startNewConversation, loadConversation, deleteConversation,
//     listConversations for the History UI
//
// Failed/aborted streams do NOT pollute server-side history — the chat
// endpoint only saves the assistant message on stream success.
export function useStreamingChat(
  personaSlug: string | null,
  subMode: string | undefined,
  contextKey: string | null
) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const lastOptionsRef = useRef<SendOptions>({});
  const abortRef = useRef<AbortController | null>(null);
  // Mirror the latest messages so retry / send can build the request body
  // synchronously without relying on a setState updater having flushed.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  const scopeRef = useRef<Scope>({ personaSlug, subMode, contextKey });
  scopeRef.current = { personaSlug, subMode, contextKey };

  // Auto-resume: when scope changes, load the most recent conversation and
  // seed messages. If there is no recent conversation, start empty (the
  // first sendMessage will create one server-side).
  useEffect(() => {
    if (!personaSlug) {
      setMessages([]);
      setConversationId(null);
      setCurrentResponse("");
      setStatus("idle");
      setError(null);
      return;
    }
    let cancelled = false;
    abortRef.current?.abort();
    abortRef.current = null;

    const params = new URLSearchParams();
    if (subMode) params.set("subMode", subMode);
    if (contextKey) params.set("contextKey", contextKey);
    params.set("limit", "1");

    setStatus("idle");
    setError(null);
    setCurrentResponse("");

    void authFetch(`/personas/${personaSlug}/conversations?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const list = (await res.json()) as ConversationSummary[];
        return list[0] ?? null;
      })
      .then(async (recent) => {
        if (cancelled) return;
        if (!recent) {
          setMessages([]);
          setConversationId(null);
          return;
        }
        const detailRes = await authFetch(
          `/personas/${personaSlug}/conversations/${recent.id}`
        );
        if (!detailRes.ok) {
          setMessages([]);
          setConversationId(null);
          return;
        }
        const detail = (await detailRes.json()) as {
          conversation: { id: string };
          messages: Array<{ role: "user" | "assistant"; content: string }>;
        };
        if (cancelled) return;
        setMessages(detail.messages.map((m) => ({ role: m.role, content: m.content })));
        setConversationId(detail.conversation.id);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
        setConversationId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [authFetch, personaSlug, subMode, contextKey]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setCurrentResponse("");
    setStatus("idle");
    setError(null);
    setConversationId(null);
    lastOptionsRef.current = {};
  }, []);

  // Single source of truth for the chat API call. Both sendMessage and
  // retry call this with an explicit history.
  const sendChatRequest = useCallback(
    async (history: ChatMessage[], options: SendOptions) => {
      if (!personaSlug || history.length === 0) return;

      lastOptionsRef.current = options;
      setCurrentResponse("");
      setError(null);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = "";
      try {
        const res = await authFetch(`/personas/${personaSlug}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            subMode: options.subMode,
            contextKey: scopeRef.current.contextKey,
            conversationId: conversationIdRef.current
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          let detail = `${res.status}`;
          try {
            const text = await res.text();
            if (text) detail = `${res.status}: ${text.slice(0, 200)}`;
          } catch {
            // swallow — we'll surface the status
          }
          throw new Error(`Chat request failed (${detail})`);
        }

        for await (const chunk of readSSEStream(res)) {
          if (chunk.type === "conversation") {
            // Server resolved or created the conversation; track its id so
            // subsequent messages append to the same thread.
            setConversationId(chunk.conversationId);
            conversationIdRef.current = chunk.conversationId;
          } else if (chunk.type === "content") {
            accumulated += chunk.text;
            setCurrentResponse(accumulated);
          } else if (chunk.type === "error") {
            throw new Error(chunk.error);
          } else if (chunk.type === "done") {
            break;
          }
        }

        if (accumulated.length > 0) {
          setMessages((prev) => appendAssistantMessage(prev, accumulated));
        }
        setCurrentResponse("");
        setStatus("idle");
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") {
          return;
        }
        if (accumulated.length > 0) {
          setMessages((prev) => appendAssistantMessage(prev, accumulated));
          setCurrentResponse("");
        }
        setError((err as Error).message ?? "Chat failed");
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [authFetch, personaSlug]
  );

  const sendMessage = useCallback(
    async (content: string, options: SendOptions = {}) => {
      if (!personaSlug) return;
      const trimmed = content.trim();
      if (trimmed.length === 0) return;
      const history = appendUserMessage(messagesRef.current, trimmed);
      setMessages(history);
      await sendChatRequest(history, options);
    },
    [personaSlug, sendChatRequest]
  );

  const retry = useCallback(() => {
    const replay = buildRetryHistory(messagesRef.current);
    if (replay.length === 0) return;
    setMessages(replay);
    void sendChatRequest(replay, lastOptionsRef.current);
  }, [sendChatRequest]);

  // §5A.1 PR 10 — explicit "New conversation" button on the panel header.
  // Server creates a fresh row; client clears messages and tracks the new
  // id so the next send appends there. The previous conversation stays
  // intact and is reachable via the History UI.
  const startNewConversation = useCallback(async () => {
    if (!personaSlug || !subMode) return;
    abortRef.current?.abort();
    abortRef.current = null;
    try {
      const res = await authFetch(`/personas/${personaSlug}/conversations/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subMode, contextKey })
      });
      if (!res.ok) {
        setError(`Failed to start new conversation (${res.status})`);
        return;
      }
      const conv = (await res.json()) as { id: string };
      setMessages([]);
      setConversationId(conv.id);
      setCurrentResponse("");
      setStatus("idle");
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? "Failed to start new conversation");
    }
  }, [authFetch, personaSlug, subMode, contextKey]);

  // List recent conversations for the current scope. Used by the History
  // UI on the panel header.
  const listConversations = useCallback(
    async (limit = 20): Promise<ConversationSummary[]> => {
      if (!personaSlug) return [];
      const params = new URLSearchParams();
      if (subMode) params.set("subMode", subMode);
      if (contextKey) params.set("contextKey", contextKey);
      params.set("limit", String(limit));
      const res = await authFetch(
        `/personas/${personaSlug}/conversations?${params.toString()}`
      );
      if (!res.ok) return [];
      return (await res.json()) as ConversationSummary[];
    },
    [authFetch, personaSlug, subMode, contextKey]
  );

  // Load a specific conversation by id (e.g. user picked one from the
  // History list). Updates the active conversationId so subsequent sends
  // append there.
  const loadConversation = useCallback(
    async (id: string) => {
      if (!personaSlug) return;
      const res = await authFetch(`/personas/${personaSlug}/conversations/${id}`);
      if (!res.ok) {
        setError(`Failed to load conversation (${res.status})`);
        return;
      }
      const detail = (await res.json()) as {
        conversation: { id: string };
        messages: Array<{ role: "user" | "assistant"; content: string }>;
      };
      setMessages(detail.messages.map((m) => ({ role: m.role, content: m.content })));
      setConversationId(detail.conversation.id);
      setCurrentResponse("");
      setStatus("idle");
      setError(null);
    },
    [authFetch, personaSlug]
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      if (!personaSlug) return false;
      const res = await authFetch(`/personas/${personaSlug}/conversations/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) return false;
      // If the deleted conversation was the active one, clear local state.
      if (conversationIdRef.current === id) {
        setMessages([]);
        setConversationId(null);
      }
      return true;
    },
    [authFetch, personaSlug]
  );

  return {
    messages,
    currentResponse,
    status,
    error,
    conversationId,
    sendMessage,
    retry,
    reset,
    startNewConversation,
    listConversations,
    loadConversation,
    deleteConversation
  };
}
