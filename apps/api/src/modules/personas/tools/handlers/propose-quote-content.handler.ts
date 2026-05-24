import { Injectable } from "@nestjs/common";
import { proposeQuoteContentTool } from "../../../ai-providers/tools/propose-quote-content.tool";
import type { ProposeQuoteContentArgs } from "../../../ai-providers/tools/propose-quote-content.tool";
import { QuoteProposalsService } from "../../../tendering/scope/quote-proposals.service";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// §5A.1 PR E — quote-content proposal handler. Mirrors
// ProposeEstimateItemsHandler. Stores tool_call + tool_result
// ConversationMessage rows (via QuoteProposalsService) and emits an
// SSE side-effect with event="quote_proposals" so the frontend
// QuoteProposalCardList can render the cards. The event name is
// intentionally distinct from propose_scope_items' "proposals" event
// and propose_estimate_items' "estimate_proposals" event so the three
// UIs stay independent.
@Injectable()
export class ProposeQuoteContentHandler implements ToolHandler<ProposeQuoteContentArgs> {
  name = proposeQuoteContentTool.name;
  description = proposeQuoteContentTool.description;
  inputSchema = proposeQuoteContentTool.inputSchema;

  constructor(private readonly proposalsService: QuoteProposalsService) {}

  async execute(
    input: ProposeQuoteContentArgs,
    ctx: ToolHandlerContext
  ): Promise<ToolHandlerExecuteResult> {
    const stored = await this.proposalsService.storeQuoteProposals(
      ctx.conversationId,
      ctx.toolUseId,
      input
    );

    const proposal = stored.proposals[0]!;
    const summary = summarise(proposal);

    return {
      result: {
        content: [
          {
            type: "text",
            text: `Drafted quote content for the user's review (${summary}). It will appear as a card in the chat with Accept / Edit / Reject buttons. Wait for the user's decisions before proposing further changes — do not assume any have been accepted yet.`
          }
        ]
      },
      sideEffects: [
        {
          type: "sse",
          // Distinct from propose_scope_items' "proposals" and
          // propose_estimate_items' "estimate_proposals" events so the
          // frontend can route each to its own card component.
          event: "quote_proposals",
          data: {
            messageId: stored.message.id,
            proposals: stored.proposals
          }
        }
      ]
    };
  }
}

function summarise(p: {
  costLines?: unknown[];
  exclusions?: unknown[];
  assumptions?: unknown[];
}): string {
  const parts: string[] = [];
  if (Array.isArray(p.costLines) && p.costLines.length > 0) {
    parts.push(`${p.costLines.length} cost line${p.costLines.length === 1 ? "" : "s"}`);
  }
  if (Array.isArray(p.exclusions) && p.exclusions.length > 0) {
    parts.push(`${p.exclusions.length} exclusion${p.exclusions.length === 1 ? "" : "s"}`);
  }
  if (Array.isArray(p.assumptions) && p.assumptions.length > 0) {
    parts.push(`${p.assumptions.length} assumption${p.assumptions.length === 1 ? "" : "s"}`);
  }
  return parts.length === 0 ? "no content" : parts.join(" + ");
}
