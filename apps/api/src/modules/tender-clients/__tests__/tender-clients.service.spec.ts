// Mock-based unit tests for TenderClientsService. Mirrors the patterns used
// by the jobs `__tests__/jobs.service.spec.ts`: Prisma is mocked per-test,
// and the service is instantiated directly with `as never` casts on the
// injected dependencies. No TestingModule, no database.
//
// Scope: every public method — addClient (link, duplicate-attach guard,
// missing tender/client), removeClient (scoped detach, last-client guard,
// not-linked), listClients (tenderId scoping, ordering), and searchClients
// (active-only insensitive search, polymorphic primary-contact batching).
//
// Note: TenderClientsService has no isPrimary/primary-client concept and no
// scoring — awarding lives in JobsService.awardTenderClient. The join row is
// a plain tenderId+clientId link, so there is no $transaction usage here.

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { TenderClientsService } from "../tender-clients.service";

// ─── Shared fixtures ───────────────────────────────────────────────────────

const tenderClientRow = (overrides: Record<string, unknown> = {}) => ({
  id: "tc-1",
  tenderId: "tender-1",
  clientId: "client-1",
  ...overrides
});

const clientRow = (overrides: Record<string, unknown> = {}) => ({
  id: "client-1",
  name: "Initial Services",
  email: "info@initialservices.net",
  status: "ACTIVE",
  ...overrides
});

const contactRow = (overrides: Record<string, unknown> = {}) => ({
  id: "contact-1",
  firstName: "Jane",
  lastName: "Citizen",
  email: "jane@example.com",
  organisationType: "CLIENT",
  organisationId: "client-1",
  isPrimary: true,
  isActive: true,
  ...overrides
});

// Per-test mock builder. Tests override individual mock methods on the
// returned `prisma` object before driving the service.
function buildService(extraPrisma: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    tender: {
      findUnique: jest.fn().mockResolvedValue({ id: "tender-1" })
    },
    client: {
      findUnique: jest.fn().mockResolvedValue({ id: "client-1" }),
      findMany: jest.fn().mockResolvedValue([])
    },
    contact: {
      findMany: jest.fn().mockResolvedValue([])
    },
    tenderClient: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(2),
      create: jest.fn().mockResolvedValue(tenderClientRow()),
      delete: jest.fn().mockResolvedValue(tenderClientRow())
    },
    // Mocked so tests can prove the wizard's per-client attach/detach path
    // does NOT deleteMany child collections the way `tendering.service.ts`
    // updateTender does when it processes a PATCH /tenders/:id
    // {tenderClients} payload.
    tenderPricingSnapshot: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    tenderNote: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    tenderClarification: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    tenderFollowUp: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    tenderOutcome: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    }),
    ...extraPrisma
  };

  const service = new TenderClientsService(prisma as never);

  return { service, prisma };
}

// ─── addClient ─────────────────────────────────────────────────────────────

