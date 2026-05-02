import { useEffect, useRef } from "react";
import type { ChatMessage } from "./chat-helpers";

type Props = {
  messages: ChatMessage[];
  streamingResponse: string;
  isStreaming: boolean;
  emptyHint: string;
};

export function MessageList({ messages, streamingResponse, isStreaming, emptyHint }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Autoscroll to the bottom on every new message OR streaming chunk so the
  // freshest content stays in view. cheap to do unconditionally.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingResponse]);

  const isEmpty = messages.length === 0 && streamingResponse.length === 0 && !isStreaming;

  return (
    <div ref={scrollRef} className="persona-window__messages" role="log" aria-live="polite">
      {isEmpty ? (
        <div className="persona-window__empty-hint">{emptyHint}</div>
      ) : (
        <>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.content} />
          ))}
          {streamingResponse.length > 0 || isStreaming ? (
            <Bubble role="assistant" text={streamingResponse} streaming={isStreaming} />
          ) : null}
        </>
      )}
    </div>
  );
}

function Bubble({
  role,
  text,
  streaming
}: {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`persona-window__bubble persona-window__bubble--${isUser ? "user" : "assistant"}`}>
      {text}
      {streaming ? <span className="persona-window__cursor" aria-hidden /> : null}
    </div>
  );
}
