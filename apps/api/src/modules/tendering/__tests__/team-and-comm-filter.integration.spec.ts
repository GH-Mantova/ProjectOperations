import { NotFoundException } from "@nestjs/common";
import { TenderingService } from "../tendering.service";
import { TenderClarificationsService } from "../../tender-clarifications/tender-clarifications.service";
import { UsersService } from "../../users/users.service";

// §5A.3 — backend tests for PR-63a (Team-as-estimator + client-filtered
// activity). Follows the existing tendering test pattern of injecting a
// mocked PrismaService so the suite can run under `pnpm test:api:serial`
// without touching a real Postgres instance.

function makeTenderingService(prismaOverrides: Record<string, unknown> = {}) {
  const audit = { write: jest.fn().mockResolvedValue({}) };
  const prisma = {
    tender: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    ...prismaOverrides
  };
  // PR-64 added a 4th constructor argument: SharePointService.
  // This test doesn't exercise tender-create / duplicate, so a no-op mock
  // of the methods the service might call is sufficient.
  const sharePoint = {
    ensureTenderFolderStructure: jest.fn().mockResolvedValue(undefined)
  };
  const service = new TenderingService(
    prisma as never,
    audit as never,
    { sendNotificationEmail: jest.fn() } as never,
    sharePoint as never,
    {
      generate: jest.fn().mockResolvedValue({
        tenderNumber: "T260612-ACME-Rev1",
        clientSlugSnapshot: "ACME",
        revisionNumber: 1
      })
    } as never
  );
  return { service, prisma, audit };
}

function makeClarificationsService() {
  const audit = { write: jest.fn().mockResolvedValue({}) };
  const prisma = {
    tender: { findUnique: jest.fn() },
    client: { findUnique: jest.fn() },
    tenderClarificationNote: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };
  const service = new TenderClarificationsService(prisma as never, audit as never);
  return { service, prisma, audit };
}

function makeUsersService() {
  const prisma = {
    $transaction: jest.fn(),
    user: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() }
  };
  const password = { hashPassword: jest.fn() };
  const audit = { write: jest.fn().mockResolvedValue({}) };
  const service = new UsersService(prisma as never, password as never, audit as never);
  return { service, prisma };
}

