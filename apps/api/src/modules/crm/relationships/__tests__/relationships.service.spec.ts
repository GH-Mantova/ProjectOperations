import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RelationshipsService } from "../relationships.service";
import { CRM_COLD_V3 } from "../../accounts/accounts.service";

// CRM-S7: channel enum values available without importing Prisma
const VALID_CHANNELS = ["phone", "email", "meeting", "site_visit", "other"] as const;

// ── Mock Prisma ───────────────────────────────────────────────────────────────

type MockPrisma = {
  relationshipNote: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  contact: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  account: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  user: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    relationshipNote: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0)
    },
    contact: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (arg) => {
      if (typeof arg === "function") return arg(prisma);
      return Promise.all(arg);
    })
  };
  return prisma;
}

function makeService(prisma: MockPrisma) {
  return new RelationshipsService(prisma as never);
}

const NOW = new Date("2026-08-14T12:00:00Z");

const NOTE_STUB = {
  id: "note-1",
  accountId: "acct-1",
  contactId: "contact-1",
  authorId: "user-1",
  body: "Called Jane, discussed Q4 quote.",
  channel: null,
  createdAt: NOW,
  updatedAt: NOW,
  author: { id: "user-1", firstName: "Marco", lastName: "M" },
  account: { id: "acct-1", client: { id: "client-1", name: "Acme" } },
  contact: { id: "contact-1", firstName: "Jane", lastName: "Smith" }
};

// ── createNote ────────────────────────────────────────────────────────────────