describe("TenderClientsService.addClient", () => {
  it("creates the join row with the right tenderId and clientId, then returns the refreshed list", async () => {
    const linked = [tenderClientRow({ client: clientRow(), contact: null })];
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(linked);

    const result = await service.addClient("tender-1", "client-1");

    expect((prisma.tenderClient as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: "tender-1", clientId: "client-1" }
    });
    expect(result).toEqual(linked);
  });

  it("checks for an existing link scoped to both tenderId and clientId before creating", async () => {
    const { service, prisma } = buildService();
    await service.addClient("tender-1", "client-1");
    expect((prisma.tenderClient as { findFirst: jest.Mock }).findFirst).toHaveBeenCalledWith({
      where: { tenderId: "tender-1", clientId: "client-1" }
    });
  });

  it("throws ConflictException when the client is already linked to the tender (duplicate-attach guard)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(
      tenderClientRow()
    );
    await expect(service.addClient("tender-1", "client-1")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect((prisma.tenderClient as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.addClient("missing", "client-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.tenderClient as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the client does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.client as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.addClient("tender-1", "missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.tenderClient as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("passes relationshipType through to the create call when provided (wizard PRIMARY/COMPETITOR)", async () => {
    const { service, prisma } = buildService();
    await service.addClient("tender-1", "client-1", "PRIMARY");
    expect((prisma.tenderClient as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: "tender-1", clientId: "client-1", relationshipType: "PRIMARY" }
    });
    (prisma.tenderClient as { create: jest.Mock }).create.mockClear();
    await service.addClient("tender-1", "client-2", "COMPETITOR");
    expect((prisma.tenderClient as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: { tenderId: "tender-1", clientId: "client-2", relationshipType: "COMPETITOR" }
    });
  });

  it("does not deleteMany any tender child collection (destructive-replace path is gone)", async () => {
    const { service, prisma } = buildService();
    await service.addClient("tender-1", "client-1");
    // These deleteMany calls are what tendering.service.ts `updateTender` runs
    // on every PATCH /tenders/:id {tenderClients} payload. The per-client
    // attach endpoint must never touch them.
    expect(
      (prisma.tenderPricingSnapshot as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
    expect((prisma.tenderNote as { deleteMany: jest.Mock }).deleteMany).not.toHaveBeenCalled();
    expect(
      (prisma.tenderClarification as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
    expect(
      (prisma.tenderFollowUp as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
    expect(
      (prisma.tenderOutcome as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
  });
});

// ─── removeClient ──────────────────────────────────────────────────────────

describe("TenderClientsService.removeClient", () => {
  it("deletes the link found for this tender+client and returns the refreshed list", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(
      tenderClientRow({ id: "tc-77" })
    );
    (prisma.tenderClient as { count: jest.Mock }).count.mockResolvedValueOnce(2);
    const remaining = [tenderClientRow({ id: "tc-2", clientId: "client-2" })];
    (prisma.tenderClient as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(remaining);

    const result = await service.removeClient("tender-1", "client-1");

    expect((prisma.tenderClient as { findFirst: jest.Mock }).findFirst).toHaveBeenCalledWith({
      where: { tenderId: "tender-1", clientId: "client-1" }
    });
    expect((prisma.tenderClient as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
      where: { id: "tc-77" }
    });
    expect(result).toEqual(remaining);
  });

  it("throws NotFoundException when the client is not linked to this tender (scoped detach)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(null);
    await expect(service.removeClient("tender-1", "client-9")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect((prisma.tenderClient as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when removing the last linked client", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(
      tenderClientRow()
    );
    (prisma.tenderClient as { count: jest.Mock }).count.mockResolvedValueOnce(1);
    await expect(service.removeClient("tender-1", "client-1")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect((prisma.tenderClient as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
  });

  it("counts remaining links scoped to the tender only", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(
      tenderClientRow()
    );
    await service.removeClient("tender-1", "client-1");
    expect((prisma.tenderClient as { count: jest.Mock }).count).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" }
    });
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.removeClient("missing", "client-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("does not deleteMany any tender child collection (destructive-replace path is gone)", async () => {
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce(
      tenderClientRow()
    );
    (prisma.tenderClient as { count: jest.Mock }).count.mockResolvedValueOnce(2);
    await service.removeClient("tender-1", "client-1");
    expect(
      (prisma.tenderPricingSnapshot as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
    expect((prisma.tenderNote as { deleteMany: jest.Mock }).deleteMany).not.toHaveBeenCalled();
    expect(
      (prisma.tenderClarification as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
    expect(
      (prisma.tenderFollowUp as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
    expect(
      (prisma.tenderOutcome as { deleteMany: jest.Mock }).deleteMany
    ).not.toHaveBeenCalled();
  });
});

// ─── listClients ───────────────────────────────────────────────────────────

describe("TenderClientsService.listClients", () => {
  it("returns links scoped by tenderId with client + contact includes, ordered by id asc", async () => {
    const rows = [
      tenderClientRow({ client: clientRow(), contact: null }),
      tenderClientRow({ id: "tc-2", clientId: "client-2", client: clientRow({ id: "client-2" }), contact: null })
    ];
    const { service, prisma } = buildService();
    (prisma.tenderClient as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(rows);

    const result = await service.listClients("tender-1");

    expect(result).toEqual(rows);
    expect((prisma.tenderClient as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { id: "asc" }
    });
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.listClients("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect((prisma.tenderClient as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });
});

// ─── searchClients ─────────────────────────────────────────────────────────

describe("TenderClientsService.searchClients", () => {
  it("returns [] without querying when the term is empty or whitespace", async () => {
    const { service, prisma } = buildService();
    await expect(service.searchClients("")).resolves.toEqual([]);
    await expect(service.searchClients("   ")).resolves.toEqual([]);
    expect((prisma.client as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it("searches ACTIVE clients by trimmed name, case-insensitive, capped at 10", async () => {
    const { service, prisma } = buildService();
    await service.searchClients("  brisbane  ");
    expect((prisma.client as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: {
        status: "ACTIVE",
        name: { contains: "brisbane", mode: "insensitive" }
      },
      take: 10,
      orderBy: { name: "asc" }
    });
  });

  it("skips the contact query entirely when no clients match", async () => {
    const { service, prisma } = buildService();
    const result = await service.searchClients("nothing");
    expect(result).toEqual([]);
    expect((prisma.contact as { findMany: jest.Mock }).findMany).not.toHaveBeenCalled();
  });

  it("maps each client to its first (primary-first) active CLIENT contact", async () => {
    const { service, prisma } = buildService();
    (prisma.client as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      clientRow(),
      clientRow({ id: "client-2", name: "Other Pty Ltd", email: "other@example.com" })
    ]);
    // The query orders isPrimary desc then createdAt asc; the service keeps
    // the first row seen per organisationId.
    (prisma.contact as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      contactRow(),
      contactRow({ id: "contact-2", firstName: "Bob", lastName: "Builder", isPrimary: false })
    ]);

    const result = await service.searchClients("ltd");

    expect((prisma.contact as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith({
      where: {
        organisationType: "CLIENT",
        organisationId: { in: ["client-1", "client-2"] },
        isActive: true
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
    });
    expect(result).toEqual([
      {
        id: "client-1",
        name: "Initial Services",
        email: "info@initialservices.net",
        contactName: "Jane Citizen"
      },
      {
        id: "client-2",
        name: "Other Pty Ltd",
        email: "other@example.com",
        contactName: null
      }
    ]);
  });

  it("keeps only the first contact per client when several are returned", async () => {
    const { service, prisma } = buildService();
    (prisma.client as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([clientRow()]);
    (prisma.contact as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
      contactRow({ id: "contact-primary", firstName: "Primary", lastName: "Person" }),
      contactRow({ id: "contact-secondary", firstName: "Secondary", lastName: "Person", isPrimary: false })
    ]);

    const result = await service.searchClients("initial");

    expect(result).toEqual([
      expect.objectContaining({ id: "client-1", contactName: "Primary Person" })
    ]);
  });
});
