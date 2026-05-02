import { useCallback, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  appendAssistantMessage,
  appendUserMessage,
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
  const lastUserMessageRef = useRef<{ content: string; options: SendOptions } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setCurrentResponse("");
    setStatus("idle");
    setError(null);
    lastUserMessageRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (content: string, options: SendOptions = {}) => {
      if (!personaSlug) return;
      const trimmed = content.trim();
      if (trimmed.length === 0) return;

      // Capture history BEFORE adding the user message so we can post the
      // exact conversation that produced this turn (immutable view).
      let nextHistory: ChatMessage[] = [];
      setMessages((prev) => {
        nextHistory = appendUserMessage(prev, trimmed);
        return nextHistory;
      });
      lastUserMessageRef.current = { content: trimmed, options };
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
            messages: nextHistory,
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
        // answer alongside the error rather than losing it.
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

  const retry = useCallback(() => {
    const last = lastUserMessageRef.current;
    if (!last) return;
    // Trim the previous user message off the history; sendMessage will re-append.
    setMessages((prev) => {
      const lastUserIndex = [...prev].reverse().findIndex((m) => m.role === "user");
      if (lastUserIndex === -1) return prev;
      const cutAt = prev.length - 1 - lastUserIndex;
      return prev.slice(0, cutAt);
    });
    void sendMessage(last.content, last.options);
  }, [sendMessage]);

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
