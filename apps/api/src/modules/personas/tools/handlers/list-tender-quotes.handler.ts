import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// §5A.1 PR E — quote sub-mode discovery tool. Lists the ClientQuotes
// attached to the active tender (resolved from the persona
// conversation's contextKey, with input override for callers that pass
// tenderId explicitly). Cheap directory call. The persona is already
// gated by ai.persona.tendering at the chat endpoint; this handler
// additionally enforces tenders.view (matches the rest of the
// client-quotes endpoints in the module).
type Input = { tenderId?: unknown };

@Injectable()
export class ListTenderQuotesHandler implements ToolHandler<Input> {
  name = "list_tender_quotes";
  description =
    "List all ClientQuotes attached to a tender — returns quote ID, quoteRef, revision, status (DRAFT/SENT/SUPERSEDED), client name, and createdAt. Use this first when working in the quote sub-mode so you can identify which quote the user is referring to before proposing content.";
  inputSchema = {
    type: "object" as const,
    properties: {
      tenderId: {
        type: "string",
        description:
          "Tender ID to list quotes for. Optional — defaults to the active tender (the chat's contextKey)."
      }
    },
    required: []
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: Input, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    if (!this.hasViewPermission(ctx)) {
      return errorResult("You do not have permission to view tenders.");
    }
    const tenderId =
      typeof input.tenderId === "string" && input.tenderId.length > 0
        ? input.tenderId
        : ctx.contextKey;
    if (!tenderId) {
      return errorResult(
        "No tender ID provided and no active tender context — the quote tool can only be used when working on a specific tender."
      );
    }

    let rows;
    try {
      rows = await this.prisma.clientQuote.findMany({
        where: { tenderId },
        select: {
          id: true,
          quoteRef: true,
          revision: true,
          status: true,
          detailLevel: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { id: true, name: true } }
        },
        orderBy: [{ createdAt: "desc" }]
      });
    } catch {
      return errorResult("Failed to list quotes due to an internal error. Please try again or escalate.");
    }
    if (rows.length === 0) {
      return {
        result: {
          content: [
            {
              type: "text",
              text:
                "No quotes found for this tender. Tell the user a ClientQuote must be created in the Quote tab before content can be proposed into it."
            }
          ]
        }
      };
    }

    const enriched = rows.map((r) => ({
      id: r.id,
      quoteRef: r.quoteRef,
      revision: r.revision,
      status: r.status,
      detailLevel: r.detailLevel,
      client: { id: r.client.id, name: r.client.name },
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));

    return {
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({ tenderId, quotes: enriched }, null, 2)
          }
        ]
      }
    };
  }

  // Mirror the access pattern from the existing /tenders endpoints —
  // tenders.view is the permission gate. Super Users bypass.
  private hasViewPermission(ctx: ToolHandlerContext): boolean {
    const actor = ctx.actor as { permissions?: string[]; isSuperUser?: boolean };
    if (actor.isSuperUser) return true;
    return Array.isArray(actor.permissions) && actor.permissions.includes("tenders.view");
  }
}

function errorResult(message: string): ToolHandlerExecuteResult {
  return {
    result: { content: [{ type: "text", text: message }], isError: true }
  };
}
