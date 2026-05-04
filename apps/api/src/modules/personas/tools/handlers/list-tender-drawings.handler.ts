import { Injectable } from "@nestjs/common";
import {
  DrawingToolsAccessService,
  isLikelyValidId,
  type DrawingDocumentRow
} from "./drawing-tools.shared";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

type Input = { tenderId?: unknown };

// list_tender_drawings — cheap directory call. No vision tokens. Returns
// drawing IDs, filenames, file sizes, mime types, and upload dates.
// Always call this first when starting work on a tender — see system
// prompt §3.
//
// pageCount is always null. PR #142 computed it via a per-listing PDF
// parse (download + pdfjs metadata read), which defeated the
// cheap-listing design goal — listing 10 drawings = 10 SharePoint
// downloads + 10 PDF parses. PR #145 dropped that path. PHASE 6 carry-
// forward: cache pageCount on TenderDocumentLink at upload time so
// it can ship in the listing without runtime work.
@Injectable()
export class ListTenderDrawingsHandler implements ToolHandler<Input> {
  name = "list_tender_drawings";
  description =
    "List all drawings attached to a tender. Returns drawing IDs, filenames, mime types, and file sizes. Use this first to discover what drawings are available before reading them. Cheap — no vision tokens consumed.";
  inputSchema = {
    type: "object" as const,
    properties: {
      tenderId: {
        type: "string",
        description: "The tender ID to list drawings for."
      }
    },
    required: ["tenderId"]
  };

  constructor(private readonly access: DrawingToolsAccessService) {}

  async execute(input: Input, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    if (!isLikelyValidId(input.tenderId)) {
      return errorResult("Invalid tender ID format.");
    }
    if (!this.access.hasTenderDocumentsViewPermission(ctx)) {
      return errorResult("You do not have permission to view documents for this tender.");
    }

    let rows: DrawingDocumentRow[];
    try {
      rows = await this.access.listDrawingsForTender(input.tenderId);
    } catch {
      return errorResult("Failed to list drawings due to an internal error. Please try again or escalate.");
    }
    if (rows.length === 0) {
      return {
        result: {
          content: [{ type: "text", text: "No drawings found for this tender." }]
        }
      };
    }

    const enriched = rows.map((r) => ({
      id: r.id,
      filename: r.fileLink?.name ?? r.title,
      fileSize: r.fileLink?.sizeBytes ?? null,
      // pageCount: see file header comment. Always null today;
      // extract_drawing_titleblock can return per-page metadata when
      // the model needs it for a specific drawing.
      pageCount: null,
      uploadedAt: r.createdAt.toISOString(),
      mimeType: r.fileLink?.mimeType ?? null
    }));

    return {
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({ tenderId: input.tenderId, drawings: enriched }, null, 2)
          }
        ]
      }
    };
  }
}

function errorResult(message: string): ToolHandlerExecuteResult {
  return {
    result: { content: [{ type: "text", text: message }], isError: true }
  };
}
