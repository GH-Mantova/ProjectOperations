import { ListTenderDrawingsHandler } from "../list-tender-drawings.handler";
import type { DrawingToolsAccessService } from "../drawing-tools.shared";
import type { ToolHandlerContext } from "../../tool-handler.types";

const VALID_TENDER_ID = "cltest123tender0000abcdef";

function buildAccess(overrides: Partial<DrawingToolsAccessService> = {}) {
  const base = {
    listDrawingsForTender: jest.fn(async () => []),
    hasTenderDocumentsViewPermission: jest.fn(() => true),
    downloadFileBytes: jest.fn(async () => Buffer.from(""))
  };
  return { ...base, ...overrides } as unknown as DrawingToolsAccessService;
}

const ctx: ToolHandlerContext = {
  actor: { sub: "u-1", permissions: ["tenderdocuments.view"] } as never,
  conversationId: "conv-1",
  contextKey: VALID_TENDER_ID,
  toolUseId: "tu-1"
};

describe("ListTenderDrawingsHandler", () => {
  it("rejects malformed tender IDs", async () => {
    const h = new ListTenderDrawingsHandler(buildAccess());
    const out = await h.execute({ tenderId: "abc" }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/Invalid tender ID format/);
  });

  it("rejects when actor lacks tenderdocuments.view permission", async () => {
    const access = buildAccess({
      hasTenderDocumentsViewPermission: jest.fn(() => false) as never
    });
    const h = new ListTenderDrawingsHandler(access);
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/permission/i);
  });

  it("returns 'No drawings found' when tender has zero drawings", async () => {
    const h = new ListTenderDrawingsHandler(buildAccess());
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    expect((out.result.content[0] as { text: string }).text).toBe(
      "No drawings found for this tender."
    );
  });

  it("returns drawing list with pageCount=null for non-PDF entries", async () => {
    const access = buildAccess({
      listDrawingsForTender: jest.fn(async () => [
        {
          id: "doc1",
          tenderId: VALID_TENDER_ID,
          category: "drawing",
          title: "Floor plan",
          fileLink: {
            siteId: "s",
            driveId: "d",
            itemId: "i",
            name: "plan.png",
            mimeType: "image/png",
            sizeBytes: 1234
          },
          createdAt: new Date("2026-04-01T00:00:00Z")
        }
      ]) as never
    });
    const h = new ListTenderDrawingsHandler(access);
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBeFalsy();
    const text = (out.result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text) as { drawings: Array<{ pageCount: number | null }> };
    expect(parsed.drawings).toHaveLength(1);
    expect(parsed.drawings[0]!.pageCount).toBeNull();
  });

  it("returns surfaced internal error message on listDrawings failure", async () => {
    const access = buildAccess({
      listDrawingsForTender: jest.fn(async () => {
        throw new Error("DB down");
      }) as never
    });
    const h = new ListTenderDrawingsHandler(access);
    const out = await h.execute({ tenderId: VALID_TENDER_ID }, ctx);
    expect(out.result.isError).toBe(true);
    expect((out.result.content[0] as { text: string }).text).toMatch(/internal error/i);
  });
});
