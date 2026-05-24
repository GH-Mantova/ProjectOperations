import { ListTenderQuotesHandler } from "../list-tender-quotes.handler";
import type { ToolHandlerContext } from "../../tool-handler.types";

function makeCtx(
  overrides: Partial<{ permissions: string[]; isSuperUser: boolean; contextKey: string | null }> = {}
): ToolHandlerContext {
  return {
    actor: {
      sub: "u-1",
      email: "u@is",
      permissions: overrides.permissions ?? ["tenders.view"],
      isSuperUser: overrides.isSuperUser ?? false
    } as never,
    conversationId: "conv-1",
    contextKey: overrides.contextKey === undefined ? "tender-1" : overrides.contextKey,
    toolUseId: "tu-1"
  };
}

function buildPrismaMock(rows: unknown[]) {
  return {
    clientQuote: {
      findMany: jest.fn(async () => rows)
    }
  };
}

describe("ListTenderQuotesHandler", () => {
  it("returns the active tender's quotes when no tenderId is supplied", async () => {
    const prisma = buildPrismaMock([
      {
        id: "q-1",
        quoteRef: "IS-T020-Q1",
        revision: 1,
        status: "DRAFT",
        detailLevel: "detailed",
        createdAt: new Date("2026-05-20T00:00:00Z"),
        updatedAt: new Date("2026-05-21T00:00:00Z"),
        client: { id: "c-1", name: "Acme Pty Ltd" }
      }
    ]);
    const handler = new ListTenderQuotesHandler(prisma as never);
    const result = await handler.execute({}, makeCtx());
    expect(result.result.isError).toBeFalsy();
    const payload = JSON.parse((result.result.content[0] as { text: string }).text) as {
      tenderId: string;
      quotes: Array<{ id: string; quoteRef: string; status: string; client: { name: string } }>;
    };
    expect(payload.tenderId).toBe("tender-1");
    expect(payload.quotes).toHaveLength(1);
    expect(payload.quotes[0]?.quoteRef).toBe("IS-T020-Q1");
    expect(payload.quotes[0]?.client.name).toBe("Acme Pty Ltd");
  });

  it("prefers an explicit tenderId input over the context key", async () => {
    const findMany = jest.fn(async () => []);
    const prisma = { clientQuote: { findMany } };
    const handler = new ListTenderQuotesHandler(prisma as never);
    await handler.execute({ tenderId: "other-tender" }, makeCtx({ contextKey: "tender-1" }));
    expect(findMany).toHaveBeenCalledTimes(1);
    const calls = findMany.mock.calls as unknown as Array<[{ where?: { tenderId?: string } }]>;
    expect(calls[0]?.[0]?.where?.tenderId).toBe("other-tender");
  });

  it("returns a hint message (not error) when the tender has no quotes yet", async () => {
    const prisma = buildPrismaMock([]);
    const handler = new ListTenderQuotesHandler(prisma as never);
    const result = await handler.execute({}, makeCtx());
    expect(result.result.isError).toBeFalsy();
    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/No quotes found/);
    expect(text).toMatch(/ClientQuote must be created/);
  });

  it("errors when no tenderId is supplied and the context has no contextKey", async () => {
    const prisma = buildPrismaMock([]);
    const handler = new ListTenderQuotesHandler(prisma as never);
    const result = await handler.execute({}, makeCtx({ contextKey: null }));
    expect(result.result.isError).toBe(true);
    expect((result.result.content[0] as { text: string }).text).toMatch(
      /No tender ID provided/
    );
  });

  it("denies callers without tenders.view (non-super-user)", async () => {
    const prisma = buildPrismaMock([]);
    const handler = new ListTenderQuotesHandler(prisma as never);
    const result = await handler.execute({}, makeCtx({ permissions: [] }));
    expect(result.result.isError).toBe(true);
    expect((result.result.content[0] as { text: string }).text).toMatch(
      /do not have permission/
    );
  });

  it("super-users bypass the permission check", async () => {
    const prisma = buildPrismaMock([
      {
        id: "q-1",
        quoteRef: "IS-T020-Q1",
        revision: 1,
        status: "DRAFT",
        detailLevel: "detailed",
        createdAt: new Date(),
        updatedAt: new Date(),
        client: { id: "c-1", name: "Acme" }
      }
    ]);
    const handler = new ListTenderQuotesHandler(prisma as never);
    const result = await handler.execute(
      {},
      makeCtx({ permissions: [], isSuperUser: true })
    );
    expect(result.result.isError).toBeFalsy();
  });
});
