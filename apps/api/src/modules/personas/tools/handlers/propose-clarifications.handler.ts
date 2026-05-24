import { Injectable } from "@nestjs/common";
import { proposeClarificationsTool } from "../../../ai-providers/tools/propose-clarifications.tool";
import type { ProposeClarificationsArgs } from "../../../ai-providers/tools/propose-clarifications.tool";
import { ClarificationProposalsService } from "../../../tendering/scope/clarification-proposals.service";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// §5A.1 PR F — clarifications-content proposal handler. Mirrors
// ProposeQuoteContentHandler. Stores tool_call + tool_result rows via
// ClarificationProposalsService and emits an SSE side-effect with
// event="clarification_proposals". Distinct from "proposals" /
// "estimate_proposals" / "quote_proposals" so the four UIs stay
// independent.
@Injectable()
export class ProposeClarificationsHandler implements ToolHandler<ProposeClarificationsArgs> {
  name = proposeClarificationsTool.name;
  description = proposeClarificationsTool.description;
  inputSchema = proposeClarificationsTool.inputSchema;

  constructor(private readonly proposalsService: ClarificationProposalsService) {}

  async execute(
    input: ProposeClarificationsArgs,
    ctx: ToolHandlerContext
  ): Promise<ToolHandlerExecuteResult> {
    const stored = await this.proposalsService.storeClarificationProposals(
      ctx.conversationId,
      ctx.toolUseId,
      input
    );

    const summary = summariseKinds(stored.proposals.map((p) => p.proposal.kind));

    return {
      result: {
        content: [
          {
            type: "text",
            text: `Drafted clarifications activity for the user's review (${summary}). Each proposal will appear as a card in the chat with Accept / Edit / Reject buttons. Wait for the user's decisions before proposing further changes — do not assume any have been accepted yet.`
          }
        ]
      },
      sideEffects: [
        {
          type: "sse",
          event: "clarification_proposals",
          data: {
            messageId: stored.message.id,
            proposals: stored.proposals
          }
        }
      ]
    };
  }
}

function summariseKinds(kinds: string[]): string {
  const counts: Record<string, number> = {};
  for (const k of kinds) counts[k] = (counts[k] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.new_rfi) parts.push(`${counts.new_rfi} RFI${counts.new_rfi === 1 ? "" : "s"}`);
  if (counts.new_note) parts.push(`${counts.new_note} note${counts.new_note === 1 ? "" : "s"}`);
  if (counts.rfi_response) {
    parts.push(`${counts.rfi_response} RFI response${counts.rfi_response === 1 ? "" : "s"}`);
  }
  return parts.length === 0 ? "no items" : parts.join(" + ");
}
