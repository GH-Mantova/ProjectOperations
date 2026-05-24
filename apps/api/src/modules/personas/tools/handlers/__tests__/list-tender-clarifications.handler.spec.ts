import { ListTenderClarificationsHandler } from "../list-tender-clarifications.handler";
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

function buildPrismaMock(rfis: unknown[], notes: unknown[]) {
  return {
    tenderClarification: {
      findMany: jest.fn(async () => rfis)
    },
    tenderClarificationNote: {
      findMany: jest.fn(async () => notes)
    }
  };
}

describe("ListTenderClarificationsHandler", () => {
  it("returns RFIs + notes for the active tender", async () => {
    const prisma = buildPrismaMock(
      [
        {
          id: "rfi-1",
          subject: "Confirm asbestos register coverage",
          status: "OPEN",
          dueDate: new Date("2026-06-01T00:00:00Z"),
          response: null,
          createdAt: new Date("2026-05-20T00:00:00Z"),
          updatedAt: new Date("2026-05-21T00:00:00Z")
        },
        {
          id: "rfi-2",
          subject: "Already answered RFI",
          status: "CLOSED",
          dueDate: null,
          response: "Yes, asbestos is in Class B sheet form per the register.",
          createdAt: new Date("2026-05-18T00:00:00Z"),
          updatedAt: new Date("2026-05-22T00:00:00Z")
        }
      ],
      [
        {
          id: "note-1",
          noteType: "call",
          direction: "received",
          text: "Brief call from PM",
          occurredAt: new Date("2026-05-23T08:00:00Z"),
          createdAt: new Date("2026-05-23T08:01:00Z")
        }
      ]
    );
    const handler = new ListTenderClarificationsHandler(prisma as never);
    const result = await handler.execute({}, makeCtx());
    expect(result.result.isError).toBeFalsy();
    const payload = JSON.parse(
      (result.result.content[0] as { text: string }).text
    ) as {
      tenderId: string;
      rfis: Array<{ id: string; subject: string; status: string; hasResponse: boolean }>;
      notes: Array<{ id: string; noteType: string; direction: string; text: string }>;
    };
    expect(payload.tenderId).toBe("tender-1");
    expect(payload.rfis).toHaveLength(2);
    expect(payload.rfis[0]?.hasResponse).toBe(false);
    expect(payload.rfis[1]?.hasResponse).toBe(true);
    expect(payload.notes).toHaveLength(1);
    expect(payload.notes[0]?.noteType).toBe("call");
  });

  it("prefers an explicit tenderId input over the context key", async () => {
    const findMany = jest.fn(async () => []);
    const prisma = {
      tenderClarification: { findMany },
      tenderClarificationNote: { findMany: jest.fn(async () => []) }
    };
    const handler = new ListTenderClarificationsHandler(prisma as never);
    await handler.execute({ tenderId: "other-tender" }, makeCtx({ contextKey: "tender-1" }));
    expect(findMany).toHaveBeenCalledTimes(1);
    const calls = findMany.mock.calls as unknown as Array<[{ where?: { tenderId?: string } }]>;
    expect(calls[0]?.[0]?.where?.tenderId).toBe("other-tender");
  });

  it("returns a hint message when the tender has no clarifications yet", async () => {
    const prisma = buildPrismaMock([], []);
    const handler = new ListTenderClarificationsHandler(prisma as never);
    const result = await handler.execute({}, makeCtx());
    expect(result.result.isError).toBeFalsy();
    const text = (result.result.content[0] as { text: string }).text;
    expect(text).toMatch(/No clarifications or notes found/);
  });

  it("errors when no tenderId is supplied and the context has no contextKey", async () => {
    const prisma = buildPrismaMock([], []);
    const handler = new ListTenderClarificationsHandler(prisma as never);
    const result = await handler.execute({}, makeCtx({ contextKey: null }));
    expect(result.result.isError).toBe(true);
    expect((result.result.content[0] as { text: string }).text).toMatch(
      /No tender ID provided/
    );
  });

  it("denies callers without tenders.view (non-super-user)", async () => {
    const prisma = buildPrismaMock([], []);
    const handler = new ListTenderClarificationsHandler(prisma as never);
    const result = await handler.execute({}, makeCtx({ permissions: [] }));
    expect(result.result.isError).toBe(true);
    expect((result.result.content[0] as { text: string }).text).toMatch(
      /do not have permission/
    );
  });

  it("super-users bypass the permission check", async () => {
    const prisma = buildPrismaMock(
      [
        {
          id: "rfi-1",
          subject: "x",
          status: "OPEN",
          dueDate: null,
          response: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      []
    );
    const handler = new ListTenderClarificationsHandler(prisma as never);
    const result = await handler.execute(
      {},
      makeCtx({ permissions: [], isSuperUser: true })
    );
    expect(result.result.isError).toBeFalsy();
  });
});
