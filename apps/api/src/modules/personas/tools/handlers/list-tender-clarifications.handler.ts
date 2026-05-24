import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

// §5A.1 PR F — clarifications sub-mode discovery tool. Returns the
// tender's formal RFIs (TenderClarification) AND the comms log
// (TenderClarificationNote). Lets the model:
//   - see which RFIs are still OPEN (so it can draft a response)
//   - see recent communication history (so it doesn't raise a
//     duplicate of an existing clarification)
// Read-only. Persona is already gated by ai.persona.tendering at the
// chat endpoint; this handler additionally requires tenders.view.
type Input = { tenderId?: unknown };

@Injectable()
export class ListTenderClarificationsHandler implements ToolHandler<Input> {
  name = "list_tender_clarifications";
  description =
    "List all formal RFIs (TenderClarification) and recent communication log entries (TenderClarificationNote) for the active tender. Returns RFI id / subject / status / dueDate / hasResponse, and for each note: id / noteType (call|email|meeting|note|response) / direction (sent|received) / text / occurredAt. Use this first in the clarifications sub-mode so you can draft responses to OPEN RFIs and avoid raising duplicates of existing items.";
  inputSchema = {
    type: "object" as const,
    properties: {
      tenderId: {
        type: "string",
        description:
          "Tender ID to list clarifications for. Optional — defaults to the active tender (the chat's contextKey)."
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
        "No tender ID provided and no active tender context — the clarifications tool can only be used when working on a specific tender."
      );
    }

    let rfis;
    let notes;
    try {
      [rfis, notes] = await Promise.all([
        this.prisma.tenderClarification.findMany({
          where: { tenderId },
          select: {
            id: true,
            subject: true,
            status: true,
            dueDate: true,
            response: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }]
        }),
        this.prisma.tenderClarificationNote.findMany({
          where: { tenderId },
          select: {
            id: true,
            noteType: true,
            direction: true,
            text: true,
            occurredAt: true,
            createdAt: true
          },
          orderBy: [{ occurredAt: "desc" }],
          take: 50
        })
      ]);
    } catch {
      return errorResult("Failed to list clarifications due to an internal error. Please try again or escalate.");
    }

    const rfiPayload = rfis.map((r) => ({
      id: r.id,
      subject: r.subject,
      status: r.status,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      hasResponse: r.response != null && r.response.length > 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
    const notePayload = notes.map((n) => ({
      id: n.id,
      noteType: n.noteType,
      direction: n.direction,
      text: n.text,
      occurredAt: n.occurredAt.toISOString()
    }));

    if (rfiPayload.length === 0 && notePayload.length === 0) {
      return {
        result: {
          content: [
            {
              type: "text",
              text:
                "No clarifications or notes found for this tender yet. Any new RFI or comms-log entry you propose via propose_clarifications will be the first."
            }
          ]
        }
      };
    }

    return {
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { tenderId, rfis: rfiPayload, notes: notePayload },
              null,
              2
            )
          }
        ]
      }
    };
  }

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
