import { Injectable, Logger } from "@nestjs/common";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import {
  DrawingToolsAccessService,
  PDFJS_STANDARD_FONT_DATA_URL,
  RENDERABLE_MIME_TYPES,
  isLikelyValidId
} from "./drawing-tools.shared";
import type {
  ToolHandler,
  ToolHandlerContext,
  ToolHandlerExecuteResult
} from "../tool-handler.types";

type Input = { documentId?: unknown; pageNumber?: unknown };

// Anthropic vision guidance: longer side capped at 1568px gives a good
// balance between visual fidelity and token cost. Larger gets downsampled
// server-side and burns tokens for nothing.
const MAX_LONGER_SIDE_PX = 1568;
// Render PDF at 2x intrinsic scale before resize; gives sharp enough
// detail at 1568px even on A1/A0 sheets.
const PDF_RENDER_SCALE = 2;
const JPEG_QUALITY = 85;

// read_tender_drawing — render a drawing page as JPEG and pass it to
// the model via tool_result image content. PR #141's multi-turn loop
// + adapter image-content paths route the bytes back to the model;
// this handler just produces them.
@Injectable()
export class ReadTenderDrawingHandler implements ToolHandler<Input> {
  private readonly logger = new Logger(ReadTenderDrawingHandler.name);
  name = "read_tender_drawing";
  description =
    "Render a drawing page as an image and view it visually. Use this for any question requiring visual interpretation: identifying demolition extents, reading legend/notes/keyword annotations, interpreting hatching or colour markings, finding scope items. Costs vision tokens — select the specific page(s) relevant to the question rather than reading every page.";
  inputSchema = {
    type: "object" as const,
    properties: {
      documentId: { type: "string", description: "The document ID of the drawing." },
      pageNumber: {
        type: "integer",
        description:
          "The page number to render. Defaults to 1. Multi-page drawing packs typically have one page per level/area/detail — select the page that matches the level or area you are asking about."
      }
    },
    required: ["documentId"]
  };

  constructor(private readonly access: DrawingToolsAccessService) {}

  async execute(input: Input, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult> {
    if (!isLikelyValidId(input.documentId)) {
      return errorResult("Invalid document ID format.");
    }
    if (!this.access.hasTenderDocumentsViewPermission(ctx)) {
      return errorResult("You do not have permission to view documents for this tender.");
    }
    const pageNumber = parsePageNumber(input.pageNumber);
    if (pageNumber === null) {
      return errorResult("Invalid pageNumber — must be a positive integer.");
    }

    const doc = await this.access.loadDocument(input.documentId);
    if (!doc || !doc.fileLink) {
      return errorResult("Drawing not found.");
    }
    const mime = doc.fileLink.mimeType ?? "";
    if (!RENDERABLE_MIME_TYPES.has(mime)) {
      return errorResult(
        `This document type cannot be rendered. Only PDF, PNG, and JPEG are supported. (Detected: ${mime || "unknown"})`
      );
    }

    let bytes: Buffer;
    try {
      bytes = await this.access.downloadFileBytes(doc.fileLink);
    } catch {
      return errorResult("Failed to fetch drawing from storage.");
    }

    let jpegBuffer: Buffer;
    let totalPages: number;
    try {
      if (mime === "application/pdf") {
        const rendered = await renderPdfPageToJpeg(bytes, pageNumber);
        if (typeof rendered === "string") {
          return errorResult(rendered);
        }
        jpegBuffer = rendered.jpeg;
        totalPages = rendered.totalPages;
      } else {
        // Image input — resize to cap, normalise to JPEG q85.
        if (pageNumber !== 1) {
          return errorResult("Image documents have only one page; pageNumber must be 1.");
        }
        jpegBuffer = await sharp(bytes)
          .rotate()
          .resize({
            width: MAX_LONGER_SIDE_PX,
            height: MAX_LONGER_SIDE_PX,
            fit: "inside",
            withoutEnlargement: true
          })
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer();
        totalPages = 1;
      }
    } catch (err) {
      this.logger.error(
        `Drawing render failed [doc=${input.documentId}, page=${pageNumber}]: ${(err as Error).message}`
      );
      return errorResult(
        "Failed to render drawing page. The PDF may be corrupt or use unsupported features. Please escalate."
      );
    }

    const filename = doc.fileLink.name;
    return {
      result: {
        content: [
          {
            type: "image",
            mediaType: "image/jpeg",
            data: jpegBuffer.toString("base64")
          },
          {
            type: "text",
            text: `Drawing page ${pageNumber} of ${totalPages}. Document: ${filename}.`
          }
        ]
      }
    };
  }
}

// Return type discriminates: string is an error message, object is success.
async function renderPdfPageToJpeg(
  bytes: Buffer,
  pageNumber: number
): Promise<{ jpeg: Buffer; totalPages: number } | string> {
  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      useSystemFonts: false,
      standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL
    }).promise;
  } catch {
    return "Failed to parse PDF. The file may be corrupt.";
  }
  const totalPages = pdf.numPages;
  if (pageNumber > totalPages) {
    await pdf.destroy();
    return `Page ${pageNumber} does not exist in this drawing (drawing has ${totalPages} pages).`;
  }
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

  // @napi-rs/canvas — cross-platform, no native build deps on Windows.
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const canvasContext = canvas.getContext("2d");

  await page.render({
    canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
    viewport
  }).promise;

  const pngBuffer = await canvas.encode("png");
  await pdf.destroy();

  // Resize to <=1568px longer side, convert to JPEG q85.
  const jpeg = await sharp(pngBuffer)
    .resize({
      width: MAX_LONGER_SIDE_PX,
      height: MAX_LONGER_SIDE_PX,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { jpeg, totalPages };
}

function parsePageNumber(value: unknown): number | null {
  if (value === undefined || value === null) return 1;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function errorResult(message: string): ToolHandlerExecuteResult {
  return { result: { content: [{ type: "text", text: message }], isError: true } };
}
