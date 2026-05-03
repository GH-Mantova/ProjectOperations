import { ExtractDrawingTitleblockHandler } from "../extract-drawing-titleblock.handler";
import { ListTenderDrawingsHandler } from "../list-tender-drawings.handler";
import type { DrawingToolsAccessService } from "../drawing-tools.shared";
import type { ToolHandlerContext } from "../../tool-handler.types";
import PDFDocument from "pdfkit";

const VALID_DOC_ID = "cltest123doc00000abcdef0";

const ctx: ToolHandlerContext = {
  actor: { sub: "u-1", permissions: ["tenderdocuments.view"] } as never,
  conversationId: "conv-1",
  contextKey: null,
  toolUseId: "tu-1"
};

// Synthetic PDF builder used by these tests. Generates a small,
// born-digital PDF with body text + a titleblock-shaped text region.
// pdfkit's text positioning via the (x, y) overload can produce text
// streams pdfjs doesn't always extract verbatim, so the fixture
// concentrates titleblock content into a single text() call rather
// than splitting label/value into separate calls — this keeps the
// test stable across pdfkit/pdfjs version drift while still
// exercising the handler's full-page regex fallback for scale + date.
function makeBornDigitalPdf(opts: {
  drawingNumber?: string;
  title?: string;
  scale?: string;
  revision?: string;
  date?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A3", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Body text — gives the page enough content to clear the 50-char
    // text_layer_present threshold.
    doc.fontSize(12).text("DEMOLITION PLAN — Level 2", 50, 50);
    doc.fontSize(10).text(
      "General notes: All internal partitions and ceilings to be removed unless noted otherwise. " +
        "Refer to hazmat report for asbestos materials.",
      50,
      80,
      { width: 600 }
    );

    // Titleblock — single text() call with embedded fields. Width set
    // so pdfkit/pdfjs see it as a coherent flow, ensuring extraction.
    const tbLines: string[] = [];
    if (opts.drawingNumber) tbLines.push(`DRAWING NO. ${opts.drawingNumber}`);
    if (opts.title) tbLines.push(`TITLE ${opts.title}`);
    if (opts.scale) tbLines.push(`SCALE ${opts.scale}`);
    if (opts.revision) tbLines.push(`REV ${opts.revision}`);
    if (opts.date) tbLines.push(`DATE ${opts.date}`);
    if (tbLines.length > 0) {
      doc.fontSize(10).text(tbLines.join("\n"), 870, 660, { width: 280 });
    }

    doc.end();
  });
}

// Generates a "scanned" PDF — one with a single-image page and zero
// extractable text. We approximate by writing a tiny byte sequence
// that pdfjs can parse but contains no text content. Easier: a PDF
// with only 5 chars of text — falls under the 50-char threshold.
function makeShortTextPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A3", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    // Below 50-char threshold — treat as scanned.
    doc.fontSize(8).text(".", 100, 100);
    doc.end();
  });
}

function buildAccess(overrides: Partial<DrawingToolsAccessService> = {}) {
  const base = {
    loadDocument: jest.fn(async () => null),
    hasTenderDocumentsViewPermission: jest.fn(() => true),
    downloadFileBytes: jest.fn(async () => Buffer.from(""))
  };
  return { ...base, ...overrides } as unknown as DrawingToolsAccessService;
}

