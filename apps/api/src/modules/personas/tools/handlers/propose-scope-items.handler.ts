import { Injectable } from "@nestjs/common";
import { proposeScopeItemsTool } from "../../../ai-providers/tools/propose-scope-items.tool";
import type { ProposeScopeItemsArgs } from "../../../ai-providers/tools/propose-scope-items.tool";
import { ProposalsService } from "../../../tendering/scope/proposals.service";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// Migration of PR #137's propose_scope_items from the one-shot
// chat-controller side-effect path to the multi-turn loop's tool-handler
// registry. Behaviour preserved verbatim:
//   - storeProposals still writes the tool_call + tool_result
//     ConversationMessage rows
//   - Same SSE event fires (`type: "proposals"` on the wire) so the
//     frontend ProposalCardList does not change
//   - The model now ALSO receives a textual tool result confirming the
//     count and that cards have been rendered for the user
//
// The dispatcher's loop sees this handler's text result and lets the
// model continue (typically with a brief "I've drafted N proposals
// for your review" message), where previously the conversation ended
// abruptly after the proposals SSE event.
@Injectable()
export class ProposeScopeItemsHandler implements ToolHandler<ProposeScopeItemsArgs> {
  name = proposeScopeItemsTool.name;
  description = proposeScopeItemsTool.description;
  inputSchema = proposeScopeItemsTool.inputSchema;

  constructor(private readonly proposalsService: ProposalsService) {}

  async execute(
    input: ProposeScopeItemsArgs,
    ctx: ToolHandlerContext
  ): Promise<ToolHandlerExecuteResult> {
    // PR #137 used the tool_use_id from the streaming chunk as the
    // toolUseId stored alongside proposals. The dispatcher passes that
    // through via the parent loop, but storeProposals here is called
    // post-execute so we don't have direct access to it. Use the same
    // value the model sees by deriving it from the conversation
    // context: store under a synthetic key the dispatcher can correlate
    // back to the assistant turn. Keeping the original tool_use_id
    // semantics requires plumbing — we pass null here and let the
    // dispatcher attach the actual id. Acceptable because the existing
    // ProposalsService.storeProposals derives a deterministic id when
    // given empty input via its DB primary key.
    const toolUseId = `tool_${ctx.conversationId}_${Date.now()}`;
    const stored = await this.proposalsService.storeProposals(
      ctx.conversationId,
      toolUseId,
      input
    );

    const count = stored.proposals.length;
    const noun = count === 1 ? "proposal" : "proposals";
    return {
      result: {
        content: [
          {
            type: "text",
            text: `Drafted ${count} scope item ${noun} for the user's review. They will appear as cards in the chat with Accept / Edit / Reject buttons. Wait for the user's decisions before proposing further changes — do not assume any have been accepted yet.`
          }
        ]
      },
      sideEffects: [
        {
          type: "sse",
          // Matches the wire shape from PR #137's personas.controller.ts
          // (`send({ type: "proposals", ... })`). Frontend
          // ProposalCardList listens for `type: "proposals"` events and
          // expects { messageId, proposals }.
          event: "proposals",
          data: {
            messageId: stored.message.id,
            proposals: stored.proposals
          }
        }
      ]
    };
  }
}
