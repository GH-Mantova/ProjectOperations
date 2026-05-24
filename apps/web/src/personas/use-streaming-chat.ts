import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  appendAssistantMessage,
  appendClarificationProposalsMessage,
  appendEstimateProposalsMessage,
  appendProposalsMessage,
  appendQuoteProposalsMessage,
  appendUserMessage,
  buildRetryHistory,
  readSSEStream,
  toApiMessages,
  updateClarificationProposalsMessage,
  updateEstimateProposalsMessage,
  updateProposalsMessage,
  updateQuoteProposalsMessage,
  type ChatClarificationProposal,
  type ChatEstimateProposal,
  type ChatMessage,
  type ChatProposal,
  type ChatQuoteProposal,
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
          messages: Array<{
            id: string;
            role: string;
            content: string;
            metadata?: { toolUseId?: string; proposals?: ChatProposal[] } | null;
          }>;
        };
        if (cancelled) return;
        setMessages(rebuildMessagesFromHistory(detail.messages));
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
            // Filter to text messages only — proposals rows aren't sent
            // to the provider in this round (server already has them via
            // the conversation row).
            messages: toApiMessages(history),
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
          } else if (chunk.type === "proposals") {
            // §5A.1 PR 11: tool_result row arrived. Insert it into the
            // visible message history so ProposalCardList renders inline.
            // Flush any in-flight assistant text first so it lands above
            // the cards in chronological order.
            if (accumulated.length > 0) {
              setMessages((prev) => appendAssistantMessage(prev, accumulated));
              accumulated = "";
              setCurrentResponse("");
            }
            const event = chunk;
            setMessages((prev) =>
              appendProposalsMessage(prev, event.messageId, event.proposals)
            );
          } else if (chunk.type === "estimate_proposals") {
            // §5A.1 PR D — estimate-item proposal tool_result row. Same
            // flush-assistant-text-first pattern as scope proposals, but
            // routed to the dedicated EstimateProposalCardList via the
            // "estimate-proposals" message role.
            if (accumulated.length > 0) {
              setMessages((prev) => appendAssistantMessage(prev, accumulated));
              accumulated = "";
              setCurrentResponse("");
            }
            const event = chunk;
            setMessages((prev) =>
              appendEstimateProposalsMessage(prev, event.messageId, event.proposals)
            );
          } else if (chunk.type === "quote_proposals") {
            // §5A.1 PR E — quote-content proposal tool_result row. Same
            // pattern as scope + estimate proposals, routed to
            // QuoteProposalCardList via the "quote-proposals" role.
            if (accumulated.length > 0) {
              setMessages((prev) => appendAssistantMessage(prev, accumulated));
              accumulated = "";
              setCurrentResponse("");
            }
            const event = chunk;
            setMessages((prev) =>
              appendQuoteProposalsMessage(prev, event.messageId, event.proposals)
            );
          } else if (chunk.type === "clarification_proposals") {
            // §5A.1 PR F — clarification-content proposal tool_result row.
            // Routed to ClarificationProposalCardList via the
            // "clarification-proposals" role.
            if (accumulated.length > 0) {
              setMessages((prev) => appendAssistantMessage(prev, accumulated));
              accumulated = "";
              setCurrentResponse("");
            }
            const event = chunk;
            setMessages((prev) =>
              appendClarificationProposalsMessage(prev, event.messageId, event.proposals)
            );
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
        messages: Array<{
          id: string;
          role: string;
          content: string;
          metadata?: { toolUseId?: string; proposals?: ChatProposal[] } | null;
        }>;
      };
      setMessages(rebuildMessagesFromHistory(detail.messages));
      setConversationId(detail.conversation.id);
      setCurrentResponse("");
      setStatus("idle");
      setError(null);
    },
    [authFetch, personaSlug]
  );

  // §5A.1 PR 11 — proposal accept/reject helpers wired to the backend.
  // After server success, mutate the local proposals array so the card
  // re-renders without a round-trip refresh.
  const acceptProposal = useCallback(
    async (
      messageId: string,
      proposalIndex: number,
      edits?: Partial<ChatProposal>
    ): Promise<{ ok: boolean; scopeItemId?: string; error?: string }> => {
      const res = await authFetch(
        `/personas/tendering/proposals/${messageId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex, ...(edits ?? {}) })
        }
      );
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const text = await res.text();
          if (text) detail = text;
        } catch {
          // ignore
        }
        return { ok: false, error: detail };
      }
      const body = (await res.json()) as { ok: boolean; scopeItemId?: string };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.index === proposalIndex
              ? {
                  ...p,
                  ...(edits ?? {}),
                  status: "accepted",
                  acceptedScopeItemId: body.scopeItemId,
                  decidedAt
                }
              : p
          )
        )
      );
      return { ok: true, scopeItemId: body.scopeItemId };
    },
    [authFetch]
  );

  const rejectProposal = useCallback(
    async (messageId: string, proposalIndex: number): Promise<boolean> => {
      const res = await authFetch(
        `/personas/tendering/proposals/${messageId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex })
        }
      );
      if (!res.ok) return false;
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.index === proposalIndex ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return true;
    },
    [authFetch]
  );

  const acceptAllPending = useCallback(
    async (messageId: string): Promise<{ accepted: number; failed: number }> => {
      const res = await authFetch(
        `/personas/tendering/proposals/${messageId}/accept-all`,
        { method: "POST" }
      );
      if (!res.ok) return { accepted: 0, failed: 0 };
      const body = (await res.json()) as { accepted: number; failed: number };
      // Reload the conversation to refresh canonical proposal status —
      // simpler than reconstructing the partial-success state client-side.
      if (conversationIdRef.current) {
        await loadConversation(conversationIdRef.current);
      }
      return { accepted: body.accepted, failed: body.failed };
    },
    [authFetch, loadConversation]
  );

  const rejectAllPending = useCallback(
    async (messageId: string): Promise<number> => {
      const res = await authFetch(
        `/personas/tendering/proposals/${messageId}/reject-all`,
        { method: "POST" }
      );
      if (!res.ok) return 0;
      const body = (await res.json()) as { rejected: number };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.status === "pending" ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return body.rejected;
    },
    [authFetch]
  );

  // §5A.1 PR D — estimate-proposal accept/reject helpers wired to the
  // /personas/tendering/estimate-proposals/* endpoints. Parallel to the
  // scope-proposal helpers above; they update an "estimate-proposals"
  // message in the local history rather than a "proposals" one.
  const acceptEstimateProposal = useCallback(
    async (
      messageId: string,
      proposalIndex: number,
      edits?: Partial<ChatEstimateProposal>
    ): Promise<{ ok: boolean; estimateItemId?: string; error?: string }> => {
      const res = await authFetch(
        `/personas/tendering/estimate-proposals/${messageId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex, ...(edits ?? {}) })
        }
      );
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const text = await res.text();
          if (text) detail = text;
        } catch {
          // ignore
        }
        return { ok: false, error: detail };
      }
      const body = (await res.json()) as { ok: boolean; estimateItemId?: string };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateEstimateProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.index === proposalIndex
              ? {
                  ...p,
                  ...(edits ?? {}),
                  status: "accepted",
                  acceptedEstimateItemId: body.estimateItemId,
                  decidedAt
                }
              : p
          )
        )
      );
      return { ok: true, estimateItemId: body.estimateItemId };
    },
    [authFetch]
  );

  const rejectEstimateProposal = useCallback(
    async (messageId: string, proposalIndex: number): Promise<boolean> => {
      const res = await authFetch(
        `/personas/tendering/estimate-proposals/${messageId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex })
        }
      );
      if (!res.ok) return false;
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateEstimateProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.index === proposalIndex ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return true;
    },
    [authFetch]
  );

  const acceptAllPendingEstimateProposals = useCallback(
    async (messageId: string): Promise<{ accepted: number; failed: number }> => {
      const res = await authFetch(
        `/personas/tendering/estimate-proposals/${messageId}/accept-all`,
        { method: "POST" }
      );
      if (!res.ok) return { accepted: 0, failed: 0 };
      const body = (await res.json()) as { accepted: number; failed: number };
      if (conversationIdRef.current) {
        await loadConversation(conversationIdRef.current);
      }
      return { accepted: body.accepted, failed: body.failed };
    },
    [authFetch, loadConversation]
  );

  const rejectAllPendingEstimateProposals = useCallback(
    async (messageId: string): Promise<number> => {
      const res = await authFetch(
        `/personas/tendering/estimate-proposals/${messageId}/reject-all`,
        { method: "POST" }
      );
      if (!res.ok) return 0;
      const body = (await res.json()) as { rejected: number };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateEstimateProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.status === "pending" ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return body.rejected;
    },
    [authFetch]
  );

  // §5A.1 PR E — quote-proposal accept/reject helpers wired to the
  // /personas/tendering/quote-proposals/* endpoints. Parallel to the
  // estimate-proposal helpers above.
  const acceptQuoteProposal = useCallback(
    async (
      messageId: string,
      proposalIndex: number,
      edits?: Partial<ChatQuoteProposal>
    ): Promise<{
      ok: boolean;
      acceptedCostLineIds?: string[];
      acceptedExclusionIds?: string[];
      acceptedAssumptionIds?: string[];
      error?: string;
    }> => {
      const res = await authFetch(
        `/personas/tendering/quote-proposals/${messageId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex, ...(edits ?? {}) })
        }
      );
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const text = await res.text();
          if (text) detail = text;
        } catch {
          // ignore
        }
        return { ok: false, error: detail };
      }
      const body = (await res.json()) as {
        ok: boolean;
        acceptedCostLineIds?: string[];
        acceptedExclusionIds?: string[];
        acceptedAssumptionIds?: string[];
      };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateQuoteProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.index === proposalIndex
              ? {
                  ...p,
                  ...(edits ?? {}),
                  status: "accepted",
                  acceptedCostLineIds: body.acceptedCostLineIds,
                  acceptedExclusionIds: body.acceptedExclusionIds,
                  acceptedAssumptionIds: body.acceptedAssumptionIds,
                  decidedAt
                }
              : p
          )
        )
      );
      return {
        ok: true,
        acceptedCostLineIds: body.acceptedCostLineIds,
        acceptedExclusionIds: body.acceptedExclusionIds,
        acceptedAssumptionIds: body.acceptedAssumptionIds
      };
    },
    [authFetch]
  );

  const rejectQuoteProposal = useCallback(
    async (messageId: string, proposalIndex: number): Promise<boolean> => {
      const res = await authFetch(
        `/personas/tendering/quote-proposals/${messageId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex })
        }
      );
      if (!res.ok) return false;
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateQuoteProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.index === proposalIndex ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return true;
    },
    [authFetch]
  );

  const acceptAllPendingQuoteProposals = useCallback(
    async (messageId: string): Promise<{ accepted: number; failed: number }> => {
      const res = await authFetch(
        `/personas/tendering/quote-proposals/${messageId}/accept-all`,
        { method: "POST" }
      );
      if (!res.ok) return { accepted: 0, failed: 0 };
      const body = (await res.json()) as { accepted: number; failed: number };
      if (conversationIdRef.current) {
        await loadConversation(conversationIdRef.current);
      }
      return { accepted: body.accepted, failed: body.failed };
    },
    [authFetch, loadConversation]
  );

  const rejectAllPendingQuoteProposals = useCallback(
    async (messageId: string): Promise<number> => {
      const res = await authFetch(
        `/personas/tendering/quote-proposals/${messageId}/reject-all`,
        { method: "POST" }
      );
      if (!res.ok) return 0;
      const body = (await res.json()) as { rejected: number };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateQuoteProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.status === "pending" ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return body.rejected;
    },
    [authFetch]
  );

  // §5A.1 PR F — clarification-proposal accept/reject helpers wired to
  // /personas/tendering/clarification-proposals/*. Parallel to the
  // estimate/quote helpers above.
  const acceptClarificationProposal = useCallback(
    async (
      messageId: string,
      proposalIndex: number,
      edits?: Partial<ChatClarificationProposal["proposal"]>
    ): Promise<{
      ok: boolean;
      acceptedRecord?: ChatClarificationProposal["acceptedRecord"];
      error?: string;
    }> => {
      const res = await authFetch(
        `/personas/tendering/clarification-proposals/${messageId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex, ...(edits ?? {}) })
        }
      );
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const text = await res.text();
          if (text) detail = text;
        } catch {
          // ignore
        }
        return { ok: false, error: detail };
      }
      const body = (await res.json()) as {
        ok: boolean;
        acceptedRecord?: ChatClarificationProposal["acceptedRecord"];
      };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateClarificationProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) => {
            if (p.index !== proposalIndex) return p;
            const mergedProposal = {
              ...p.proposal,
              ...(edits ?? {})
            } as typeof p.proposal;
            return {
              ...p,
              proposal: mergedProposal,
              status: "accepted",
              acceptedRecord: body.acceptedRecord,
              decidedAt
            };
          })
        )
      );
      return { ok: true, acceptedRecord: body.acceptedRecord };
    },
    [authFetch]
  );

  const rejectClarificationProposal = useCallback(
    async (messageId: string, proposalIndex: number): Promise<boolean> => {
      const res = await authFetch(
        `/personas/tendering/clarification-proposals/${messageId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalIndex })
        }
      );
      if (!res.ok) return false;
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateClarificationProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.index === proposalIndex ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return true;
    },
    [authFetch]
  );

  const acceptAllPendingClarificationProposals = useCallback(
    async (messageId: string): Promise<{ accepted: number; failed: number }> => {
      const res = await authFetch(
        `/personas/tendering/clarification-proposals/${messageId}/accept-all`,
        { method: "POST" }
      );
      if (!res.ok) return { accepted: 0, failed: 0 };
      const body = (await res.json()) as { accepted: number; failed: number };
      if (conversationIdRef.current) {
        await loadConversation(conversationIdRef.current);
      }
      return { accepted: body.accepted, failed: body.failed };
    },
    [authFetch, loadConversation]
  );

  const rejectAllPendingClarificationProposals = useCallback(
    async (messageId: string): Promise<number> => {
      const res = await authFetch(
        `/personas/tendering/clarification-proposals/${messageId}/reject-all`,
        { method: "POST" }
      );
      if (!res.ok) return 0;
      const body = (await res.json()) as { rejected: number };
      const decidedAt = new Date().toISOString();
      setMessages((prev) =>
        updateClarificationProposalsMessage(prev, messageId, (proposals) =>
          proposals.map((p) =>
            p.status === "pending" ? { ...p, status: "rejected", decidedAt } : p
          )
        )
      );
      return body.rejected;
    },
    [authFetch]
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
    deleteConversation,
    acceptProposal,
    rejectProposal,
    acceptAllPending,
    rejectAllPending,
    acceptEstimateProposal,
    rejectEstimateProposal,
    acceptAllPendingEstimateProposals,
    rejectAllPendingEstimateProposals,
    acceptQuoteProposal,
    rejectQuoteProposal,
    acceptAllPendingQuoteProposals,
    rejectAllPendingQuoteProposals,
    acceptClarificationProposal,
    rejectClarificationProposal,
    acceptAllPendingClarificationProposals,
    rejectAllPendingClarificationProposals
  };
}