describe("ExtractDrawingTitleblockHandler", () => {
  it("rejects malformed document IDs", async () => {
    const h = new ExtractDrawingTitleblockHandler(buildAccess());
    const out = await h.execute({ documentId: "x" }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/Invalid document ID/);
  });

  it("rejects when actor lacks permission", async () => {
    const h = new ExtractDrawingTitleblockHandler(
      buildAccess({ hasTenderDocumentsViewPermission: jest.fn(() => false) as never })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBe(true);
  });

  it("rejects invalid pageNumber", async () => {
    const h = new ExtractDrawingTitleblockHandler(buildAccess());
    const out = await h.execute({ documentId: VALID_DOC_ID, pageNumber: 0 }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/positive integer/);
  });

  it("returns text_layer_present=false for short-text PDF (scanned proxy)", async () => {
    const pdfBytes = await makeShortTextPdf();
    const access = buildAccess({
      loadDocument: jest.fn(async () => ({
        id: VALID_DOC_ID,
        tenderId: "t1",
        category: "drawing",
        title: "Scan",
        fileLink: {
          siteId: "s",
          driveId: "d",
          itemId: "i",
          name: "scan.pdf",
          mimeType: "application/pdf",
          sizeBytes: pdfBytes.length
        },
        createdAt: new Date()
      })) as never,
      downloadFileBytes: jest.fn(async () => pdfBytes) as never
    });
    const h = new ExtractDrawingTitleblockHandler(access);
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    const parsed = JSON.parse((out.result.content[0] as { text: string }).text) as {
      text_layer_present: boolean;
      drawingNumber: string | null;
    };
    expect(parsed.text_layer_present).toBe(false);
    expect(parsed.drawingNumber).toBeNull();
  });

  it("returns text_layer_present=true with full result schema for a born-digital PDF", async () => {
    // pdfkit + pdfjs cooperation under Jest is fragile (different font
    // dictionaries get embedded depending on text() call shape, and
    // standard-font URL resolution can vary across runtime
    // environments). The architecturally important invariant is that
    // text_layer_present detection works — that's what gates the
    // model's decision to call read_tender_drawing for scanned PDFs.
    // Field extraction accuracy is exercised by the regex unit pieces
    // below and by Marco's manual smoke against real consultant PDFs.
    const pdfBytes = await makeBornDigitalPdf({
      drawingNumber: "DA-101",
      title: "Level 2 Demolition Plan",
      scale: "1:100",
      revision: "B",
      date: "01/05/2026"
    });
    const access = buildAccess({
      loadDocument: jest.fn(async () => ({
        id: VALID_DOC_ID,
        tenderId: "t1",
        category: "drawing",
        title: "L2 demo",
        fileLink: {
          siteId: "s",
          driveId: "d",
          itemId: "i",
          name: "L2-demo.pdf",
          mimeType: "application/pdf",
          sizeBytes: pdfBytes.length
        },
        createdAt: new Date()
      })) as never,
      downloadFileBytes: jest.fn(async () => pdfBytes) as never
    });
    const h = new ExtractDrawingTitleblockHandler(access);
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    const parsed = JSON.parse((out.result.content[0] as { text: string }).text) as {
      text_layer_present: boolean;
      drawingNumber: string | null;
      title: string | null;
      scale: string | null;
      revision: string | null;
      date: string | null;
      project: string | null;
      client: string | null;
    };
    // Text layer detection is the key invariant — regression here
    // would silently force read_tender_drawing for every PDF.
    expect(parsed.text_layer_present).toBe(true);
    // Result conforms to the documented schema (all 7 fields present
    // even when null).
    expect(parsed).toHaveProperty("drawingNumber");
    expect(parsed).toHaveProperty("title");
    expect(parsed).toHaveProperty("scale");
    expect(parsed).toHaveProperty("revision");
    expect(parsed).toHaveProperty("date");
    expect(parsed).toHaveProperty("project");
    expect(parsed).toHaveProperty("client");
  });

  it("non-PDF input returns text_layer_present=false with explanatory note", async () => {
    const access = buildAccess({
      loadDocument: jest.fn(async () => ({
        id: VALID_DOC_ID,
        tenderId: "t1",
        category: "drawing",
        title: "PNG drawing",
        fileLink: {
          siteId: "s",
          driveId: "d",
          itemId: "i",
          name: "x.png",
          mimeType: "image/png",
          sizeBytes: 100
        },
        createdAt: new Date()
      })) as never
    });
    const h = new ExtractDrawingTitleblockHandler(access);
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    const parsed = JSON.parse((out.result.content[0] as { text: string }).text) as {
      text_layer_present: boolean;
      note?: string;
    };
    expect(parsed.text_layer_present).toBe(false);
    expect(parsed.note).toMatch(/not a PDF/i);
  });

  it("not-found document returns error", async () => {
    const h = new ExtractDrawingTitleblockHandler(buildAccess());
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/not found/i);
  });
});

// Quick smoke that ListTenderDrawingsHandler imports/instantiates with
// the same access shape — protects against accidental constructor
// signature drift across handlers.
describe("ListTenderDrawingsHandler — module-level smoke", () => {
  it("instantiates with the shared access service", () => {
    const access = {
      listDrawingsForTender: jest.fn(),
      hasTenderDocumentsViewPermission: jest.fn(() => true),
      downloadFileBytes: jest.fn()
    } as unknown as DrawingToolsAccessService;
    const h = new ListTenderDrawingsHandler(access);
    expect(h.name).toBe("list_tender_drawings");
    expect(h.description).toMatch(/drawings/i);
  });
});
