import { ReadTenderDrawingHandler } from "../read-tender-drawing.handler";
import type { DrawingToolsAccessService } from "../drawing-tools.shared";
import type { ToolHandlerContext } from "../../tool-handler.types";
import PDFDocument from "pdfkit";
import sharp from "sharp";

const VALID_DOC_ID = "cltest123doc00000abcdef0";

const ctx: ToolHandlerContext = {
  actor: { sub: "u-1", permissions: ["tenderdocuments.view"] } as never,
  conversationId: "conv-1",
  contextKey: null,
  toolUseId: "tu-1"
};

function makeSimplePdf(pages = 1): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (let i = 1; i <= pages; i++) {
      if (i > 1) doc.addPage();
      doc.fontSize(20).text(`Test page ${i}`, 100, 100);
    }
    doc.end();
  });
}

async function makeSimplePng(): Promise<Buffer> {
  // Single magenta pixel scaled up so sharp has something to resize.
  return sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 0, b: 255 }
    }
  })
    .png()
    .toBuffer();
}

function buildAccess(overrides: Partial<DrawingToolsAccessService> = {}) {
  const base = {
    loadDocument: jest.fn(async () => null),
    hasTenderDocumentsViewPermission: jest.fn(() => true),
    downloadFileBytes: jest.fn(async () => Buffer.from(""))
  };
  return { ...base, ...overrides } as unknown as DrawingToolsAccessService;
}

describe("ReadTenderDrawingHandler", () => {
  it("rejects malformed document ID", async () => {
    const h = new ReadTenderDrawingHandler(buildAccess());
    const out = await h.execute({ documentId: "x" }, ctx);
    expect(out.result.isError).toBe(true);
  });

  it("rejects when actor lacks permission", async () => {
    const h = new ReadTenderDrawingHandler(
      buildAccess({ hasTenderDocumentsViewPermission: jest.fn(() => false) as never })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBe(true);
  });

  it("returns 'unsupported file type' for non-renderable mime", async () => {
    const h = new ReadTenderDrawingHandler(
      buildAccess({
        loadDocument: jest.fn(async () => ({
          id: VALID_DOC_ID,
          tenderId: "t1",
          category: "drawing",
          title: "DWG",
          fileLink: {
            siteId: "s",
            driveId: "d",
            itemId: "i",
            name: "x.dwg",
            mimeType: "application/acad",
            sizeBytes: 100
          },
          createdAt: new Date()
        })) as never
      })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/cannot be rendered/);
  });

  it("renders a single-page PDF page 1 to JPEG content", async () => {
    const pdf = await makeSimplePdf(1);
    const h = new ReadTenderDrawingHandler(
      buildAccess({
        loadDocument: jest.fn(async () => ({
          id: VALID_DOC_ID,
          tenderId: "t1",
          category: "drawing",
          title: "Test",
          fileLink: {
            siteId: "s",
            driveId: "d",
            itemId: "i",
            name: "test.pdf",
            mimeType: "application/pdf",
            sizeBytes: pdf.length
          },
          createdAt: new Date()
        })) as never,
        downloadFileBytes: jest.fn(async () => pdf) as never
      })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    const imageBlock = out.result.content.find((c) => c.type === "image") as
      | { type: "image"; mediaType: string; data: string }
      | undefined;
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.mediaType).toBe("image/jpeg");
    expect(imageBlock!.data.length).toBeGreaterThan(100);
    // Decode and verify dimensions cap.
    const meta = await sharp(Buffer.from(imageBlock!.data, "base64")).metadata();
    const longerSide = Math.max(meta.width ?? 0, meta.height ?? 0);
    expect(longerSide).toBeLessThanOrEqual(1568);
    expect(meta.format).toBe("jpeg");
  }, 30_000);

  it("returns page-out-of-range error for invalid pageNumber", async () => {
    const pdf = await makeSimplePdf(1);
    const h = new ReadTenderDrawingHandler(
      buildAccess({
        loadDocument: jest.fn(async () => ({
          id: VALID_DOC_ID,
          tenderId: "t1",
          category: "drawing",
          title: "Test",
          fileLink: {
            siteId: "s",
            driveId: "d",
            itemId: "i",
            name: "test.pdf",
            mimeType: "application/pdf",
            sizeBytes: pdf.length
          },
          createdAt: new Date()
        })) as never,
        downloadFileBytes: jest.fn(async () => pdf) as never
      })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID, pageNumber: 99 }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/does not exist/);
  }, 30_000);

  it("renders a PNG to JPEG with capped dimensions", async () => {
    const png = await makeSimplePng();
    const h = new ReadTenderDrawingHandler(
      buildAccess({
        loadDocument: jest.fn(async () => ({
          id: VALID_DOC_ID,
          tenderId: "t1",
          category: "drawing",
          title: "PNG",
          fileLink: {
            siteId: "s",
            driveId: "d",
            itemId: "i",
            name: "test.png",
            mimeType: "image/png",
            sizeBytes: png.length
          },
          createdAt: new Date()
        })) as never,
        downloadFileBytes: jest.fn(async () => png) as never
      })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    const imageBlock = out.result.content.find((c) => c.type === "image") as
      | { type: "image"; mediaType: string; data: string }
      | undefined;
    expect(imageBlock).toBeDefined();
    expect(imageBlock!.mediaType).toBe("image/jpeg");
  }, 15_000);

  it("rejects pageNumber !== 1 for image inputs", async () => {
    const png = await makeSimplePng();
    const h = new ReadTenderDrawingHandler(
      buildAccess({
        loadDocument: jest.fn(async () => ({
          id: VALID_DOC_ID,
          tenderId: "t1",
          category: "drawing",
          title: "PNG",
          fileLink: {
            siteId: "s",
            driveId: "d",
            itemId: "i",
            name: "test.png",
            mimeType: "image/png",
            sizeBytes: png.length
          },
          createdAt: new Date()
        })) as never,
        downloadFileBytes: jest.fn(async () => png) as never
      })
    );
    const out = await h.execute({ documentId: VALID_DOC_ID, pageNumber: 2 }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/only one page/);
  }, 15_000);
});
