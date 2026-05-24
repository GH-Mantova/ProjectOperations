import { useEffect, useRef } from "react";
import type {
  ChatClarificationProposal,
  ChatEstimateProposal,
  ChatMessage,
  ChatProposal,
  ChatQuoteProposal
} from "./chat-helpers";
import { ClarificationProposalCardList } from "./ClarificationProposalCardList";
import { EstimateProposalCardList } from "./EstimateProposalCardList";
import { ProposalCardList } from "./ProposalCardList";
import { QuoteProposalCardList } from "./QuoteProposalCardList";

type Props = {
  messages: ChatMessage[];
  streamingResponse: string;
  isStreaming: boolean;
  emptyHint: string;
  onAcceptProposal?: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatProposal>
  ) => Promise<{ ok: boolean; scopeItemId?: string; error?: string }>;
  onRejectProposal?: (messageId: string, proposalIndex: number) => Promise<boolean>;
  onAcceptAllProposals?: (messageId: string) => Promise<{ accepted: number; failed: number }>;
  onRejectAllProposals?: (messageId: string) => Promise<number>;
  onAcceptEstimateProposal?: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatEstimateProposal>
  ) => Promise<{ ok: boolean; estimateItemId?: string; error?: string }>;
  onRejectEstimateProposal?: (messageId: string, proposalIndex: number) => Promise<boolean>;
  onAcceptAllEstimateProposals?: (
    messageId: string
  ) => Promise<{ accepted: number; failed: number }>;
  onRejectAllEstimateProposals?: (messageId: string) => Promise<number>;
  onAcceptQuoteProposal?: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatQuoteProposal>
  ) => Promise<{
    ok: boolean;
    acceptedCostLineIds?: string[];
    acceptedExclusionIds?: string[];
    acceptedAssumptionIds?: string[];
    error?: string;
  }>;
  onRejectQuoteProposal?: (messageId: string, proposalIndex: number) => Promise<boolean>;
  onAcceptAllQuoteProposals?: (
    messageId: string
  ) => Promise<{ accepted: number; failed: number }>;
  onRejectAllQuoteProposals?: (messageId: string) => Promise<number>;
  onAcceptClarificationProposal?: (
    messageId: string,
    proposalIndex: number,
    edits?: Partial<ChatClarificationProposal["proposal"]>
  ) => Promise<{
    ok: boolean;
    acceptedRecord?: ChatClarificationProposal["acceptedRecord"];
    error?: string;
  }>;
  onRejectClarificationProposal?: (
    messageId: string,
    proposalIndex: number
  ) => Promise<boolean>;
  onAcceptAllClarificationProposals?: (
    messageId: string
  ) => Promise<{ accepted: number; failed: number }>;
  onRejectAllClarificationProposals?: (messageId: string) => Promise<number>;
};

export function MessageList({
  messages,
  streamingResponse,
  isStreaming,
  emptyHint,
  onAcceptProposal,
  onRejectProposal,
  onAcceptAllProposals,
  onRejectAllProposals,
  onAcceptEstimateProposal,
  onRejectEstimateProposal,
  onAcceptAllEstimateProposals,
  onRejectAllEstimateProposals,
  onAcceptQuoteProposal,
  onRejectQuoteProposal,
  onAcceptAllQuoteProposals,
  onRejectAllQuoteProposals,
  onAcceptClarificationProposal,
  onRejectClarificationProposal,
  onAcceptAllClarificationProposals,
  onRejectAllClarificationProposals
}: Props) {
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
          {messages.map((m, i) => {
            if (m.role === "proposals") {
              if (!onAcceptProposal || !onRejectProposal || !onAcceptAllProposals || !onRejectAllProposals) {
                return null;
              }
              return (
                <ProposalCardList
                  key={`${m.messageId}-${i}`}
                  messageId={m.messageId}
                  proposals={m.proposals}
                  onAccept={onAcceptProposal}
                  onReject={onRejectProposal}
                  onAcceptAll={onAcceptAllProposals}
                  onRejectAll={onRejectAllProposals}
                />
              );
            }
            if (m.role === "estimate-proposals") {
              if (
                !onAcceptEstimateProposal ||
                !onRejectEstimateProposal ||
                !onAcceptAllEstimateProposals ||
                !onRejectAllEstimateProposals
              ) {
                return null;
              }
              return (
                <EstimateProposalCardList
                  key={`${m.messageId}-${i}`}
                  messageId={m.messageId}
                  proposals={m.proposals}
                  onAccept={onAcceptEstimateProposal}
                  onReject={onRejectEstimateProposal}
                  onAcceptAll={onAcceptAllEstimateProposals}
                  onRejectAll={onRejectAllEstimateProposals}
                />
              );
            }
            if (m.role === "quote-proposals") {
              if (
                !onAcceptQuoteProposal ||
                !onRejectQuoteProposal ||
                !onAcceptAllQuoteProposals ||
                !onRejectAllQuoteProposals
              ) {
                return null;
              }
              return (
                <QuoteProposalCardList
                  key={`${m.messageId}-${i}`}
                  messageId={m.messageId}
                  proposals={m.proposals}
                  onAccept={onAcceptQuoteProposal}
                  onReject={onRejectQuoteProposal}
                  onAcceptAll={onAcceptAllQuoteProposals}
                  onRejectAll={onRejectAllQuoteProposals}
                />
              );
            }
            if (m.role === "clarification-proposals") {
              if (
                !onAcceptClarificationProposal ||
                !onRejectClarificationProposal ||
                !onAcceptAllClarificationProposals ||
                !onRejectAllClarificationProposals
              ) {
                return null;
              }
              return (
                <ClarificationProposalCardList
                  key={`${m.messageId}-${i}`}
                  messageId={m.messageId}
                  proposals={m.proposals}
                  onAccept={onAcceptClarificationProposal}
                  onReject={onRejectClarificationProposal}
                  onAcceptAll={onAcceptAllClarificationProposals}
                  onRejectAll={onRejectAllClarificationProposals}
                />
              );
            }
            return <Bubble key={i} role={m.role} text={m.content} />;
          })}
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
