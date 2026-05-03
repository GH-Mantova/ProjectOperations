import { Injectable } from "@nestjs/common";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import {
  DrawingToolsAccessService,
  PDFJS_STANDARD_FONT_DATA_URL,
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
// drawing IDs, filenames, page counts (when cheaply extractable), file
// sizes, mime types, and upload dates. Always call this first when
// starting work on a tender — see system prompt §3.
@Injectable()
export class ListTenderDrawingsHandler implements ToolHandler<Input> {
  name = "list_tender_drawings";
  description =
    "List all drawings attached to a tender. Returns drawing IDs, filenames, page counts, and file sizes. Use this first to discover what drawings are available before reading them. Cheap — no vision tokens consumed.";
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

    // Page count for PDFs is metadata-only — pdfjs.getDocument().numPages
    // doesn't rasterise. For non-PDFs, return null (image files are
    // single-page by convention).
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const pageCount = await safeGetPageCount(this.access, r);
        return {
          id: r.id,
          filename: r.fileLink?.name ?? r.title,
          fileSize: r.fileLink?.sizeBytes ?? null,
          pageCount,
          uploadedAt: r.createdAt.toISOString(),
          mimeType: r.fileLink?.mimeType ?? null
        };
      })
    );

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

async function safeGetPageCount(
  access: DrawingToolsAccessService,
  row: DrawingDocumentRow
): Promise<number | null> {
  if (!row.fileLink || row.fileLink.mimeType !== "application/pdf") return null;
  try {
    const bytes = await access.downloadFileBytes(row.fileLink);
    // Disable worker — Node-side parse only needs the main thread.
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      useSystemFonts: false,
      standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL
    });
    const pdf = await loadingTask.promise;
    const n = pdf.numPages;
    await pdf.destroy();
    return n;
  } catch {
    // Page count is best-effort — never block the listing.
    return null;
  }
}

function errorResult(message: string): ToolHandlerExecuteResult {
  return {
    result: { content: [{ type: "text", text: message }], isError: true }
  };
}
