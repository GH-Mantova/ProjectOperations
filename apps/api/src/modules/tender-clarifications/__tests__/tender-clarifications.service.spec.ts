// Mock-based unit tests for TenderClarificationsService. Mirrors the
// patterns used by the JobsService spec (PR #283 / #298 lineage): Prisma
// is mocked per-test as a plain object of jest.fn()s, and the service is
// instantiated directly with `as never` casts on the injected deps.
//
// Domain note: the §5 clarification log is a flat sent/received
// communication trail (TenderClarificationNote). There is no status or
// resolved-at column on this model — completion/resolution lives on the
// separate formal-RFI model (TenderClarification), not on this service.
// noteType is free-form at the service layer; the controller DTO is what
// restricts it to the five known kinds (call/email/meeting/note/response).
// The "noteType validation gap" test at the bottom documents that split.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TenderClarificationsService } from "../tender-clarifications.service";

// ─── Shared fixtures ───────────────────────────────────────────────────────

const NOTE_TYPES = ["call", "email", "meeting", "note", "response"] as const;

const noteRow = (overrides: Record<string, unknown> = {}) => ({
  id: "note-1",
  tenderId: "tender-1",
  direction: "sent",
  noteType: "note",
  text: "Existing clarification",
  occurredAt: new Date("2026-06-01T00:00:00.000Z"),
  createdById: "user-1",
  clientId: null,
  ...overrides
});

// Per-test mock builder. Tests override individual mock methods on the
// returned `prisma` object before driving the service.
function buildService(extraPrisma: Record<string, unknown> = {}) {
  const auditWrite = jest.fn().mockResolvedValue(undefined);

  const prisma: Record<string, unknown> = {
    tender: {
      findUnique: jest.fn().mockResolvedValue({ id: "tender-1" })
    },
    client: {
      findUnique: jest.fn().mockResolvedValue({ id: "client-1" })
    },
    tenderClarificationNote: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(noteRow()),
      create: jest.fn().mockResolvedValue(noteRow()),
      update: jest.fn().mockResolvedValue(noteRow()),
      delete: jest.fn().mockResolvedValue(noteRow())
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    }),
    ...extraPrisma
  };

  const audit = { write: auditWrite };

  const service = new TenderClarificationsService(prisma as never, audit as never);

  return { service, prisma, audit, auditWrite };
}

type Mocked = { [method: string]: jest.Mock };
const model = (prisma: Record<string, unknown>, name: string): Mocked =>
  prisma[name] as Mocked;

// ─── list ──────────────────────────────────────────────────────────────────

describe("TenderClarificationsService.list", () => {
  it("returns notes scoped to the tender, newest first by occurredAt", async () => {
    const rows = [noteRow({ id: "note-2" }), noteRow({ id: "note-1" })];
    const { service, prisma } = buildService();
    model(prisma, "tenderClarificationNote").findMany.mockResolvedValueOnce(rows);

    const result = await service.list("tender-1");

    expect(result).toBe(rows);
    expect(model(prisma, "tenderClarificationNote").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenderId: "tender-1" },
        orderBy: { occurredAt: "desc" }
      })
    );
  });

  it("includes the createdBy author metadata in the query", async () => {
    const { service, prisma } = buildService();
    await service.list("tender-1");
    expect(model(prisma, "tenderClarificationNote").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } }
      })
    );
  });

  it("adds a clientId filter when one is supplied", async () => {
    const { service, prisma } = buildService();
    await service.list("tender-1", "client-1");
    expect(model(prisma, "tenderClarificationNote").findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenderId: "tender-1", clientId: "client-1" }
      })
    );
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    model(prisma, "tender").findUnique.mockResolvedValueOnce(null);
    await expect(service.list("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(model(prisma, "tenderClarificationNote").findMany).not.toHaveBeenCalled();
  });
});

// ─── create ────────────────────────────────────────────────────────────────

