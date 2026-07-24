import { useCallback, useEffect, useState } from "react";
import { useActivePersona } from "./PersonaContext";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { useStreamingChat, type ConversationSummary } from "./use-streaming-chat";
import { chatPanelEmptyHint } from "./chat-helpers";
import { formatRelativeDate, truncatePreview } from "./date-helpers";
import { useConfirm } from "../hooks/useConfirm";

const ICON_NEW = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ICON_HISTORY = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const ICON_TRASH = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const ICON_BACK = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

type View = "chat" | "history";

export function ChatPanel() {
  const { activePersona, contextKey } = useActivePersona();
  const confirm = useConfirm();
  const slug = activePersona?.persona.slug ?? null;
  const subMode = activePersona?.subMode.name;
  const {
    messages,
    currentResponse,
    status,
    error,
    toolStatus,
    sendMessage,
    retry,
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
  } = useStreamingChat(slug, subMode, contextKey);

  const [view, setView] = useState<View>("chat");

  if (!activePersona) return null;

  const emptyHint = chatPanelEmptyHint(activePersona);

  const handleNewConversation = async () => {
    if (messages.length > 0) {
      const ok = await confirm({
        title: "Start new conversation",
        message: "Start a new conversation? Current chat will be saved to History.",
        confirmLabel: "Start new"
      });
      if (!ok) return;
    }
    await startNewConversation();
    setView("chat");
  };

  return (
    <div className="persona-window__chat">
      <div className="persona-window__chat-toolbar">
        {view === "chat" ? (
          <>
            <button
              type="button"
              className="persona-window__chat-toolbar-btn"
              onClick={() => void handleNewConversation()}
              title="Start new conversation"
            >
              {ICON_NEW}
              <span>New</span>
            </button>
            <button
              type="button"
              className="persona-window__chat-toolbar-btn"
              onClick={() => setView("history")}
              title="Show conversation history"
            >
              {ICON_HISTORY}
              <span>History</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="persona-window__chat-toolbar-btn"
            onClick={() => setView("chat")}
            title="Back to chat"
          >
            {ICON_BACK}
            <span>Back to chat</span>
          </button>
        )}
      </div>

      {view === "chat" ? (
        <>
          <MessageList
            messages={messages}
            streamingResponse={currentResponse}
            isStreaming={status === "streaming"}
            toolStatus={toolStatus}
            emptyHint={emptyHint}
            onAcceptProposal={acceptProposal}
            onRejectProposal={rejectProposal}
            onAcceptAllProposals={acceptAllPending}
            onRejectAllProposals={rejectAllPending}
            onAcceptEstimateProposal={acceptEstimateProposal}
            onRejectEstimateProposal={rejectEstimateProposal}
            onAcceptAllEstimateProposals={acceptAllPendingEstimateProposals}
            onRejectAllEstimateProposals={rejectAllPendingEstimateProposals}
            onAcceptQuoteProposal={acceptQuoteProposal}
            onRejectQuoteProposal={rejectQuoteProposal}
            onAcceptAllQuoteProposals={acceptAllPendingQuoteProposals}
            onRejectAllQuoteProposals={rejectAllPendingQuoteProposals}
            onAcceptClarificationProposal={acceptClarificationProposal}
            onRejectClarificationProposal={rejectClarificationProposal}
            onAcceptAllClarificationProposals={acceptAllPendingClarificationProposals}
            onRejectAllClarificationProposals={rejectAllPendingClarificationProposals}
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
        </>
      ) : (
        <ConversationHistoryList
          listConversations={listConversations}
          loadConversation={async (id) => {
            await loadConversation(id);
            setView("chat");
          }}
          deleteConversation={deleteConversation}
        />
      )}
    </div>
  );
}

function ConversationHistoryList({
  listConversations,
  loadConversation,
  deleteConversation
}: {
  listConversations: (limit?: number) => Promise<ConversationSummary[]>;
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<boolean>;
}) {
  const confirm = useConfirm();
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await listConversations(20);
      setItems(list);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, [listConversations]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete conversation",
      message: "Delete this conversation? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    const deleted = await deleteConversation(id);
    if (deleted && items) {
      setItems(items.filter((it) => it.id !== id));
    }
  };

  if (loadError) {
    return (
      <div className="persona-window__history">
        <div className="persona-window__history-empty">
          Failed to load history: {loadError}
        </div>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="persona-window__history">
        <div className="persona-window__history-empty">Loading…</div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="persona-window__history">
        <div className="persona-window__history-empty">
          No previous conversations for this view yet.
        </div>
      </div>
    );
  }
  return (
    <div className="persona-window__history">
      <ul className="persona-window__history-list">
        {items.map((item) => (
          <li key={item.id} className="persona-window__history-row">
            <button
              type="button"
              className="persona-window__history-row-main"
              onClick={() => void loadConversation(item.id)}
            >
              <div className="persona-window__history-row-time">
                {formatRelativeDate(item.updatedAt)}
              </div>
              <div className="persona-window__history-row-preview">
                {truncatePreview(item.preview)}
              </div>
            </button>
            <button
              type="button"
              className="persona-window__history-row-delete"
              onClick={() => void handleDelete(item.id)}
              aria-label="Delete conversation"
              title="Delete conversation"
            >
              {ICON_TRASH}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
