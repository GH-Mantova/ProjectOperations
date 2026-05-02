import { useCallback, useRef, useState } from "react";
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

export function useStreamingChat(personaSlug: string | null) {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastOptionsRef = useRef<SendOptions>({});
  const abortRef = useRef<AbortController | null>(null);
  // Mirror the latest messages so retry / send can build the request body
  // synchronously without relying on a setState updater having flushed.
  // The updater-closure pattern was the bug fixed in this PR — see
  // https://github.com/GH-Mantova/ProjectOperations/pull/<this-pr> for why.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setCurrentResponse("");
    setStatus("idle");
    setError(null);
    lastOptionsRef.current = {};
  }, []);

  // Single source of truth for the actual API call. Both sendMessage and
  // retry call this with an explicit history, so the request body never
  // depends on a closure variable mutated inside a React state updater.
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
            subMode: options.subMode
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
          if (chunk.type === "content") {
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
          // Aborted by reset/navigation — nothing to surface.
          return;
        }
        // Persist whatever we managed to receive so the user sees the partial
        // answer alongside the error rather than losing it. Retry will
        // discard this partial via buildRetryHistory.
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
    // Drop any partial assistant response that was rendered before the error.
    setMessages(replay);
    void sendChatRequest(replay, lastOptionsRef.current);
  }, [sendChatRequest]);

  return {
    messages,
    currentResponse,
    status,
    error,
    sendMessage,
    retry,
    reset
  };
}
