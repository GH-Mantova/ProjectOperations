import { Injectable } from "@nestjs/common";
import { proposeEstimateItemsTool } from "../../../ai-providers/tools/propose-estimate-items.tool";
import type { ProposeEstimateItemsArgs } from "../../../ai-providers/tools/propose-estimate-items.tool";
import { EstimateProposalsService } from "../../../tendering/scope/estimate-proposals.service";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// §5A.1 PR D — estimate-item proposal handler. Mirrors
// ProposeScopeItemsHandler exactly. Stores tool_call + tool_result
// ConversationMessage rows (via EstimateProposalsService) and emits an
// SSE side-effect with event="estimate_proposals" so the frontend
// EstimateProposalCardList can render the cards. The event name is
// intentionally distinct from propose_scope_items' "proposals" event
// so the two UIs stay independent.
@Injectable()
export class ProposeEstimateItemsHandler implements ToolHandler<ProposeEstimateItemsArgs> {
  name = proposeEstimateItemsTool.name;
  description = proposeEstimateItemsTool.description;
  inputSchema = proposeEstimateItemsTool.inputSchema;

  constructor(private readonly proposalsService: EstimateProposalsService) {}

  async execute(
    input: ProposeEstimateItemsArgs,
    ctx: ToolHandlerContext
  ): Promise<ToolHandlerExecuteResult> {
    const stored = await this.proposalsService.storeEstimateProposals(
      ctx.conversationId,
      ctx.toolUseId,
      input
    );

    const count = stored.proposals.length;
    const noun = count === 1 ? "proposal" : "proposals";
    return {
      result: {
        content: [
          {
            type: "text",
            text: `Drafted ${count} estimate item ${noun} for the user's review. They will appear as cards in the chat with Accept / Edit / Reject buttons. Wait for the user's decisions before proposing further changes — do not assume any have been accepted yet.`
          }
        ]
      },
      sideEffects: [
        {
          type: "sse",
          // Distinct from propose_scope_items' "proposals" event so the
          // frontend can route each event to its own card component.
          event: "estimate_proposals",
          data: {
            messageId: stored.message.id,
            proposals: stored.proposals
          }
        }
      ]
    };
  }
}