describe("§5A.3 backend — team-as-estimator + client-filtered activity", () => {
  describe("PATCH /tenders/:id/assigned-estimator", () => {
    it("admin can set an assignee — value persists and an audit row is written", async () => {
      const { service, prisma, audit } = makeTenderingService();
      (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
        id: "t-1",
        assignedEstimatorId: null
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "u-9" });
      (prisma.tender.update as jest.Mock).mockResolvedValue({
        id: "t-1",
        assignedEstimatorId: "u-9"
      });

      const result = await service.setAssignedEstimator("t-1", "u-9", "actor-1");

      expect(prisma.tender.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { assignedEstimator: { connect: { id: "u-9" } } }
      });
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "actor-1",
          action: "tenders.assigned-estimator.update",
          entityType: "Tender",
          entityId: "t-1",
          metadata: expect.objectContaining({
            previousAssignedEstimatorId: null,
            assignedEstimatorId: "u-9"
          })
        })
      );
      expect(result).toEqual({ id: "t-1", assignedEstimatorId: "u-9" });
    });

    it("passing null clears the assignment via disconnect", async () => {
      const { service, prisma, audit } = makeTenderingService();
      (prisma.tender.findUnique as jest.Mock).mockResolvedValue({
        id: "t-1",
        assignedEstimatorId: "u-9"
      });
      (prisma.tender.update as jest.Mock).mockResolvedValue({
        id: "t-1",
        assignedEstimatorId: null
      });

      await service.setAssignedEstimator("t-1", null, "actor-1");

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.tender.update).toHaveBeenCalledWith({
        where: { id: "t-1" },
        data: { assignedEstimator: { disconnect: true } }
      });
      expect(audit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "tenders.assigned-estimator.update",
          metadata: expect.objectContaining({
            previousAssignedEstimatorId: "u-9",
            assignedEstimatorId: null
          })
        })
      );
    });
  });

  describe("DELETE /tenders/:id/clarification-notes/:entryId", () => {
    it("deletes the entry and writes a COMM_ENTRY_DELETED audit row", async () => {
      const { service, prisma, audit } = makeClarificationsService();
      (prisma.tenderClarificationNote.findUnique as jest.Mock).mockResolvedValue({
        id: "n-1",
        tenderId: "t-1"
      });

      const result = await service.remove("t-1", "n-1", "actor-1");

      expect(prisma.tenderClarificationNote.delete).toHaveBeenCalledWith({ where: { id: "n-1" } });
      expect(audit.write).toHaveBeenCalledWith({
        actorId: "actor-1",
        action: "COMM_ENTRY_DELETED",
        entityType: "CommEntry",
        entityId: "n-1",
        metadata: { tenderId: "t-1" }
      });
      expect(result).toEqual({ id: "n-1" });
    });

    it("returns 404 (NotFoundException) when the entry belongs to a different tender", async () => {
      const { service, prisma, audit } = makeClarificationsService();
      (prisma.tenderClarificationNote.findUnique as jest.Mock).mockResolvedValue({
        id: "n-1",
        tenderId: "other-tender"
      });

      await expect(service.remove("t-1", "n-1", "actor-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tenderClarificationNote.delete).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    });
  });

  describe("GET /tenders/:id/clarification-notes?clientId=…", () => {
    it("filters notes by clientId when provided", async () => {
      const { service, prisma } = makeClarificationsService();
      (prisma.tender.findUnique as jest.Mock).mockResolvedValue({ id: "t-1" });
      (prisma.tenderClarificationNote.findMany as jest.Mock).mockResolvedValue([
        { id: "n-1", tenderId: "t-1", clientId: "c-9" }
      ]);

      const result = await service.list("t-1", "c-9");

      expect(prisma.tenderClarificationNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenderId: "t-1", clientId: "c-9" }
        })
      );
      expect(result).toHaveLength(1);
    });

    it("returns all notes when clientId is omitted", async () => {
      const { service, prisma } = makeClarificationsService();
      (prisma.tender.findUnique as jest.Mock).mockResolvedValue({ id: "t-1" });
      (prisma.tenderClarificationNote.findMany as jest.Mock).mockResolvedValue([
        { id: "n-1", tenderId: "t-1", clientId: "c-1" },
        { id: "n-2", tenderId: "t-1", clientId: null }
      ]);

      await service.list("t-1");

      expect(prisma.tenderClarificationNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenderId: "t-1" }
        })
      );
    });
  });

  describe("GET /users?role=estimator", () => {
    it("filters users to those carrying the named role (case-insensitive)", async () => {
      const { service, prisma } = makeUsersService();
      const userRow = {
        id: "u-9",
        email: "estimator@example.com",
        firstName: "Eva",
        lastName: "Stimer",
        isActive: true,
        isSuperUser: false,
        lastLoginAt: null,
        userRoles: [
          {
            role: {
              id: "r-1",
              name: "Estimator",
              description: null,
              rolePermissions: []
            }
          }
        ]
      };
      (prisma.user.findMany as jest.Mock).mockResolvedValue([userRow]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);
      (prisma.$transaction as jest.Mock).mockImplementation((operations: Promise<unknown>[]) =>
        Promise.all(operations)
      );

      const result = await service.list({ page: 1, pageSize: 10 } as never, "estimator");

      const expectedWhere = {
        userRoles: {
          some: { role: { name: { equals: "estimator", mode: "insensitive" } } }
        }
      };
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere })
      );
      expect(prisma.user.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(result.items[0]).toMatchObject({
        id: "u-9",
        roles: [expect.objectContaining({ name: "Estimator" })]
      });
      expect(result.total).toBe(1);
    });
  });
});
