import { useEffect, useRef } from "react";
import { useActivePersona } from "./PersonaContext";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { useStreamingChat } from "./use-streaming-chat";
import { shouldResetOnPersonaChange } from "./chat-helpers";
import type { ActivePersona } from "./types";

export function ChatPanel() {
  const { activePersona } = useActivePersona();
  const slug = activePersona?.persona.slug ?? null;
  const subMode = activePersona?.subMode.name;
  const { messages, currentResponse, status, error, sendMessage, retry, reset } =
    useStreamingChat(slug);

  // Reset chat state whenever the active persona+sub-mode actually changes
  // (different page or different tab). Window close/reopen on the same
  // sub-mode does NOT trigger this — useActivePersona returns a stable value
  // for the same route.
  const prevPersonaRef = useRef<ActivePersona | null>(null);
  useEffect(() => {
    if (shouldResetOnPersonaChange(prevPersonaRef.current, activePersona)) {
      reset();
    }
    prevPersonaRef.current = activePersona;
  }, [activePersona, reset]);

  if (!activePersona) return null;

  const emptyHint = `Ask the ${activePersona.persona.displayName} about this ${activePersona.subMode.name} view.`;

  return (
    <div className="persona-window__chat">
      <MessageList
        messages={messages}
        streamingResponse={currentResponse}
        isStreaming={status === "streaming"}
        emptyHint={emptyHint}
      />
      {status === "error" && error ? (
        <div className="persona-window__error" role="alert">
          <span>{error}</span>
          <button type="button" className="persona-window__retry" onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
      <MessageInput status={status} onSend={(text) => void sendMessage(text, { subMode })} />
    </div>
  );
}