// §5A.1 PR 11 — server returns ALL conversation rows including tool_call,
// tool_result, and assistant text. Client renders only the user/assistant
// text and the tool_result-as-proposals; tool_call rows are filtered out
// (no UI surface for them). Out-of-order or malformed metadata falls back
// to skip rather than crash.
// §5A.1 PR D extends the dispatch: estimate-proposal tool_result rows
// carry a `toolName: "propose_estimate_items"` discriminator that
// scope-proposal rows lack — branch on that to build the right shape.
export function rebuildMessagesFromHistory(
  rows: Array<{
    id: string;
    role: string;
    content: string;
    metadata?:
      | {
          toolUseId?: string;
          toolName?: string;
          proposals?:
            | ChatProposal[]
            | ChatEstimateProposal[]
            | ChatQuoteProposal[]
            | ChatClarificationProposal[];
        }
      | null;
  }>
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const row of rows) {
    if (row.role === "user" || row.role === "assistant") {
      out.push({ role: row.role, content: row.content });
    } else if (row.role === "tool_result" && Array.isArray(row.metadata?.proposals)) {
      if (row.metadata?.toolName === "propose_estimate_items") {
        out.push({
          role: "estimate-proposals",
          messageId: row.id,
          proposals: row.metadata!.proposals as ChatEstimateProposal[]
        });
      } else if (row.metadata?.toolName === "propose_quote_content") {
        out.push({
          role: "quote-proposals",
          messageId: row.id,
          proposals: row.metadata!.proposals as ChatQuoteProposal[]
        });
      } else if (row.metadata?.toolName === "propose_clarifications") {
        out.push({
          role: "clarification-proposals",
          messageId: row.id,
          proposals: row.metadata!.proposals as ChatClarificationProposal[]
        });
      } else {
        out.push({
          role: "proposals",
          messageId: row.id,
          proposals: row.metadata!.proposals as ChatProposal[]
        });
      }
    }
    // tool_call rows: dropped intentionally — no client-side UI.
  }
  return out;
}
