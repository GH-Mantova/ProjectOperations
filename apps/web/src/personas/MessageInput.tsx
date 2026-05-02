import { useState, type KeyboardEvent } from "react";
import { shouldDisableSendButton, type ChatStatus } from "./chat-helpers";

type Props = {
  status: ChatStatus;
  onSend: (text: string) => void;
};

export function MessageInput({ status, onSend }: Props) {
  const [value, setValue] = useState("");

  const disabled = shouldDisableSendButton(status, value);

  const submit = () => {
    if (disabled) return;
    onSend(value);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Standard chat UX: Enter sends, Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="persona-window__input-row">
      <textarea
        className="persona-window__textarea"
        placeholder="Message…"
        value={value}
        rows={1}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={status === "streaming"}
        aria-label="Message"
      />
      <button
        type="button"
        className="persona-window__send-button"
        disabled={disabled}
        onClick={submit}
        aria-label="Send message"
      >
        {status === "streaming" ? "…" : "Send"}
      </button>
    </div>
  );
}