describe("TenderClarificationsService.create", () => {
  it("creates a note attached to the tender with the actor as author", async () => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", {
      direction: "sent",
      text: "Sent RFI re: retaining wall founding depth"
    });
    expect(model(prisma, "tenderClarificationNote").create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenderId: "tender-1",
          direction: "sent",
          text: "Sent RFI re: retaining wall founding depth",
          createdById: "user-1",
          clientId: null
        })
      })
    );
  });

  it.each(NOTE_TYPES)("accepts noteType %s and passes it through to Prisma", async (noteType) => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", {
      direction: "received",
      text: "Client follow-up",
      noteType
    });
    expect(model(prisma, "tenderClarificationNote").create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ noteType })
      })
    );
  });

  it("defaults noteType to 'note' when none is supplied", async () => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", { direction: "sent", text: "x" });
    expect(model(prisma, "tenderClarificationNote").create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ noteType: "note" })
      })
    );
  });

  it.each(["sent", "received"])("accepts direction %s", async (direction) => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", { direction, text: "x" });
    expect(model(prisma, "tenderClarificationNote").create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ direction })
      })
    );
  });

  it("rejects an unknown direction with BadRequestException", async () => {
    const { service, prisma } = buildService();
    await expect(
      service.create("tender-1", "user-1", { direction: "forwarded", text: "x" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model(prisma, "tenderClarificationNote").create).not.toHaveBeenCalled();
  });

  it("rejects empty or whitespace-only text with BadRequestException", async () => {
    const { service } = buildService();
    await expect(
      service.create("tender-1", "user-1", { direction: "sent", text: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("trims surrounding whitespace from text before persisting", async () => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", { direction: "sent", text: "  trimmed  " });
    expect(model(prisma, "tenderClarificationNote").create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ text: "trimmed" })
      })
    );
  });

  it("parses a supplied ISO date into occurredAt", async () => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", {
      direction: "sent",
      text: "x",
      date: "2026-04-22"
    });
    const createArgs = model(prisma, "tenderClarificationNote").create.mock.calls[0]?.[0] as {
      data: { occurredAt: Date };
    };
    expect(createArgs.data.occurredAt).toEqual(new Date("2026-04-22"));
  });

  it("rejects an unparseable date with BadRequestException (400, not 500)", async () => {
    const { service, prisma } = buildService();
    await expect(
      service.create("tender-1", "user-1", { direction: "sent", text: "x", date: "not-a-date" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model(prisma, "tenderClarificationNote").create).not.toHaveBeenCalled();
  });

  it("defaults occurredAt to now when no date is supplied", async () => {
    const before = Date.now();
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", { direction: "sent", text: "x" });
    const createArgs = model(prisma, "tenderClarificationNote").create.mock.calls[0]?.[0] as {
      data: { occurredAt: Date };
    };
    expect(createArgs.data.occurredAt).toBeInstanceOf(Date);
    expect(createArgs.data.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(createArgs.data.occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("validates a supplied clientId against the client table", async () => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", {
      direction: "sent",
      text: "x",
      clientId: "client-1"
    });
    expect(model(prisma, "client").findUnique).toHaveBeenCalledWith({
      where: { id: "client-1" },
      select: { id: true }
    });
    expect(model(prisma, "tenderClarificationNote").create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: "client-1" })
      })
    );
  });

  it("rejects an unknown clientId with BadRequestException", async () => {
    const { service, prisma } = buildService();
    model(prisma, "client").findUnique.mockResolvedValueOnce(null);
    await expect(
      service.create("tender-1", "user-1", { direction: "sent", text: "x", clientId: "ghost" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model(prisma, "tenderClarificationNote").create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when attaching to a non-existent tender", async () => {
    const { service, prisma } = buildService();
    model(prisma, "tender").findUnique.mockResolvedValueOnce(null);
    await expect(
      service.create("missing", "user-1", { direction: "sent", text: "x" })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(model(prisma, "tenderClarificationNote").create).not.toHaveBeenCalled();
  });
});

// ─── update ────────────────────────────────────────────────────────────────

describe("TenderClarificationsService.update", () => {
  it("updates only the supplied fields, scoped by id", async () => {
    const { service, prisma } = buildService();
    await service.update("tender-1", "note-1", { text: "Revised wording" });
    expect(model(prisma, "tenderClarificationNote").update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-1" },
        data: { text: "Revised wording" }
      })
    );
  });

  it.each(NOTE_TYPES)("allows switching the note to type %s after creation", async (noteType) => {
    const { service, prisma } = buildService();
    await service.update("tender-1", "note-1", { noteType });
    expect(model(prisma, "tenderClarificationNote").update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-1" },
        data: { noteType }
      })
    );
  });

  it("allows flipping direction between sent and received", async () => {
    const { service, prisma } = buildService();
    await service.update("tender-1", "note-1", { direction: "received" });
    expect(model(prisma, "tenderClarificationNote").update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { direction: "received" } })
    );
  });

  it("rejects an unknown direction with BadRequestException", async () => {
    const { service, prisma } = buildService();
    await expect(
      service.update("tender-1", "note-1", { direction: "internal" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model(prisma, "tenderClarificationNote").update).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only text with BadRequestException", async () => {
    const { service } = buildService();
    await expect(service.update("tender-1", "note-1", { text: " " })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("re-parses a supplied date and rejects an invalid one", async () => {
    const { service, prisma } = buildService();
    await service.update("tender-1", "note-1", { date: "2026-05-01" });
    expect(model(prisma, "tenderClarificationNote").update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { occurredAt: new Date("2026-05-01") } })
    );
    await expect(
      service.update("tender-1", "note-1", { date: "junk" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("leaves occurredAt untouched when date is explicitly null", async () => {
    const { service, prisma } = buildService();
    await service.update("tender-1", "note-1", { date: null, text: "x" });
    const updateArgs = model(prisma, "tenderClarificationNote").update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data).not.toHaveProperty("occurredAt");
  });

  it("validates a changed clientId and allows clearing it with null", async () => {
    const { service, prisma } = buildService();
    await service.update("tender-1", "note-1", { clientId: "client-1" });
    expect(model(prisma, "client").findUnique).toHaveBeenCalledWith({
      where: { id: "client-1" },
      select: { id: true }
    });

    await service.update("tender-1", "note-1", { clientId: null });
    const secondArgs = model(prisma, "tenderClarificationNote").update.mock.calls[1]?.[0] as {
      data: { clientId: string | null };
    };
    expect(secondArgs.data.clientId).toBeNull();
    // The null branch must not hit the client table again.
    expect(model(prisma, "client").findUnique).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown clientId with BadRequestException", async () => {
    const { service, prisma } = buildService();
    model(prisma, "client").findUnique.mockResolvedValueOnce(null);
    await expect(
      service.update("tender-1", "note-1", { clientId: "ghost" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when the note does not exist", async () => {
    const { service, prisma } = buildService();
    model(prisma, "tenderClarificationNote").findUnique.mockResolvedValueOnce(null);
    await expect(service.update("tender-1", "missing", { text: "x" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("throws NotFoundException when the note belongs to a different tender", async () => {
    const { service, prisma } = buildService();
    model(prisma, "tenderClarificationNote").findUnique.mockResolvedValueOnce(
      noteRow({ tenderId: "other-tender" })
    );
    await expect(service.update("tender-1", "note-1", { text: "x" })).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(model(prisma, "tenderClarificationNote").update).not.toHaveBeenCalled();
  });
});

// ─── remove ────────────────────────────────────────────────────────────────

describe("TenderClarificationsService.remove", () => {
  it("deletes the note, writes a COMM_ENTRY_DELETED audit entry, and returns the id", async () => {
    const { service, prisma, auditWrite } = buildService();
    const result = await service.remove("tender-1", "note-1", "user-1");
    expect(result).toEqual({ id: "note-1" });
    expect(model(prisma, "tenderClarificationNote").delete).toHaveBeenCalledWith({
      where: { id: "note-1" }
    });
    expect(auditWrite).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "COMM_ENTRY_DELETED",
      entityType: "CommEntry",
      entityId: "note-1",
      metadata: { tenderId: "tender-1" }
    });
  });

  it("throws NotFoundException when the note does not exist", async () => {
    const { service, prisma } = buildService();
    model(prisma, "tenderClarificationNote").findUnique.mockResolvedValueOnce(null);
    await expect(service.remove("tender-1", "missing", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(model(prisma, "tenderClarificationNote").delete).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the note belongs to a different tender", async () => {
    const { service, prisma, auditWrite } = buildService();
    model(prisma, "tenderClarificationNote").findUnique.mockResolvedValueOnce(
      noteRow({ tenderId: "other-tender" })
    );
    await expect(service.remove("tender-1", "note-1", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(auditWrite).not.toHaveBeenCalled();
  });
});

// ─── noteType validation gap ───────────────────────────────────────────────

describe("TenderClarificationsService — noteType validation gap", () => {
  // The service does not restrict noteType — only the controller DTO's
  // @IsIn(NOTE_TYPES) does (tender-clarifications.controller.ts:16,24).
  // Any non-HTTP caller (personas tools, AI clarification proposals) can
  // therefore persist an arbitrary noteType string. Documented here so
  // the gap is visible; tightening it would be a production change.
  it("accepts an arbitrary noteType at the service layer (controller-only validation)", async () => {
    const { service, prisma } = buildService();
    await service.create("tender-1", "user-1", {
      direction: "sent",
      text: "x",
      noteType: "carrier-pigeon"
    });
    expect(model(prisma, "tenderClarificationNote").create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ noteType: "carrier-pigeon" })
      })
    );
  });
});