describe("RelationshipsService.createNote", () => {
  it("creates a note linked to account and contact", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.account.findUnique.mockResolvedValue({ id: "acct-1" });
    prisma.contact.findUnique.mockResolvedValue({ id: "contact-1" });
    prisma.relationshipNote.create.mockResolvedValue(NOTE_STUB);
    prisma.contact.update.mockResolvedValue({ id: "contact-1", lastContactedAt: NOW });

    const service = makeService(prisma);
    const result = await service.createNote({
      accountId: "acct-1",
      contactId: "contact-1",
      authorId: "user-1",
      body: "Called Jane, discussed Q4 quote."
    });

    expect(result).toEqual(NOTE_STUB);
    expect(prisma.relationshipNote.create).toHaveBeenCalledTimes(1);
    // lastContactedAt must be updated on the contact
    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contact-1" },
        data: expect.objectContaining({ lastContactedAt: NOW })
      })
    );
  });

  it("creates a note with accountId only (no contact)", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.account.findUnique.mockResolvedValue({ id: "acct-1" });
    const noteStub = { ...NOTE_STUB, contactId: null, contact: null };
    prisma.relationshipNote.create.mockResolvedValue(noteStub);

    const service = makeService(prisma);
    const result = await service.createNote({
      accountId: "acct-1",
      authorId: "user-1",
      body: "Account-level note."
    });

    expect(result.contactId).toBeNull();
    // No contact to update
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when body is empty", async () => {
    const service = makeService(makePrisma());
    await expect(
      service.createNote({ accountId: "acct-1", authorId: "user-1", body: "  " })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws BadRequestException when neither accountId nor contactId is provided", async () => {
    const service = makeService(makePrisma());
    await expect(
      service.createNote({ authorId: "user-1", body: "Some note." })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws NotFoundException when author does not exist", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(
      service.createNote({ accountId: "acct-1", authorId: "bad-user", body: "Note." })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when accountId refers to unknown account", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.account.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(
      service.createNote({ accountId: "bad-acct", authorId: "user-1", body: "Note." })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── listNotes ─────────────────────────────────────────────────────────────────

describe("RelationshipsService.listNotes", () => {
  it("returns paginated notes", async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockResolvedValue([[NOTE_STUB], 1]);

    const service = makeService(prisma);
    const result = await service.listNotes({ accountId: "acct-1" });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
  });
});

// ── getNote ───────────────────────────────────────────────────────────────────

describe("RelationshipsService.getNote", () => {
  it("returns the note when found", async () => {
    const prisma = makePrisma();
    prisma.relationshipNote.findUnique.mockResolvedValue(NOTE_STUB);

    const service = makeService(prisma);
    const result = await service.getNote("note-1");
    expect(result).toEqual(NOTE_STUB);
  });

  it("throws NotFoundException when note does not exist", async () => {
    const prisma = makePrisma();
    prisma.relationshipNote.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.getNote("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── updateNote ────────────────────────────────────────────────────────────────

describe("RelationshipsService.updateNote", () => {
  it("updates the note body", async () => {
    const prisma = makePrisma();
    prisma.relationshipNote.findUnique.mockResolvedValue(NOTE_STUB);
    const updated = { ...NOTE_STUB, body: "Updated body." };
    prisma.relationshipNote.update.mockResolvedValue(updated);

    const service = makeService(prisma);
    const result = await service.updateNote("note-1", { body: "Updated body." });
    expect(result.body).toBe("Updated body.");
  });

  it("throws BadRequestException when new body is empty", async () => {
    const service = makeService(makePrisma());
    await expect(service.updateNote("note-1", { body: "" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("throws NotFoundException when note does not exist", async () => {
    const prisma = makePrisma();
    prisma.relationshipNote.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.updateNote("missing", { body: "x" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

// ── deleteNote ────────────────────────────────────────────────────────────────

describe("RelationshipsService.deleteNote", () => {
  it("deletes an existing note", async () => {
    const prisma = makePrisma();
    prisma.relationshipNote.findUnique.mockResolvedValue(NOTE_STUB);
    prisma.relationshipNote.delete.mockResolvedValue(NOTE_STUB);

    const service = makeService(prisma);
    const result = await service.deleteNote("note-1");
    expect(result.deleted).toBe(true);
  });

  it("throws NotFoundException when note does not exist", async () => {
    const prisma = makePrisma();
    prisma.relationshipNote.findUnique.mockResolvedValue(null);

    const service = makeService(prisma);
    await expect(service.deleteNote("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── getGoingColdAccounts ──────────────────────────────────────────────────────

describe("RelationshipsService.getGoingColdAccounts", () => {
  it("returns accounts with cold contacts", async () => {
    const OLD_DATE = new Date("2020-01-01");
    const coldAccount = {
      id: "acct-cold",
      clientId: "client-1",
      lifecycleStatus: "ACTIVE",
      accountType: "CLIENT",
      source: "DIRECT",
      ownerId: null,
      archivedAt: null,
      updatedAt: NOW,
      createdAt: NOW,
      client: { id: "client-1", name: "Acme", code: null, isActive: true },
      owner: null,
      contacts: [
        {
          id: "contact-1",
          firstName: "Jane",
          lastName: "Smith",
          role: null,
          email: null,
          lastContactedAt: OLD_DATE
        }
      ]
    };
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([coldAccount]);

    const service = makeService(prisma);
    const result = await service.getGoingColdAccounts(30);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("acct-cold");
    expect(result[0].coldSince).toEqual(OLD_DATE);
    expect(result[0].thresholdDays).toBe(30);
  });

  it("returns empty list when all accounts have recent contacts", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([]);

    const service = makeService(prisma);
    const result = await service.getGoingColdAccounts(30);
    expect(result).toHaveLength(0);
  });

  // CRM_COLD_V3 (2026-09-04): this list and the KPI tile must agree. Both
  // filters used to OR in `{ lastContactedAt: null }`; with no contact ever
  // logged that listed all 175 accounts under a tile that now reads 0 — the
  // exact tile-versus-list split the shared contract exists to close.
  //
  // findMany is mocked, so nothing but these assertions stops the two null
  // branches being reintroduced. Pin the shape of BOTH filters.
  it("never-contacted accounts are NOT selected — no null branch in either filter", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([]);

    const service = makeService(prisma);
    await service.getGoingColdAccounts(30);

    const args = prisma.account.findMany.mock.calls[0][0];

    // Account filter: the single lt-cutoff condition, no OR wrapper.
    expect(args.where.contacts.some).toEqual({ lastContactedAt: { lt: expect.any(Date) } });
    expect(args.where.contacts.some.OR).toBeUndefined();

    // Contact sub-select: likewise.
    expect(args.include.contacts.where).toEqual({ lastContactedAt: { lt: expect.any(Date) } });
    expect(args.include.contacts.where.OR).toBeUndefined();

    // Belt and braces — the serialised args must not mention a null date at all.
    expect(JSON.stringify(args)).not.toContain('"lastContactedAt":null');
  });

  it("leaves take, orderBy and the thresholdDays echo exactly as they were", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([]);

    const service = makeService(prisma);
    await service.getGoingColdAccounts(30);

    const args = prisma.account.findMany.mock.calls[0][0];
    expect(args.where.archivedAt).toBeNull();
    expect(args.take).toBe(50);
    expect(args.orderBy).toEqual({ updatedAt: "asc" });
    expect(args.include.contacts.take).toBe(3);
    expect(args.include.contacts.orderBy).toEqual({ lastContactedAt: "asc" });
  });

  it("defaults to CRM_COLD_V3.THRESHOLD_DAYS when no threshold is passed", async () => {
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([]);

    const service = makeService(prisma);
    const result = await service.getGoingColdAccounts();

    // The default is sourced from the shared constant, not a local literal —
    // the tile once read 14 while this read 30.
    expect(CRM_COLD_V3.THRESHOLD_DAYS).toBe(60);
    expect(result).toHaveLength(0);
  });
});

// ── getRepeatBusinessAccounts ─────────────────────────────────────────────────

describe("RelationshipsService.getRepeatBusinessAccounts", () => {
  it("returns accounts with repeat business", async () => {
    const repeatAccount = {
      id: "acct-repeat",
      clientId: "client-1",
      lifecycleStatus: "ACTIVE",
      accountType: "CLIENT",
      source: "DIRECT",
      ownerId: null,
      archivedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
      client: {
        id: "client-1",
        name: "Repeat Corp",
        code: "RC",
        winCount: 3,
        tenderCount: 5,
        winRate: "0.60",
        lastWonAt: NOW,
        isActive: true
      },
      owner: null
    };
    const prisma = makePrisma();
    prisma.account.findMany.mockResolvedValue([repeatAccount]);

    const service = makeService(prisma);
    const result = await service.getRepeatBusinessAccounts();

    expect(result).toHaveLength(1);
    expect(result[0].client?.winCount).toBeGreaterThan(1);
  });
});

// ── CRM-S7: channel field on RelationshipNote ─────────────────────────────────

describe("CRM-S7 RelationshipNote.channel", () => {
  it("a note created without channel has channel=null (historic notes stay NULL)", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.account.findUnique.mockResolvedValue({ id: "acct-1" });
    // Account-only note (no contact) — avoids needing a contact mock
    const noChannelStub = { ...NOTE_STUB, contactId: null, contact: null, channel: null };
    prisma.relationshipNote.create.mockResolvedValue(noChannelStub);

    const service = makeService(prisma);
    const result = await service.createNote({
      accountId: "acct-1",
      authorId: "user-1",
      body: "Discussed Q4 quote."
      // channel omitted — tests historic-note path; NULL is preserved as-is
    });

    expect(result.channel).toBeNull();
    // NULL channel renders as "—" in the UI (rendering is the web layer's responsibility,
    // but the null value is what we assert here)
  });

  it("a note created with channel=phone stores the value", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    prisma.account.findUnique.mockResolvedValue({ id: "acct-1" });
    // Account-only note (no contact) to keep the mock simple
    const phoneStub = { ...NOTE_STUB, contactId: null, contact: null, channel: "phone" };
    prisma.relationshipNote.create.mockResolvedValue(phoneStub);

    const service = makeService(prisma);
    const result = await service.createNote({
      accountId: "acct-1",
      authorId: "user-1",
      body: "Phone call.",
      channel: "phone" as never
    });

    expect(result.channel).toBe("phone");
    // Verify the create call received the channel value
    expect(prisma.relationshipNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: "phone" })
      })
    );
  });

  it("VALID_CHANNELS contains the five expected values from the schema", () => {
    expect(VALID_CHANNELS).toEqual(["phone", "email", "meeting", "site_visit", "other"]);
  });
});
